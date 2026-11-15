import Foundation
import Combine

/// Native control loop: js/ui.js tick() + js/audio.js updateEngine() + schedulePulse() inputs, for all 13 layers.
/// Every parameter is set from a measurement through a fixed rule. Same reading, same note.
@MainActor
final class Conductor: ObservableObject {
    enum Mode: String, CaseIterable, Identifiable { case live = "Live", replay = "Last 24 hours"; var id: String { rawValue } }

    @Published private(set) var data = EarthReadings()
    @Published private(set) var more = MoreReadings()
    @Published private(set) var isPlaying = false
    @Published var mode: Mode = .live { didSet { if isPlaying { restartClock() } } }
    @Published private(set) var events: [PlayedEvent] = []
    @Published private(set) var clock = Date()
    @Published private(set) var kp = 2.0
    @Published private(set) var hits: [Character: Double] = [:]
    /// 0…1 activity per layer for the meter (continuous level or the last hit)
    @Published private(set) var levels: [Character: Double] = [:]
    @Published var muted = Set<Character>() { didSet { persistMix() } }
    @Published var solo: Character? = nil
    @Published var config = Store.loadConfig() { didSet { if config != oldValue { Store.save(config); configChanged(oldValue) } } }
    @Published var presetName: String? = Store.lastPreset
    /// Zones: one region for the place-based layers, held still or swept around the planet
    @Published var zone = "world" { didSet { sweptIDs.removeAll() } }
    @Published var sweep = false { didSet { sweptIDs.removeAll(); sweepStart = Date() } }
    @Published private(set) var sweepLon = 0.0
    /// Zeus Mode: the sandbox. Nothing in it is real data.
    @Published var zeus = false { didSet { if zeus != oldValue { zeusChanged() } } }
    @Published private(set) var zeusMarks: [ZeusMark] = []
    @Published var zeusAurora = 0.0
    @Published private(set) var flash = 0.0
    @Published private(set) var bpm = 0.0
    @Published private(set) var tempoText = ""
    @Published private(set) var issNow: (lat: Double, lon: Double, alt: Double)? = nil
    @Published private(set) var sleepAt: Date? = nil
    @Published private(set) var replayFrac = 0.0

    let synth = NativeSynth()
    var onEvent: ((PlayedEvent) -> Void)?
    var onState: (() -> Void)?
    var kicks: Int { synth.dsp.kicks }

    struct ZeusMark: Identifiable { let id = UUID(); let kind: String; let lat: Double; let lon: Double; let mag: Double; let at = Date() }

    private var timer: Timer?
    private var refreshTimer: Timer?
    private var played = Set<String>()
    private var sweptIDs = Set<String>()
    private var sweepStart = Date()
    private var replayStart = Date(), replayFrom = 0.0, replayEnd = 0.0
    let replaySeconds = 180.0
    private var lastChord = -100.0, chordIx = 0, lastChoir = -100.0
    private var lastXClass: Character?
    private var targets = SynthTargets()
    private var issArc: Int?
    private var sunUp: [Bool?] = Array(repeating: nil, count: SunCities.all.count)
    private var lastSunCheck = 0.0
    private var tempoBPM = 0.0, tempoLast = Date()
    private var stormOverride: (lat: Double, lon: Double, until: Date)?
    private var zeusTideUntil = Date.distantPast

    var modeLabel: String { mode == .live ? "LIVE · events play as the sensors publish them" : "Replaying the last 24 h at \(Int(86400 / replaySeconds))× speed" }

    init() {
        if let m = UserDefaults.standard.string(forKey: "tv.muted") { muted = Set(m) }
    }
    private func persistMix() { UserDefaults.standard.set(String(muted), forKey: "tv.muted") }

    func load() async {
        if let cached = EarthData.cached() { data = cached; kp = cached.kpNow }
        async let d = EarthData.load(), m = MoreReadings.load()
        let (dd, mm) = await (d, m)
        data = dd; more = mm
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
        sleepAt = nil
        onState?()
    }

