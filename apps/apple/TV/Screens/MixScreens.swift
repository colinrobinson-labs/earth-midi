import SwiftUI

// MARK: - Layers

struct LayersScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var hub: PlayerHub
    @FocusState private var focus: Character?
    private let cols = Array(repeating: GridItem(.fixed(330), spacing: 26), count: 5)

    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            ScreenTitle(title: "Layers", hint: "Click: mute · Play/Pause: solo")
            LazyVGrid(columns: cols, alignment: .leading, spacing: 26) {
                ForEach(TV.order, id: \.self) { k in tile(k) }
            }
            Spacer(minLength: 0)
            if let f = focus { Text(TV.what[f] ?? "").font(.system(size: 26)).foregroundStyle(Theme.fg2).frame(height: 40) }
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
        .onAppear { focus = "q" }
        .onPlayPauseCommand {
            guard let f = focus else { return }
            c.solo = c.solo == f ? nil : f
            if !c.isPlaying { hub.play() }
        }
    }

    private func tile(_ k: Character) -> some View {
        let m = c.muted.contains(k), s = c.solo == k, off = c.effectiveLevel(k) == 0
        let pulseOff = k == "r" && c.config.style != "pulse"
        return Button {
            if m { c.muted.remove(k) } else { c.muted.insert(k) }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Circle().fill(Theme.color(k)).frame(width: 16, height: 16)
                    Spacer()
                    if TV.newLayers.contains(k) { Text("NEW").font(Theme.caps(14)).foregroundStyle(Theme.color(k)) }
                }
                Text(Theme.name(k)).font(.system(size: 27, weight: .semibold)).foregroundStyle(Theme.fg).lineLimit(1).minimumScaleFactor(0.7)
                Text(s ? "Solo" : m ? "Muted" : pulseOff ? "Pulse style only" : "On · \(Int(c.config.level(k) * 100))%")
                    .font(Theme.mono(20)).foregroundStyle(s ? Theme.color(k) : Theme.fg2)
                Spacer(minLength: 0)
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.08))
                    Capsule().fill(Theme.color(k)).frame(width: 282 * (c.levels[k] ?? 0))
                }.frame(height: 8)
            }
            .padding(22).frame(width: 330, height: 190, alignment: .topLeading)
            .opacity(off && !s ? 0.45 : 1)
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(s ? Theme.color(k) : .clear, lineWidth: 3))
        }
        .buttonStyle(TileStyle(tint: Theme.color(k)))
        .focused($focus, equals: k)
    }
}

// MARK: - Producer

