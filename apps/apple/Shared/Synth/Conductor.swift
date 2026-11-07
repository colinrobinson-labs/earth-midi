import Foundation
import Combine

/// Native control loop: js/ui.js tick() + js/audio.js updateEngine() for the layers NativeSynth plays.
@MainActor
final class Conductor: ObservableObject {
    enum Mode: String, CaseIterable, Identifiable { case live = "Live", replay = "Last 24 hours"; var id: String { rawValue } }

    @Published private(set) var data = EarthReadings()
    @Published private(set) var isPlaying = false
    @Published var mode: Mode = .live { didSet { if isPlaying { restartClock() } } }
    @Published private(set) var events: [PlayedEvent] = []
    @Published private(set) var clock = Date()
    @Published private(set) var kp = 2.0
    @Published private(set) var hits: [Character: Double] = [:]
    @Published var muted = Set<Character>()

    let synth = NativeSynth()
    var onEvent: ((PlayedEvent) -> Void)?
    var onState: (() -> Void)?

    private var timer: Timer?
    private var refreshTimer: Timer?
    private var played = Set<String>()
    private var replayStart = Date(), replayFrom = 0.0, replayEnd = 0.0
    private let replaySeconds = 180.0
    private var lastChord = -100.0, chordIx = 0, lastChoir = -100.0
    private var lastXClass: Character?
    private var targets = SynthTargets()

    var modeLabel: String { mode == .live ? "LIVE · events play as the sensors publish them" : "Replaying the last 24 h at \(Int(86400 / replaySeconds))× speed" }

    func load() async {
        data = await EarthData.load()
        kp = data.kpNow
    }

    func toggle() { isPlaying ? stop() : play() }

