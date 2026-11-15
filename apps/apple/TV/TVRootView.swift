import SwiftUI

enum Screen: Hashable { case home, layers, producer, presets, zeus, more, zones, replay, ambient, readings, explore, about, share }

@MainActor
final class Router: ObservableObject {
    @Published private(set) var stack: [Screen] = []
    var top: Screen { stack.last ?? .home }
    func go(_ s: Screen) { withAnimation(.easeInOut(duration: 0.35)) { stack.append(s) } }
    func back() { withAnimation(.easeInOut(duration: 0.35)) { _ = stack.popLast() } }
    func home() { withAnimation(.easeInOut(duration: 0.35)) { stack.removeAll() } }
}

struct TVRootView: View {
    @EnvironmentObject var hub: PlayerHub
    @EnvironmentObject var c: Conductor
    @StateObject private var router = Router()
    @StateObject private var globe = GlobeState()
    @State private var idle = false
    @State private var lastInput = Date()

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            GlobeView().ignoresSafeArea()
            Group {
                switch router.top {
                case .home: HomeScreen(idle: idle, wake: { wake() })
                case .layers: LayersScreen()
                case .producer: ProducerScreen()
                case .presets: PresetsScreen()
                case .zeus: ZeusScreen()
                case .more: MoreScreen()
                case .zones: ZonesScreen()
                case .replay: ReplayScreen()
                case .ambient: AmbientScreen()
                case .readings: ReadingsScreen()
                case .explore: ExploreScreen()
                case .about: AboutScreen()
                case .share: ShareScreen()
                }
            }
            .transition(.opacity)
            .id(router.top)
        }
        .environmentObject(router)
        .environmentObject(globe)
        .onPlayPauseCommand { if router.top != .layers && router.top != .zeus { hub.toggle() } }
        .onExitCommand(perform: exitAction)
        .onChange(of: router.top) { _, s in place(s); wake() }
        .onAppear { place(.home); screenshotLaunch() }
        .onOpenURL { open($0) }
        .task {
            // ambient fade: after 25 s with no input while playing, Home hides its controls so it's just the planet
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                if c.isPlaying && router.top == .home && Date().timeIntervalSince(lastInput) > 25 && !idle { withAnimation(.easeInOut(duration: 1.4)) { idle = true } }
            }
        }
        .onMoveCommand { _ in wake() }
    }

    /// Back: pops a screen; on Home it first brings the controls back, then leaves the app (system default)
    private var exitAction: (() -> Void)? {
        if !router.stack.isEmpty { return { router.back() } }
        if idle { return { wake() } }
        return nil
    }

    private func wake() { lastInput = Date(); if idle { withAnimation(.easeOut(duration: 0.4)) { idle = false } } }

    private func place(_ s: Screen) {
        c.zeus = s == .zeus
        if s != .zeus { globe.cursor = nil }
        switch s {
        case .home, .explore: globe.place(x: 0.64, scale: 0.42)
        case .ambient: globe.place(x: 0.5, scale: 0.46)
        case .zones, .zeus: globe.place(x: 0.66, scale: 0.44)
        case .replay: globe.place(x: 0.5, scale: 0.36)
        case .layers, .producer, .readings, .about, .share: globe.place(x: 0.5, scale: 0.42, dim: 0.72)
        case .presets, .more: globe.place(x: 0.5, scale: 0.48, dim: 0.55)
        }
        globe.spin = s != .explore && s != .zeus
    }

    /// Launch arguments for automated screenshots: -uiScreen producer -uiPlay YES -uiIdle YES
    private func screenshotLaunch() {
        let d = UserDefaults.standard
        if d.bool(forKey: "uiPlay") { hub.play() }
        if let n = d.string(forKey: "uiScreen"), let s = Self.screenNames[n] { router.go(s) }
        if d.bool(forKey: "uiIdle") { idle = true }
    }
    private static let screenNames: [String: Screen] = ["layers": .layers, "producer": .producer, "presets": .presets, "more": .more, "ambient": .ambient, "readings": .readings, "explore": .explore, "about": .about, "share": .share]

    /// earthmidi://play, earthmidi://preset/<name>, earthmidi://zeus, earthmidi://ambient (Top Shelf + Siri)
    private func open(_ url: URL) {
        guard url.scheme == "earthmidi" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        switch url.host {
        case "preset":
            if let n = parts.first?.removingPercentEncoding, let p = Tunings.presets.first(where: { $0.id == n }) { c.applyPreset(p) }
            router.home(); hub.play()
        case "zeus" where Features.v12: router.home(); router.go(.zeus)
        case "ambient": router.home(); hub.play(); router.go(.ambient)
        default: router.home(); hub.play()
        }
    }
}

// MARK: - Home

