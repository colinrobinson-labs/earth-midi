import SwiftUI

struct TVRootView: View {
    @EnvironmentObject var hub: PlayerHub
    @EnvironmentObject var c: Conductor
    @State private var showInfo = true
    @FocusState private var focus: Control?
    enum Control: Hashable { case play, mode, layers }
    @State private var showLayers = false

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            GlobeView().ignoresSafeArea()
            VStack(alignment: .leading) {
                topBar
                Spacer()
                if showInfo { bottom.transition(.move(edge: .bottom).combined(with: .opacity)) }
            }
            .padding(.horizontal, 80).padding(.vertical, 60)
        }
        .onPlayPauseCommand { hub.toggle() }
        .onExitCommand(perform: showInfo ? nil : { withAnimation { showInfo = true } })
        .onAppear { focus = .play }
        .sheet(isPresented: $showLayers) { LayersView().environmentObject(c) }
        .task {
            // ambient mode: hide the controls after a while so it's just the planet
            while true {
                try? await Task.sleep(for: .seconds(20))
                if c.isPlaying { withAnimation(.easeInOut(duration: 1.2)) { showInfo = false } }
            }
        }
    }

    private var topBar: some View {
        HStack(alignment: .center, spacing: 18) {
            Circle().stroke(Theme.spectrum, lineWidth: 6).frame(width: 34, height: 34)
            Text("EARTH MIDI").font(Theme.title(40)).foregroundStyle(Theme.fg)
            if c.isPlaying {
                Text(c.mode == .live ? "LIVE" : "REPLAY").font(Theme.caps(22)).foregroundStyle(Theme.color("q"))
                    .padding(.horizontal, 12).padding(.vertical, 4).overlay(Capsule().stroke(Theme.color("q")))
            }
            Spacer()
            if c.isPlaying && c.mode == .replay {
                Text("HEARING " + c.clock.formatted(date: .omitted, time: .shortened)).font(Theme.mono(22)).foregroundStyle(Theme.fg2)
            }
        }
    }

    private var bottom: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 28) {
                readout("KP", String(format: "%.1f", c.kp), Music.scaleName(kp: c.kp), "g")
                readout("SOLAR WIND", c.data.speedNow.isFinite ? "\(Int(c.data.speedNow)) km/s" : "–", c.data.bzNow.isFinite ? String(format: "Bz %.1f nT", c.data.bzNow) : "", "s")
                readout("X-RAYS", Music.flareClass(c.data.xrayNow), "GOES", "x")
                readout("OCEAN", String(format: "%.1f m", c.data.ocean(at: c.data.now).h), String(format: "%.0f s swell", c.data.ocean(at: c.data.now).p), "o")
                readout("QUAKES 24 H", "\(c.data.quakes24h.count)", c.data.biggest24h.map { String(format: "biggest M%.1f", $0.mag) } ?? "", "q")
            }
            HStack(spacing: 30) {
                Button { hub.toggle() } label: {
                    Label(c.isPlaying ? "Stop" : "Play the planet", systemImage: c.isPlaying ? "stop.fill" : "play.fill").font(.title3.weight(.semibold)).padding(.horizontal, 20)
                }
                .focused($focus, equals: .play)
                Picker("Mode", selection: $c.mode) { ForEach(Conductor.Mode.allCases) { Text($0.rawValue).tag($0) } }
                    .pickerStyle(.segmented).frame(width: 560).focused($focus, equals: .mode)
                Button { showLayers = true } label: { Label("Layers", systemImage: "slider.horizontal.3") }.focused($focus, equals: .layers)
                Spacer()
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(c.events.prefix(3)) { e in
                    HStack(spacing: 12) {
                        Circle().fill(Theme.color(e.layer)).frame(width: 12, height: 12)
                        Text(e.text).font(Theme.mono(22)).foregroundStyle(Theme.fg2).lineLimit(1)
                    }
                }
            }
            .frame(height: 110, alignment: .top)
            if c.data.isDemo { Text("Live feeds unreachable: playing demo data").font(Theme.mono(18)).foregroundStyle(Theme.color("s")) }
        }
        .padding(30)
        .background(RoundedRectangle(cornerRadius: 24).fill(.black.opacity(0.55)))
    }

    private func readout(_ l: String, _ v: String, _ sub: String, _ k: Character) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(l).font(Theme.caps(16)).foregroundStyle(Theme.mute)
            Text(v).font(Theme.mono(40, .semibold)).foregroundStyle(Theme.color(k))
            Text(sub).font(Theme.mono(18)).foregroundStyle(Theme.fg2).lineLimit(1)
        }
        .frame(minWidth: 230, alignment: .leading)
    }
}

struct LayersView: View {
    @EnvironmentObject var c: Conductor
    private let keys: [Character] = ["q", "s", "o", "x", "w", "t", "c"]
    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(keys, id: \.self) { k in
                        Button {
                            if c.muted.contains(k) { c.muted.remove(k) } else { c.muted.insert(k) }
                        } label: {
                            HStack {
                                Circle().fill(Theme.color(k)).frame(width: 18, height: 18)
                                Text(Theme.name(k))
                                Spacer()
                                Text(c.muted.contains(k) ? "Muted" : "On").foregroundStyle(c.muted.contains(k) ? Theme.mute : Theme.color(k))
                            }
                        }
                    }
                } footer: {
                    Text("Every note comes from a live sensor reading through the same rule every time. AI helped design and build Earth MIDI, but no AI runs while you listen. Earth MIDI by Colin Robinson · earthmidi.com")
                }
            }
            .navigationTitle("Layers")
        }
    }
}