struct ProducerScreen: View {
    @EnvironmentObject var c: Conductor
    @State private var tab = 0
    @FocusState private var tabFocus: Int?
    private let tabs = ["Sound", "Rhythm", "Mixer", "Space"]

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            ScreenTitle(title: "Producer", hint: c.presetName.map { "Preset: \($0)" } ?? "Your mix · saved on this Apple TV")
            HStack(spacing: 18) {
                ForEach(tabs.indices, id: \.self) { i in
                    Button { tab = i } label: { Text(tabs[i]) }
                        .buttonStyle(PillStyle(prominent: tab == i, tint: tab == i ? Theme.fg : Theme.fg2))
                        .focused($tabFocus, equals: i)
                }
                Spacer()
                Button { c.resetProducer() } label: { Label("Reset all", systemImage: "arrow.counterclockwise") }.buttonStyle(PillStyle(tint: Theme.fg2))
            }
            .onChange(of: tabFocus) { _, f in if let f { tab = f } }
            Group {
                switch tab {
                case 0: soundTab
                case 1: rhythmTab
                case 2: mixerTab
                default: spaceTab
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
        .onAppear { tabFocus = 0 }
    }

    private func grid<V: View>(@ViewBuilder _ v: () -> V) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.fixed(518), spacing: 30), count: 3), alignment: .leading, spacing: 30) { v() }
    }
    private func opts(_ order: [String], _ names: [String: String]) -> [(String, String)] { order.map { ($0, names[$0] ?? $0) } }

    private var soundTab: some View {
        grid {
            ChoiceCard(label: "Key", value: Tunings.keys[c.config.key] + (c.config.oct == 0 ? "" : c.config.oct > 0 ? " +\(c.config.oct) oct" : " \(c.config.oct) oct"), note: "Every layer moves together", tint: Theme.color("c"),
                       options: Tunings.keys.enumerated().map { ("\($0.offset)", $0.element) }) { c.config.key = Int($0) ?? 2 }
            ChoiceCard(label: "Scale", value: Tunings.scaleNames[c.config.scale] ?? c.config.scale, note: c.config.scale == "auto" ? "Calm sky major, storm minor: \(Music.scaleName(kp: c.kp))" : "Fixed scale", tint: Theme.color("g"),
                       options: opts(Tunings.scaleOrder, Tunings.scaleNames)) { c.config.scale = $0 }
            ChoiceCard(label: "Chord progression", value: Tunings.progNames[c.config.prog] ?? c.config.prog, note: "The solar wind pad's chords", tint: Theme.color("s"),
                       options: opts(Tunings.progOrder, Tunings.progNames)) { c.config.prog = $0 }
            ChoiceCard(label: "Chord change", value: "every \(Int(c.config.chordEvery)) s", note: "How long each chord holds", tint: Theme.color("s"),
                       options: [4, 8, 12, 16, 32].map { ("\($0)", "every \($0) s") }) { c.config.chordEvery = Double($0) ?? 8 }
            ChoiceCard(label: "Quake sound", value: Tunings.quakeInstNames[c.config.instQ] ?? "", note: "Magnitude sets how hard it's struck", tint: Theme.color("q"),
                       options: opts(Tunings.quakeInst, Tunings.quakeInstNames)) { c.config.instQ = $0 }
            ChoiceCard(label: "Smallest quake", value: c.config.mmin == 0 ? "All" : String(format: "M%.1f", c.config.mmin), note: "Skip the small ones", tint: Theme.color("q"),
                       options: [0, 1, 1.5, 2, 2.5, 3, 4].map { ("\($0)", $0 == 0 ? "All quakes" : String(format: "M%.1f and up", $0)) }) { c.config.mmin = Double($0) ?? 0 }
            ChoiceCard(label: "Quakes from", value: Tunings.regionNames[c.config.region] ?? "", note: "Region filter for the quake layer", tint: Theme.color("q"),
                       options: opts(Tunings.regions, Tunings.regionNames)) { c.config.region = $0 }
            ChoiceCard(label: "Solar wind pad", value: Tunings.padNames[c.config.instS] ?? "", note: "The pad's oscillator", tint: Theme.color("s"),
                       options: opts(Tunings.padTypes, Tunings.padNames)) { c.config.instS = $0 }
            ChoiceCard(label: "Station + sunrise", value: "\(Tunings.issNames[c.config.instI] ?? "") · \(Tunings.sunNames[c.config.instU] ?? "")", note: "Space station pluck and sunrise chime", tint: Theme.color("i"),
                       options: Tunings.issInst.flatMap { i in Tunings.sunInst.map { u in ("\(i)|\(u)", "\(Tunings.issNames[i]!) · \(Tunings.sunNames[u]!)") } }) { v in
                let p = v.split(separator: "|").map(String.init); if p.count == 2 { c.config.instI = p[0]; c.config.instU = p[1] } }
        }
    }

    private var rhythmTab: some View {
        VStack(alignment: .leading, spacing: 26) {
            grid {
                ChoiceCard(label: "Style", value: c.config.style == "pulse" ? "Pulse" : "Ambient", note: "Pulse adds drums and bass", tint: Theme.color("r"),
                           options: [("ambient", "Ambient"), ("pulse", "Pulse")]) { c.config.style = $0 }
                ChoiceCard(label: "Genre", value: Tunings.genres.first { $0.id == c.config.genre }?.name ?? "Custom", note: Tunings.genres.first { $0.id == c.config.genre }.map { "\($0.fam) · \(Int($0.lo))–\(Int($0.hi)) BPM · \($0.tip)" } ?? "Pick one to set groove, tempo and swing", tint: Theme.color("q"),
                           options: Tunings.genres.map { ($0.id, "\($0.fam) · \($0.name) · \(Int($0.lo))–\(Int($0.hi))") }) { Tunings.applyGenre($0, to: &c.config) }
                ChoiceCard(label: "Groove", value: Tunings.grooves[c.config.pattern]?.0 ?? c.config.pattern, note: "16-step kick, snare, hats and bass", tint: Theme.color("r"),
                           options: Tunings.grooves.keys.sorted().map { ($0, Tunings.grooves[$0]!.0) }) { c.config.pattern = $0; c.config.genre = "custom" }
                ChoiceCard(label: "Tempo from", value: Tunings.tempoNames[c.config.tempoSrc] ?? "", note: "The planet sets the BPM inside the range", tint: Theme.color("w"),
                           options: opts(Tunings.tempoSrc, Tunings.tempoNames)) { c.config.tempoSrc = $0 }
                ChoiceCard(label: "Tempo range", value: c.config.bpmLock > 0 ? "Locked \(Int(c.config.bpmLock))" : "\(Int(c.config.bpmMin))–\(Int(c.config.bpmMax)) BPM", note: "Or lock it", tint: Theme.color("w"),
                           options: [("r:70:88", "70–88"), ("r:84:96", "84–96"), ("r:112:134", "112–134"), ("r:124:136", "124–136"), ("r:130:140", "130–140"), ("r:170:174", "170–174"), ("l:82", "Lock 82"), ("l:100", "Lock 100"), ("l:120", "Lock 120"), ("l:124", "Lock 124"), ("l:128", "Lock 128"), ("l:174", "Lock 174")]) { v in
                    let p = v.split(separator: ":").map(String.init)
                    if p[0] == "l" { c.config.bpmLock = Double(p[1]) ?? 0 } else { c.config.bpmLock = 0; c.config.bpmMin = Double(p[1]) ?? 112; c.config.bpmMax = Double(p[2]) ?? 134 }
                }
                ChoiceCard(label: "Swing", value: "\(Int(c.config.swing * 100))%", note: "Delays every other 16th", tint: Theme.color("k"),
                           options: [0, 0.04, 0.08, 0.12, 0.16, 0.22, 0.3].map { ("\($0)", "\(Int($0 * 100))%") }) { c.config.swing = Double($0) ?? 0 }
                ChoiceCard(label: "Hats", value: c.config.hats < 0.8 ? "Sparse" : c.config.hats > 1.2 ? "Busy" : "Normal", note: "The last hour's quake count adds more", tint: Theme.color("r"),
                           options: [("0.6", "Sparse"), ("1.0", "Normal"), ("1.6", "Busy")]) { c.config.hats = Double($0) ?? 1 }
                ChoiceCard(label: "Bass", value: ["sawtooth": "Saw", "sine": "Sub sine", "square": "Square"][c.config.bass] ?? "Saw", note: "Follows the tide", tint: Theme.color("t"),
                           options: [("sawtooth", "Saw"), ("sine", "Sub sine"), ("square", "Square")]) { c.config.bass = $0 }
                ChoiceCard(label: "Sidechain", value: c.config.duck == 0 ? "Off" : "\(Int(c.config.duck * 100))%", note: "The kick ducks the pads", tint: Theme.color("r"),
                           options: [0, 0.25, 0.45, 0.65].map { ("\($0)", $0 == 0 ? "Off" : "\(Int($0 * 100))%") }) { c.config.duck = Double($0) ?? 0.45 }
            }
            if c.config.style == "pulse" && !c.tempoText.isEmpty { Text(c.tempoText).font(Theme.mono(22)).foregroundStyle(Theme.fg2) }
        }
    }

    private var mixerTab: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(TV.order, id: \.self) { k in LevelRow(k: k) }
            }
            .padding(.vertical, 20).padding(.horizontal, 10)
        }
        .frame(maxHeight: 760)
    }

    private var spaceTab: some View {
        grid {
            ChoiceCard(label: "Room", value: Tunings.roomNames[c.config.revType] ?? "", note: "The reverb's space", tint: Theme.color("o"),
                       options: opts(Tunings.rooms, Tunings.roomNames)) { c.config.revType = $0 }
            ChoiceCard(label: "Reverb amount", value: c.config.rev < 0 ? "Follows the moon" : "\(Int(c.config.rev * 100))%", note: "Full moon = wetter room", tint: Theme.color("o"),
                       options: [("-1", "Follows the moon"), ("0.3", "30%"), ("0.5", "50%"), ("0.7", "70%"), ("0.9", "90%")]) { c.config.rev = Double($0) ?? -1 }
            ChoiceCard(label: "Quake tail", value: String(format: "%.1f×", c.config.len), note: "How long each quake rings", tint: Theme.color("q"),
                       options: [0.5, 0.8, 1, 1.3, 1.6].map { ("\($0)", String(format: "%.1f×", $0)) }) { c.config.len = Double($0) ?? 1 }
            ChoiceCard(label: "Saturation", value: c.config.drive <= 0.2 ? "Clean" : c.config.drive < 0.5 ? "Warm" : "Tape", note: "Master drive", tint: Theme.color("s"),
                       options: [("0.2", "Clean"), ("0.45", "Warm"), ("0.6", "Tape")]) { c.config.drive = Double($0) ?? 0.2 }
            ChoiceCard(label: "Top end", value: c.config.mlp >= 19000 ? "Open" : "\(Int(c.config.mlp / 100) / 10) kHz", note: "Master low-pass", tint: Theme.color("s"),
                       options: [("20000", "Open"), ("12000", "12 kHz"), ("6500", "6.5 kHz"), ("3000", "3 kHz")]) { c.config.mlp = Double($0) ?? 20000 }
        }
    }
}