    // MARK: producer + presets
    func applyPreset(_ p: FactoryPreset) { config = ProducerConfig.preset(p); presetName = p.id; Store.lastPreset = p.id }
    func applyUserPreset(_ name: String, _ c: ProducerConfig) { config = c; presetName = name; Store.lastPreset = name }
    func saveUserPreset() -> String {
        var all = Store.userPresets()
        var n = 1
        while all["My mix \(n)"] != nil { n += 1 }
        let name = "My mix \(n)"
        all[name] = config; Store.saveUserPresets(all); presetName = name
        return name
    }
    func resetProducer() { config = ProducerConfig(); presetName = nil; Store.lastPreset = nil }
    private func configChanged(_ old: ProducerConfig) {
        if presetName != nil, let p = Tunings.presets.first(where: { $0.id == presetName }), ProducerConfig.preset(p) != config { presetName = nil }
        if config.root != old.root || config.scale != old.scale || config.prog != old.prog { lastChord = -100; lastChoir = -100 }
        if config.style != old.style || config.bpmMin != old.bpmMin || config.bpmMax != old.bpmMax { tempoBPM = 0 }
    }
    /// The level the engine gives a layer: producer level × mute × solo (× Zeus fade)
    func effectiveLevel(_ k: Character) -> Double {
        if muted.contains(k) { return 0 }
        if let s = solo, s != k { return 0 }
        var v = config.level(k)
        if k == "r" && config.style != "pulse" { v = 0 }
        if zeus { v *= 0.12 }
        return v
    }

    // MARK: replay + sleep
    func seek(_ frac: Double) {
        guard mode == .replay else { return }
        let f = clamp(frac, 0, 0.999)
        replayStart = Date().addingTimeInterval(-f * replaySeconds)
        let t = replayFrom + f * (replayEnd - replayFrom)
        played = Set(data.quakes.filter { $0.time.timeIntervalSince1970 <= t }.map(\.id))
        replayFrac = f
    }
    func setSleep(minutes: Int?) { sleepAt = minutes.map { Date().addingTimeInterval(Double($0) * 60) } }

    // MARK: Zeus Mode (sandbox: you are the weather)
    func zeusQuake(lat: Double, lon: Double, mag: Double) {
        let depth = Double.random(in: 5...320)
        let sc = config.steps(kp: zeusKp), steps = sc.count * 3
        let note = degree(sc, jsRound(mapv(depth, 0, 700, Double(steps - 1), 0)), base: config.root)
        synth.dsp.quake(note: note, vel: Music.velocity(mag: mag), mag: mag, depth: depth, pan: Music.quakePan(lon: lon), inst: config.instQ, len: config.len, root: config.root)
        if mag >= 4.5 { synth.dsp.triggerFill() }
        zeusMarks.append(ZeusMark(kind: "quake", lat: lat, lon: lon, mag: mag))
        hits["q"] = 1
        emit(PlayedEvent(layer: "q", text: String(format: "Zeus · M%.1f quake you struck → %@", mag, Music.noteName(note)), note: note, lat: lat, lon: lon, mag: mag))
    }
    func zeusFlare() {
        synth.dsp.flare(root: config.root); flash = 1
        zeusMarks.append(ZeusMark(kind: "flare", lat: 0, lon: 0, mag: 1))
        emit(PlayedEvent(layer: "x", text: "Zeus · X-class flare", note: config.root + 24))
    }
    func zeusStorm(lat: Double, lon: Double) {
        stormOverride = (lat, lon, Date().addingTimeInterval(14))
        zeusMarks.append(ZeusMark(kind: "storm", lat: lat, lon: lon, mag: 1))
        emit(PlayedEvent(layer: "e", text: "Zeus · storm spun up", note: nil, lat: lat, lon: lon))
    }
    func zeusTide() {
        zeusTideUntil = Date().addingTimeInterval(10)
        zeusMarks.append(ZeusMark(kind: "tide", lat: 0, lon: 0, mag: 1))
        emit(PlayedEvent(layer: "t", text: "Zeus · the moon pulls the tide", note: nil))
    }
    private var zeusKp: Double { clamp(2 + zeusAurora * 5, 0, 9) }
    private func zeusChanged() {
        if zeus { zeusAurora = 0; zeusMarks.removeAll(); if !isPlaying { play() } }
        else { stormOverride = nil; zeusAurora = 0 }
    }