    func play() {
        guard !isPlaying else { return }
        do { try synth.start() } catch { print("audio start failed: \(error)") }
        isPlaying = true
        restartClock()
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.tick() } }
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
        if data.quakes.isEmpty { Task { await refresh() } }
        onState?()
    }

    func stop() {
        guard isPlaying else { return }
        isPlaying = false
        timer?.invalidate(); refreshTimer?.invalidate()
        synth.stop()
        onState?()
    }

    private func refresh() async {
        let fresh = await EarthData.load()
        // keep quakes we already know about so replay positions stay stable
        var byId = Dictionary(uniqueKeysWithValues: data.quakes.map { ($0.id, $0) })
        for q in fresh.quakes { byId[q.id] = q }
        var merged = fresh
        merged.quakes = byId.values.filter { $0.time.timeIntervalSinceNow > -86400 * 1.05 }.sorted { $0.time < $1.time }
        data = merged
    }

    private func restartClock() {
        played.removeAll()
        let now = Date().timeIntervalSince1970
        replayStart = Date(); replayEnd = now; replayFrom = now - 86400
        if mode == .live { data.quakes.forEach { played.insert($0.id) } }
        lastChord = -100; lastChoir = -100
    }

    /// The moment being heard (seconds since 1970)
    private var t: Double {
        guard mode == .replay else { return Date().timeIntervalSince1970 }
        let frac = Date().timeIntervalSince(replayStart) / replaySeconds
        if frac >= 1 { replayStart = Date(); played.removeAll(); return replayFrom }
        return replayFrom + frac * (replayEnd - replayFrom)
    }

    private func tick() {
        guard isPlaying else { return }
        let now = t, wall = Date().timeIntervalSince1970
        clock = Date(timeIntervalSince1970: now)
        for k in hits.keys { hits[k] = max(0, (hits[k] ?? 0) - 0.04) }

        // quakes: each one plays when its time passes (max 12 a second, like the site's density cap)
        var budget = 3
        for q in data.quakes where !played.contains(q.id) && q.time.timeIntervalSince1970 <= now {
            played.insert(q.id)
            guard budget > 0 else { continue }
            budget -= 1
            playQuake(q)
        }
        // flares: the X-ray class rising into C, M or X rings the bells
        let xf = data.xray.at(now), xc = Music.flareClass(xf).first
        if let last = lastXClass, let xc, "CMX".contains(xc), let a = "ABCMX".firstIndex(of: xc), let b = "ABCMX".firstIndex(of: last), a > b {
            if !muted.contains("x") { synth.dsp.flare() }
            emit(PlayedEvent(layer: "x", text: "Flare \(Music.flareClass(xf))", note: Music.root + 24))
        }
        lastXClass = xc
        updateEngine(now, wall: wall)
    }

    private func playQuake(_ q: Quake) {
        let kpq = data.kp(at: q.time.timeIntervalSince1970)
        let n = Music.quakeNote(depth: q.depth, kp: kpq), vel = Music.velocity(mag: q.mag)
        if !muted.contains("q") { synth.dsp.quake(note: n.note, vel: vel, mag: q.mag, depth: q.depth, pan: Music.quakePan(lon: q.lon)) }
        hits["q"] = min(1, (hits["q"] ?? 0) + mapv(q.mag, 1, 6, 0.25, 1))
        emit(PlayedEvent(layer: "q", text: String(format: "M%.1f · %@ · %d km deep → %@", q.mag, q.place, Int(q.depth.rounded()), Music.noteName(n.note)), note: n.note, lat: q.lat, lon: q.lon, mag: q.mag))
    }

    private func emit(_ e: PlayedEvent) {
        events.insert(e, at: 0)
        if events.count > 40 { events.removeLast(events.count - 40) }
        onEvent?(e)
    }

    private func updateEngine(_ t: Double, wall: Double) {
        let sp = data.speed.at(t), de = data.density.at(t), bz = data.bz.at(t), bt = data.bt.at(t)
        kp = data.kp(at: t)
        var g = targets
        g.mute = muted
        if sp.isFinite {
            g.padCut = mapv(sp, 250, 900, 260, 4200) * (bz < -5 ? 0.6 : 1)
            g.padQ = mapv(de.isFinite ? de : 5, 0, 25, 1, 6) // density → resonance; 1…9 made a dense wind whistle (same as the site)
            g.padLfoRate = mapv(bt.isFinite ? bt : 5, 0, 30, 0.04, 0.5)
            g.padGain = mapv(de.isFinite ? de : 5, 0, 20, 0.32, 0.55)
        } else { g.padGain = 0.4 }
        let sc = Music.scale(kp: kp)
        if wall - lastChord > Music.chordEvery {
            lastChord = wall; chordIx = (chordIx + 1) % Music.progClassic.count
            let ch = Music.progClassic[chordIx]
            for v in 0..<4 { g.padFreqs[v] = Music.mtof(Music.degree(sc, ch[v], base: Music.root - 12)) }
            let dark = bz.isFinite && bz < -8
            for v in 0..<4 { g.padVoiceGain[v] = 0.05 * (dark && v == 3 ? 1.4 : 1) }
            hits["s"] = 0.6
        }
        let oc = data.ocean(at: t)
        g.surfGain = mapv(oc.h, 0, 6, 0.05, 0.42); g.surfRate = 1 / max(3, oc.p); g.surfBP = mapv(oc.p, 4, 16, 1400, 380)
        let xf = data.xray.at(t), lx = xf.isFinite && xf > 0 ? log10(xf) : -8
        g.shimGain = mapv(lx, -8, -4, 0, 0.16); g.shimBP = mapv(lx, -8, -4, 2000, 9000)
        let jv = data.jet(at: t)
        if jv.isFinite {
            g.windBP1 = mapv(jv, 60, 320, 280, 1500); g.windBP2 = mapv(jv, 60, 320, 600, 2600)
            g.windGain = mapv(jv, 60, 320, 0.08, 0.5); g.windLfo = mapv(jv, 60, 320, 0.05, 0.3)
        } else { g.windGain = 0 }
        g.tideGain = 0.11; g.tideDetune = data.tideNorm(at: t) * 50
        g.choirGain = data.temps.isEmpty ? 0 : 0.9
        if wall - lastChoir > 20, !data.temps.isEmpty {
            lastChoir = wall
            for (i, c) in data.temps.prefix(10).enumerated() {
                let T = c.series.at(t)
                if T.isFinite { g.choirFreqs[i] = Music.mtof(Music.chordNote(tempC: T, kp: kp)) }
            }
            hits["c"] = 0.8
            emit(PlayedEvent(layer: "c", text: "Planet chord: " + data.temps.prefix(5).map { "\($0.place.name) \(Int($0.series.at(t).rounded()))°" }.joined(separator: ", "), note: nil))
        }
        targets = g
        synth.dsp.update(g)
        synth.setRoom(moon: moonIllumination(Date(timeIntervalSince1970: t)))
    }
}