// MARK: - Presets

struct PresetsScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var hub: PlayerHub
    @EnvironmentObject var router: Router
    @State private var user = Store.userPresets()
    @State private var toast = ""
    @FocusState private var focus: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            ScreenTitle(title: "Presets", hint: "Pick one and the whole mix changes")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 34) {
                    ForEach(Tunings.presets) { p in card(p) }
                }
                .padding(.vertical, 40).padding(.horizontal, 20)
            }
            Caps(text: "Your mixes", size: 18)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 24) {
                    Button { let n = c.saveUserPreset(); user = Store.userPresets(); toast = "Saved as “\(n)”" } label: {
                        Label("Save current mix", systemImage: "plus")
                    }.buttonStyle(PillStyle(prominent: true))
                    Button { router.go(.share) } label: { Label("Open on iPhone", systemImage: "qrcode") }.buttonStyle(PillStyle())
                    ForEach(user.keys.sorted(), id: \.self) { n in
                        Button { c.applyUserPreset(n, user[n]!); if !c.isPlaying { hub.play() } } label: { Text(n) }
                            .buttonStyle(PillStyle(tint: c.presetName == n ? Theme.color("x") : Theme.fg))
                            .contextMenu { Button("Delete", role: .destructive) { user[n] = nil; Store.saveUserPresets(user) } }
                    }
                }
                .padding(.vertical, 20).padding(.horizontal, 20)
            }
            if !toast.isEmpty { Text(toast).font(Theme.mono(22)).foregroundStyle(Theme.fg2) }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
        .onAppear { focus = c.presetName ?? Tunings.presets.first?.id }
    }

    private func card(_ p: FactoryPreset) -> some View {
        let on = c.presetName == p.id
        return Button { c.applyPreset(p); if !c.isPlaying { hub.play() } } label: {
            ZStack(alignment: .topLeading) {
                RadialGradient(colors: [Theme.color(p.tint).opacity(0.38), .clear], center: .bottom, startRadius: 0, endRadius: 300)
                VStack(alignment: .leading, spacing: 14) {
                    Circle().fill(Theme.color(p.tint)).frame(width: 18, height: 18)
                    Text(p.id).font(Theme.title(34)).foregroundStyle(Theme.fg).lineLimit(2).minimumScaleFactor(0.7)
                    Text(p.line).font(.system(size: 22)).foregroundStyle(Theme.fg2).lineLimit(4)
                    Spacer()
                    HStack {
                        Text(p.tempo).font(Theme.caps(18)).foregroundStyle(Theme.color(p.tint))
                        Spacer()
                        if on { Image(systemName: "checkmark.circle.fill").font(.system(size: 28)).foregroundStyle(Theme.color(p.tint)) }
                    }
                }
                .padding(28)
            }
            .frame(width: 360, height: 430)
            .clipShape(RoundedRectangle(cornerRadius: 26))
        }
        .buttonStyle(TileStyle(tint: Theme.color(p.tint), corner: 26))
        .focused($focus, equals: p.id)
    }
}