    private func refresh() async {
        async let f = EarthData.load(), m = MoreReadings.load()
        let (fresh, mm) = await (f, m)
        var byId = Dictionary(uniqueKeysWithValues: data.quakes.map { ($0.id, $0) })
        for q in fresh.quakes { byId[q.id] = q }
        var merged = fresh
        merged.quakes = byId.values.filter { $0.time.timeIntervalSinceNow > -86400 * 1.05 }.sorted { $0.time < $1.time }
        data = merged
        if !mm.events.isEmpty || mm.tle != nil { more = mm }
    }

    private func restartClock() {
        played.removeAll()
        let now = Date().timeIntervalSince1970
        replayStart = Date(); replayEnd = now; replayFrom = now - 86400
        if mode == .live { data.quakes.forEach { played.insert($0.id) } }
        lastChord = -100; lastChoir = -100; issArc = nil
        sunUp = Array(repeating: nil, count: SunCities.all.count)
    }

    /// The moment being heard (seconds since 1970)
    private var t: Double {
        guard mode == .replay else { return Date().timeIntervalSince1970 }
        let frac = Date().timeIntervalSince(replayStart) / replaySeconds
        if frac >= 1 { replayStart = Date(); played.removeAll(); sunUp = Array(repeating: nil, count: SunCities.all.count); return replayFrom }
        return replayFrom + frac * (replayEnd - replayFrom)
    }

    // MARK: rules
    private func degree(_ sc: [Int], _ i: Int, base: Int) -> Int { Music.degree(sc, i, base: base) }
    private func quakeNote(_ q: Quake) -> Int {
        let sc = config.steps(kp: data.kp(at: q.time.timeIntervalSince1970)), steps = sc.count * 3
        return degree(sc, jsRound(mapv(q.depth, 0, 700, Double(steps - 1), 0)), base: config.root)
    }
    /// Whether a place is inside the current zone (and the sweep band when sweeping)
    func inZone(lat: Double, lon: Double) -> Bool {
        if sweep {
            var d = abs(lon - sweepLon).truncatingRemainder(dividingBy: 360); if d > 180 { d = 360 - d }
            if d > 22 { return false }
        }
        return Tunings.inRegion(zone, lat: lat, lon: lon)
    }
    private func passQ(_ q: Quake) -> Bool {
        q.mag >= config.mmin && Tunings.inRegion(config.region, lat: q.lat, lon: q.lon) && Tunings.inRegion(zone, lat: q.lat, lon: q.lon)
    }