struct HomeScreen: View {
    @EnvironmentObject var hub: PlayerHub
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var router: Router
    let idle: Bool
    var wake: () -> Void = {}
    @FocusState private var focus: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            topBar
            LayerMeter(width: 460).padding(.top, 14)
            Spacer()
            if !idle { panel.transition(.move(edge: .bottom).combined(with: .opacity)) }
            else { idleCaption.transition(.opacity) }
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
        .onAppear { focus = 0 }
    }

    private var topBar: some View {
        HStack(alignment: .center, spacing: 18) {
            Logo(size: 36)
            Text("EARTH MIDI").font(Theme.title(44)).foregroundStyle(Theme.fg)
            if c.isPlaying {
                Text(c.mode == .live ? "LIVE" : "REPLAY").font(Theme.caps(22)).foregroundStyle(Theme.color("q"))
                    .padding(.horizontal, 14).padding(.vertical, 4).overlay(Capsule().stroke(Theme.color("q")))
            }
            if let p = c.presetName { Text(p.uppercased()).font(Theme.caps(20)).foregroundStyle(Theme.fg2).padding(.leading, 6) }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                if c.isPlaying && c.mode == .replay { Text("HEARING " + c.clock.formatted(date: .omitted, time: .shortened)).font(Theme.mono(22)).foregroundStyle(Theme.fg2) }
                else { Caps(text: "Same reading, same note", size: 18) }
                if c.config.style == "pulse" && c.bpm > 0 { Text(String(format: "%.0f BPM", c.bpm)).font(Theme.mono(22, .semibold)).foregroundStyle(Theme.color("r")) }
            }
        }
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 26) {
            HStack(spacing: 34) {
                readout("KP", String(format: "%.1f", c.kp), c.config.scaleLabel(kp: c.kp).components(separatedBy: " (").first ?? "", "g")
                readout("SOLAR WIND", c.data.speedNow.isFinite ? "\(Int(c.data.speedNow))" : "–", c.data.bzNow.isFinite ? String(format: "km/s · Bz %.1f", c.data.bzNow) : "km/s", "s")
                readout("X-RAYS", Music.flareClass(c.data.xrayNow), "GOES", "x")
                readout("OCEAN", String(format: "%.1f m", c.data.ocean(at: c.data.now).h), String(format: "%.0f s swell", c.data.ocean(at: c.data.now).p), "o")
                readout("QUAKES 24 H", "\(c.data.quakes24h.count)", c.data.biggest24h.map { String(format: "biggest M%.1f", $0.mag) } ?? "", "q")
            }
            HStack(spacing: 22) {
                Button { hub.toggle() } label: {
                    Label(c.isPlaying ? "Stop" : "Play the planet", systemImage: c.isPlaying ? "stop.fill" : "play.fill")
                }.buttonStyle(PillStyle(prominent: true)).focused($focus, equals: 0)
                Button { c.config.style = c.config.style == "pulse" ? "ambient" : "pulse"; if !c.isPlaying { hub.play() } } label: {
                    Text(c.config.style == "pulse" ? "Pulse" : "Ambient")
                }.buttonStyle(PillStyle(tint: c.config.style == "pulse" ? Theme.color("r") : Theme.color("o")))
                if Features.v12 { Button { c.mode = c.mode == .live ? .replay : .live } label: { Text(c.mode == .live ? "Live" : "24 h") }.buttonStyle(PillStyle()) }
                Button { router.go(.layers) } label: { Text("Layers") }.buttonStyle(PillStyle())
                Button { router.go(.producer) } label: { Text("Producer") }.buttonStyle(PillStyle())
                Button { router.go(.presets) } label: { Text("Presets") }.buttonStyle(PillStyle())
                if Features.v12 { Button { router.go(.zeus) } label: { Text("Zeus") }.buttonStyle(PillStyle(tint: Theme.hex(0xffc83d))) }
                Button { router.go(.more) } label: { Image(systemName: "ellipsis") }.buttonStyle(PillStyle())
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(c.events.prefix(3)) { e in
                    HStack(spacing: 12) {
                        Circle().fill(Theme.color(e.layer)).frame(width: 12, height: 12)
                        Text(e.text).font(Theme.mono(22)).foregroundStyle(Theme.fg2).lineLimit(1)
                    }
                }
                if c.events.isEmpty { Text(c.isPlaying ? "Listening… the first reading plays as soon as a sensor reports." : "Press Play. Every note comes from a live sensor.").font(Theme.mono(22)).foregroundStyle(Theme.mute) }
            }
            .frame(height: 104, alignment: .top)
            HStack(spacing: 18) {
                AppleWeatherMark(data: c.data, size: 18)
                if c.data.isDemo { Text("Live feeds unreachable: playing demo data").font(Theme.mono(18)).foregroundStyle(Theme.color("s")) }
            }
        }
        .padding(32)
        .frame(maxWidth: 1180, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 28).fill(TV.panel))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(Theme.line))
    }

    private var idleCaption: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let e = c.events.first {
                HStack(spacing: 14) {
                    Circle().fill(Theme.color(e.layer)).frame(width: 14, height: 14)
                    Text(e.text).font(Theme.mono(26)).foregroundStyle(Theme.fg2).lineLimit(1)
                }.id(e.id).transition(.opacity)
            }
            Button { wake() } label: { Caps(text: "Controls", size: 16).padding(.horizontal, 8) }.buttonStyle(PillStyle())
        }
        .animation(.easeInOut(duration: 0.6), value: c.events.first?.id)
    }

    private func readout(_ l: String, _ v: String, _ sub: String, _ k: Character) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Caps(text: l, size: 16)
            Text(v).font(Theme.mono(44, .semibold)).foregroundStyle(Theme.color(k))
            Text(sub).font(Theme.mono(18)).foregroundStyle(Theme.fg2).lineLimit(1)
        }
        .frame(minWidth: 190, alignment: .leading)
    }
}