// MARK: - More

struct MoreScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var router: Router
    private let cols = Array(repeating: GridItem(.fixed(400), spacing: 34), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: 34) {
            ScreenTitle(title: "More")
            LazyVGrid(columns: cols, alignment: .leading, spacing: 34) {
                if Features.v12 {
                    tile("Zones", "Only hear part of the planet, or sweep around it", "o", "scope") { router.go(.zones) }
                    tile("Last 24 hours", "Scrub through the whole day", "q", "clock.arrow.circlepath") { router.go(.replay) }
                }
                tile("Ambient mode", "Just the planet and the time, all night", "g", "moon.stars") { router.go(.ambient) }
                tile("Readings", "Every sensor and where it comes from", "s", "waveform.path.ecg") { router.go(.readings) }
                tile("Explore the globe", "Spin and tilt the planet yourself", "w", "globe") { router.go(.explore) }
                tile("Open on iPhone", "A QR code with this exact mix", "c", "qrcode") { router.go(.share) }
                Menu {
                    Button("Off") { c.setSleep(minutes: nil) }
                    ForEach([15, 30, 60, 90, 120], id: \.self) { m in Button("\(m) minutes") { c.setSleep(minutes: m) } }
                } label: {
                    tileLabel("Sleep timer", c.sleepAt.map { "Stops at \($0.formatted(date: .omitted, time: .shortened))" } ?? "Fade out after a while", "t", "bed.double")
                }
                tile("How it works", "Every note from a real reading", "x", "info.circle") { router.go(.about) }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
    }

    private func tile(_ t: String, _ s: String, _ k: Character, _ icon: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) { tileLabel(t, s, k, icon) }.buttonStyle(TileStyle(tint: Theme.color(k)))
    }
    private func tileLabel(_ t: String, _ s: String, _ k: Character, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon).font(.system(size: 40, weight: .medium)).foregroundStyle(Theme.color(k))
            Spacer(minLength: 0)
            Text(t).font(.system(size: 30, weight: .semibold)).foregroundStyle(Theme.fg)
            Text(s).font(.system(size: 21)).foregroundStyle(Theme.fg2).lineLimit(2)
        }
        .padding(28).frame(width: 400, height: 250, alignment: .topLeading)
    }
}