    private func tick() {
        guard isPlaying else { return }
        if let s = sleepAt, Date() >= s { stop(); return }
        let now = t, wall = Date().timeIntervalSince1970
        clock = Date(timeIntervalSince1970: now)
        if mode == .replay { replayFrac = clamp(Date().timeIntervalSince(replayStart) / replaySeconds, 0, 1) }
        for k in hits.keys { hits[k] = max(0, (hits[k] ?? 0) - 0.04) }
        flash = max(0, flash - 0.03)
        zeusMarks.removeAll { $0.at.timeIntervalSinceNow < -8 }
        if sweep { sweepLon = -180 + (Date().timeIntervalSince(sweepStart).truncatingRemainder(dividingBy: replaySeconds)) / replaySeconds * 360 }

        if !zeus {
            if sweep {
                // the zone is a playhead: each quake from the last day plays as the band passes over it
                var budget = 3
                for q in data.quakes where !sweptIDs.contains(q.id) && passQ(q) && inZone(lat: q.lat, lon: q.lon) {
                    sweptIDs.insert(q.id)
                    guard budget > 0 else { continue }
                    budget -= 1; playQuake(q)
                }
                if abs(sweepLon - 180) < 1.5 { sweptIDs.removeAll() }
            } else {
                var budget = 3
                for q in data.quakes where !played.contains(q.id) && q.time.timeIntervalSince1970 <= now {
                    played.insert(q.id)
                    guard budget > 0, passQ(q) else { continue }
                    budget -= 1
                    playQuake(q)
                }
            }
            let xf = data.xray.at(now), xc = Music.flareClass(xf).first
            if let last = lastXClass, let xc, "CMX".contains(xc), let a = "ABCMX".firstIndex(of: xc), let b = "ABCMX".firstIndex(of: last), a > b {
                if effectiveLevel("x") > 0 { synth.dsp.flare(root: config.root) }
                hits["x"] = 1
                emit(PlayedEvent(layer: "x", text: "Flare \(Music.flareClass(xf)) → bells", note: config.root + 24))
            }
            lastXClass = xc
            sunrise(now)
        }
        updateEngine(now, wall: wall)
    }

    private func playQuake(_ q: Quake) {
        let n = quakeNote(q), vel = Music.velocity(mag: q.mag)
        if effectiveLevel("q") > 0 {
            synth.dsp.quake(note: n, vel: vel, mag: q.mag, depth: q.depth, pan: Music.quakePan(lon: q.lon), inst: config.instQ, len: config.len, root: config.root)
            if q.mag >= 4.5 { synth.dsp.triggerFill() }
        }
        hits["q"] = min(1, (hits["q"] ?? 0) + mapv(q.mag, 1, 6, 0.25, 1))
        emit(PlayedEvent(layer: "q", text: String(format: "M%.1f · %@ · %d km deep → %@", q.mag, q.place, Int(q.depth.rounded()), Music.noteName(n)), note: n, lat: q.lat, lon: q.lon, mag: q.mag))
    }

    /// js sunChime(): a chime when the sun actually rises or sets over a big city
    private func sunrise(_ now: Double) {
        guard abs(now - lastSunCheck) >= 20 || lastSunCheck == 0 else { return }
        lastSunCheck = now
        let sp = Astro.sunPos(now), sc = config.steps(kp: kp)
        for (i, c) in SunCities.all.enumerated() {
            let up = Astro.sunElev(c.1, c.2, sp) > -0.833
            defer { sunUp[i] = up }
            guard let prev = sunUp[i], prev != up, inZone(lat: c.1, lon: c.2) else { continue }
            let n = degree(sc, jsRound(mapv(c.1, -40, 65, 1, 12)), base: config.root + 12)
            let vel = jsRound(mapv(log10(c.3 + 0.1), -0.6, 1.6, 50, 118))
            if effectiveLevel("u") > 0 {
                synth.dsp.chime(note: n, vel: vel, rise: up, pan: clamp(c.2 / 180, -1, 1) * 0.85, third: sc.contains(4) ? 4 : 3, inst: config.instU)
            }
            hits["u"] = 1
            emit(PlayedEvent(layer: "u", text: "\(up ? "Sunrise" : "Sunset") over \(c.0) → \(Music.noteName(n))", note: n, lat: c.1, lon: c.2))
        }
    }

    private func emit(_ e: PlayedEvent) {
        events.insert(e, at: 0)
        if events.count > 40 { events.removeLast(events.count - 40) }
        onEvent?(e)
    }