// MARK: - Zones

struct ZonesScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var hub: PlayerHub
    @FocusState private var focus: String?

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 24) {
                ScreenTitle(title: "Zones")
                Text("Pick a region. Quakes, the planet chord, sunrise chimes, natural events and the space station only play what's inside it. The edge you see is the edge you hear.")
                    .font(.system(size: 24)).foregroundStyle(Theme.fg2).frame(width: 720, alignment: .leading)
                LazyVGrid(columns: [GridItem(.fixed(350), spacing: 20), GridItem(.fixed(350), spacing: 20)], alignment: .leading, spacing: 18) {
                    ForEach(Tunings.regions, id: \.self) { r in
                        Button { c.zone = r; if !c.isPlaying { hub.play() } } label: {
                            HStack {
                                Text(Tunings.regionNames[r] ?? r).font(.system(size: 24, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
                                Spacer()
                                if c.zone == r { Image(systemName: "checkmark").foregroundStyle(Theme.color("o")) }
                            }
                            .padding(.horizontal, 22).frame(width: 350, height: 74)
                        }
                        .buttonStyle(TileStyle(tint: Theme.color("o"), corner: 16))
                        .focused($focus, equals: r)
                    }
                }
                Button { c.sweep.toggle(); if !c.isPlaying { hub.play() } } label: {
                    Label(c.sweep ? "Stop sweeping" : "Sweep around the planet", systemImage: c.sweep ? "stop.circle" : "arrow.triangle.2.circlepath")
                }.buttonStyle(PillStyle(prominent: c.sweep, tint: Theme.color("o")))
                Text(c.sweep ? "The zone is a playhead: every quake from the last day plays as the band passes over it." : "Still: the zone holds in place.")
                    .font(Theme.mono(20)).foregroundStyle(Theme.mute)
                Spacer(minLength: 0)
            }
            .padding(36)
            .background(RoundedRectangle(cornerRadius: 28).fill(TV.panel))
            Spacer()
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
        .onAppear { focus = c.zone }
    }
}