    private func tempo(_ t: Double, sp: Double, jv: Double, tn: Double, rate: Int, storms: Int) -> Double {
        let c = config
        if c.bpmLock > 0 { tempoText = "Locked at \(Int(c.bpmLock)) BPM"; return c.bpmLock }
        var n: Double, txt: String
        switch c.tempoSrc {
        case "quakes": n = mapv(Double(rate), 0, 20, 0, 1); txt = "\(rate) quakes in the last hour"
        case "tides": n = mapv(tn, -1, 1, 0, 1); txt = "tide at \(Int((tn + 1) * 50))% of today's range"
        case "kp": n = mapv(kp, 0, 7, 0, 1); txt = String(format: "Kp %.1f", kp)
        case "jet": n = mapv(jv, 90, 260, 0, 1); txt = jv.isFinite ? "jet stream \(Int(jv)) km/h" : "jet stream loading"
        case "storms": n = mapv(Double(storms), 0, 8, 0, 1); txt = "\(storms) active storms"
        default: n = mapv(sp, 280, 800, 0, 1); txt = sp.isFinite ? "solar wind \(Int(sp)) km/s" : "solar wind loading"
        }
        let target = lerp(c.bpmMin, max(c.bpmMin, c.bpmMax), clamp(n, 0, 1))
        let dt = min(2, Date().timeIntervalSince(tempoLast)); tempoLast = Date()
        if tempoBPM == 0 || abs(tempoBPM - target) > 40 { tempoBPM = target }
        else { tempoBPM += clamp((target - tempoBPM) * (1 - exp(-dt / 6)), -1.5 * dt, 1.5 * dt) }
        tempoText = "\(Tunings.tempoNames[c.tempoSrc] ?? "Solar wind"): \(txt) → \(String(format: "%.1f", tempoBPM)) BPM"
        return tempoBPM
    }

    private func updateEngine(_ t: Double, wall: Double) {
        let c = config
        let sp = data.speed.at(t), de = data.density.at(t), bz = data.bz.at(t), bt = data.bt.at(t)
        kp = zeus ? zeusKp : data.kp(at: t)
        var g = targets
        g.mute = []
        g.vol = Layer.keys.map { effectiveLevel($0) }
        g.root = c.root
        let sc = c.steps(kp: kp)
        g.scale = sc
        if sp.isFinite {
            g.padCut = mapv(sp, 250, 900, 260, 4200) * (bz < -5 ? 0.6 : 1)
            g.padQ = mapv(de.isFinite ? de : 5, 0, 25, 1, 6)
            g.padLfoRate = mapv(bt.isFinite ? bt : 5, 0, 30, 0.04, 0.5)
            g.padGain = mapv(de.isFinite ? de : 5, 0, 20, 0.32, 0.55)
        } else { g.padGain = 0.4 }
        g.padWave = ["saw": 0, "hollow": 1, "soft": 2, "glass": 3][c.instS] ?? 0
        let prog = c.progression(kp: kp)
        if wall - lastChord > c.chordEvery {
            lastChord = wall; chordIx = (chordIx + 1) % prog.count
            let ch = prog[chordIx]
            for v in 0..<4 { g.padFreqs[v] = Music.mtof(degree(sc, ch[v], base: c.root - 12)) }
            let dark = bz.isFinite && bz < -8
            for v in 0..<4 { g.padVoiceGain[v] = 0.05 * (dark && v == 3 ? 1.4 : 1) }
            hits["s"] = 0.6
        }
        let oc = data.ocean(at: t)
        g.surfGain = mapv(oc.h, 0, 6, 0.05, 0.42); g.surfRate = 1 / max(3, oc.p); g.surfBP = mapv(oc.p, 4, 16, 1400, 380)
        let xf = data.xray.at(t), lx = xf.isFinite && xf > 0 ? log10(xf) : -8
        g.shimGain = mapv(lx, -8, -4, 0, 0.16) + (zeus ? zeusAurora * 0.6 : 0); g.shimBP = mapv(lx, -8, -4, 2000, 9000)
        let jv = data.jet(at: t)
        if jv.isFinite {
            g.windBP1 = mapv(jv, 60, 320, 280, 1500); g.windBP2 = mapv(jv, 60, 320, 600, 2600)
            g.windGain = mapv(jv, 60, 320, 0.08, 0.5); g.windLfo = mapv(jv, 60, 320, 0.05, 0.3)
        } else { g.windGain = 0 }
        let tn = data.tideNorm(at: t)
        g.tideGain = c.style == "pulse" ? 0.058 : 0.11
        g.tideDetune = (Date() < zeusTideUntil ? sin(Date().timeIntervalSince1970 * 0.8) : tn) * 50
        if zeus && Date() < zeusTideUntil { g.vol[Layer.ix("t")] = max(g.vol[Layer.ix("t")], 1) }
        // planet chord (city weights follow the zone)
        g.choirGain = data.temps.isEmpty ? 0 : 0.9
        for (i, p) in EarthData.cities.enumerated() where i < 10 { g.choirVoice[i] = inZone(lat: p.lat, lon: p.lon) ? 1 : 0 }
        if wall - lastChoir > 20, !data.temps.isEmpty {
            lastChoir = wall
            for (i, city) in data.temps.prefix(10).enumerated() {
                let T = city.series.at(t)
                if T.isFinite { g.choirFreqs[i] = Music.mtof(degree(sc, jsRound(mapv(T, -30, 45, 0, Double(sc.count * 3 - 1))), base: c.root)) }
            }
            hits["c"] = 0.8
            if !zeus { emit(PlayedEvent(layer: "c", text: "Planet chord: " + data.temps.prefix(5).map { "\($0.place.name) \(Int($0.series.at(t).rounded()))°" }.joined(separator: ", "), note: nil)) }
        }
        // air: PM2.5 → level, UV → brightness
        let air = more.air(at: t)
        if air.pm.isFinite { g.airGain = mapv(air.pm, 0, 60, 0.02, 0.22); g.airBP = mapv(air.uv.isFinite ? air.uv : 3, 0, 10, 700, 5200) } else { g.airGain = 0 }
        // space station: beacon pitch from latitude, a pluck every 5° of track, brighter over land
        let p = more.iss(at: t)
        issNow = p
        let lit = Astro.sunElev(p.lat, p.lon, Astro.sunPos(t)) > -18
        let issOK = inZone(lat: p.lat, lon: p.lon)
        g.issFreq = Music.mtof(degree(sc, jsRound(mapv(p.lat, -52, 52, 0, Double(sc.count * 2))), base: c.root + 12))
        g.issGain = issOK ? (lit ? 0.035 : 0.018) : 0; g.issPan = clamp(p.lon / 180, -1, 1) * 0.85
        let arc = Int((p.lon + 180) / 5)
        if let last = issArc, last != arc, issOK, !zeus {
            let land = Land.contains(lat: p.lat, lon: p.lon)
            let n = degree(sc, jsRound(mapv(p.lat, -52, 52, 0, Double(sc.count * 2))) + (land ? 2 : 0), base: c.root + 12)
            if effectiveLevel("i") > 0 { synth.dsp.pluck(note: n, vel: land ? 96 : 64, pan: g.issPan, land: land, inst: c.instI) }
            hits["i"] = land ? 0.9 : 0.5
            if land { emit(PlayedEvent(layer: "i", text: String(format: "Space station over land at %.0f°, %.0f° → %@", p.lat, p.lon, Music.noteName(n)), note: n, lat: p.lat, lon: p.lon)) }
        }
        issArc = arc
        // natural events: fires = embers, volcanoes = drone voices, storms = swirl
        let act = more.events.filter { $0.start <= t && inZone(lat: $0.lat, lon: $0.lon) }
        let fires = act.filter { $0.kind == .fire }.count, vols = act.filter { $0.kind == .volcano }.count
        var storms = act.filter { $0.kind == .storm }.count
        if let zs = stormOverride, Date() < zs.until { storms = max(storms, 8); g.vol[Layer.ix("e")] = max(g.vol[Layer.ix("e")], 1) }
        for i in 0..<6 { g.volcanoGains[i] = i < vols ? 0.04 * clamp(Double(vols - i), 0, 1) : 0 }
        g.volcanoRoot = c.root - 12
        g.stormGain = mapv(Double(storms), 0, 8, 0, 0.28); g.stormRate = mapv(Double(storms), 0, 8, 0.05, 0.6)
        if fires > 0 { let rate = clamp(Double(fires) / 14, 0.3, 7); g.emberRate = rate; g.emberLevel = 0.07 / sqrt(max(1, rate / 1.5)) } else { g.emberRate = 0 }
        // magnetosphere: Dst depth → drone, protons → glitter (Zeus aurora deepens it)
        let dst = data.dst.at(t) - (zeus ? zeusAurora * 150 : 0), pf = more.protons.at(t)
        let dd = dst.isFinite ? dst : 0
        g.magGain = mapv(-dd, -10, 150, 0, 0.27); g.magRatio = mapv(-dd, 0, 200, 1.414, 2.618)
        if zeus && zeusAurora > 0.05 { g.vol[Layer.ix("g")] = max(g.vol[Layer.ix("g")], zeusAurora) }
        g.glitterRate = pf.isFinite && pf > 0 ? clamp(mapv(log10(pf), -1, 3, 0.15, 12), 0.15, 12) : 0
        // Pulse
        g.pulse = c.style == "pulse"
        if g.pulse {
            let rate = data.quakes.filter { $0.time.timeIntervalSince1970 > t - 3600 && $0.time.timeIntervalSince1970 <= t }.count
            g.bpm = tempo(t, sp: sp, jv: jv, tn: tn, rate: rate, storms: storms)
            bpm = g.bpm
            g.groove = Tunings.grooves[c.pattern]?.1 ?? Tunings.grooves["four"]!.1
            g.swing = clamp(c.swing, 0, 0.5); g.duck = c.duck
            g.hatP = clamp(mapv(Double(rate), 0, 20, 0.55, 1) * c.hats, 0, 1); g.extraP = clamp(mapv(Double(rate), 5, 30, 0, 0.35) * c.hats, 0, 0.5)
            g.ghost = kp >= 4 ? 0.18 : kp >= 3 ? 0.08 : 0
            g.tideNorm = tn
            g.bassWave = ["sawtooth": 0, "sine": 1, "square": 2][c.bass] ?? 0
        } else { bpm = 0; tempoText = "" }
        g.lowpass = c.mlp; g.drive = max(0, c.drive - 0.2) * 1.2
        // meter: continuous layers show their level, struck layers their last hit
        var lv: [Character: Double] = [:]
        lv["s"] = g.padGain / 0.55; lv["o"] = g.surfGain / 0.42; lv["x"] = max(g.shimGain / 0.16, hits["x"] ?? 0); lv["w"] = g.windGain / 0.5
        lv["t"] = 0.4 + 0.3 * abs(tn); lv["c"] = max(0.35, hits["c"] ?? 0); lv["a"] = g.airGain / 0.22
        lv["g"] = max(g.magGain / 0.27, min(1, g.glitterRate / 12)); lv["e"] = max(g.stormGain / 0.28, min(1, g.emberRate / 7), Double(vols) / 6)
        lv["i"] = max(g.issGain / 0.035 * 0.5, hits["i"] ?? 0); lv["q"] = hits["q"] ?? 0; lv["u"] = hits["u"] ?? 0
        lv["r"] = g.pulse ? 0.5 + 0.5 * abs(sin(Date().timeIntervalSince1970 * .pi * bpm / 60)) : 0
        for k in Layer.keys { lv[k] = clamp((lv[k] ?? 0) * (effectiveLevel(k) > 0 ? 1 : 0), 0, 1) }
        levels = lv
        targets = g
        synth.dsp.update(g)
        synth.setRoom(type: c.revType, wet: c.rev)
        synth.setRoom(moon: moonIllumination(Date(timeIntervalSince1970: t)))
    }
}
