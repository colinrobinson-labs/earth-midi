import WidgetKit
import SwiftUI
import AppIntents
#if os(iOS)
import ActivityKit
#endif

@main
struct EarthWidgetBundle: WidgetBundle {
    var body: some Widget {
        PlanetWidget()
        QuakeWidget()
        #if os(iOS)
        EarthLiveActivity()
        #endif
    }
}

// MARK: - Timeline

struct PlanetEntry: TimelineEntry {
    let date: Date
    let kp: Double
    let speed: Double
    let bz: Double
    let xray: String
    let quakes: [Quake]
    let biggest: Quake?
    let count24h: Int
    let isDemo: Bool
    let kpAtBiggest: Double

    static let placeholder = PlanetEntry(date: Date(), kp: 2.3, speed: 420, bz: -1.2, xray: "B4.1",
        quakes: [Quake(id: "a", mag: 4.6, place: "Kermadec Islands", time: Date().addingTimeInterval(-2400), lat: -30, lon: -178, depth: 35, url: nil),
                 Quake(id: "b", mag: 2.1, place: "Southern California", time: Date().addingTimeInterval(-600), lat: 34, lon: -117, depth: 8, url: nil),
                 Quake(id: "c", mag: 1.4, place: "Alaska", time: Date().addingTimeInterval(-300), lat: 61, lon: -150, depth: 70, url: nil)],
        biggest: Quake(id: "a", mag: 4.6, place: "Kermadec Islands", time: Date().addingTimeInterval(-2400), lat: -30, lon: -178, depth: 35, url: nil),
        count24h: 212, isDemo: false, kpAtBiggest: 2.3)
}

struct PlanetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlanetEntry { .placeholder }
    func getSnapshot(in context: Context, completion: @escaping (PlanetEntry) -> Void) {
        if context.isPreview { completion(.placeholder); return }
        Task { completion(await Self.entry()) }
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PlanetEntry>) -> Void) {
        Task {
            let e = await Self.entry()
            completion(Timeline(entries: [e], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }
    static func entry() async -> PlanetEntry {
        let d = await EarthData.load()
        let b = d.biggest24h
        return PlanetEntry(date: Date(), kp: d.kpNow, speed: d.speedNow, bz: d.bzNow, xray: Music.flareClass(d.xrayNow),
                           quakes: Array(d.quakes.suffix(4).reversed()), biggest: b, count24h: d.quakes24h.count, isDemo: d.isDemo,
                           kpAtBiggest: b.map { d.kp(at: $0.time.timeIntervalSince1970) } ?? d.kpNow)
    }
}

// MARK: - Planet widget (space weather + quakes + play button)

struct PlanetWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "planet", provider: PlanetProvider()) { e in
            PlanetWidgetView(e: e).containerBackground(for: .widget) { Theme.bg }
        }
        .configurationDisplayName("The planet now")
        .description("Space weather, the latest earthquakes and the scale Earth MIDI is playing in.")
        #if os(iOS)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
        #else
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        #endif
    }
}

struct PlanetWidgetView: View {
    let e: PlanetEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        #if os(iOS)
        case .accessoryCircular:
            Gauge(value: min(9, e.kp), in: 0...9) { Text("Kp") } currentValueLabel: { Text(String(format: "%.0f", e.kp)) }
                .gaugeStyle(.accessoryCircular)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("EARTH MIDI").font(.system(size: 10, weight: .bold, design: .monospaced))
                Text(String(format: "Kp %.1f · %@", e.kp, Theme.kpWord(e.kp))).font(.system(size: 13, weight: .semibold))
                if let b = e.biggest { Text(String(format: "M%.1f %@", b.mag, b.place)).font(.system(size: 11)).lineLimit(1) }
            }
        case .accessoryInline:
            Text(String(format: "Kp %.1f · %d quakes today", e.kp, e.count24h))
        #endif
        case .systemSmall: small
        case .systemLarge: large
        default: medium
        }
    }

    private var header: some View {
        HStack(spacing: 6) {
            Circle().stroke(Theme.spectrum, lineWidth: 2.5).frame(width: 12, height: 12)
            Text("EARTH MIDI").font(Theme.caps(10)).foregroundStyle(Theme.fg2)
            Spacer()
            playButton
        }
    }
    private var playButton: some View {
        Button(intent: TogglePlaybackIntent()) {
            Image(systemName: "playpause.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.bg)
                .frame(width: 24, height: 24).background(Circle().fill(Theme.hex(0x3cc8ff)))
        }
        .buttonStyle(.plain)
    }
    private var kpBlock: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("KP").font(Theme.caps(9)).foregroundStyle(Theme.mute)
            Text(String(format: "%.1f", e.kp)).font(Theme.mono(30, .bold)).foregroundStyle(Theme.color("g"))
            Text(Music.scaleName(kp: e.kp)).font(Theme.mono(10)).foregroundStyle(Theme.fg2).lineLimit(1).minimumScaleFactor(0.7)
        }
    }
    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            Spacer(minLength: 0)
            kpBlock
            if e.speed.isFinite { Text("\(Int(e.speed)) km/s wind").font(Theme.mono(10)).foregroundStyle(Theme.color("s")) }
        }
    }
    private var medium: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            HStack(alignment: .top, spacing: 14) {
                kpBlock.frame(width: 104, alignment: .leading)
                VStack(alignment: .leading, spacing: 5) {
                    stat("Solar wind", e.speed.isFinite ? "\(Int(e.speed)) km/s" : "–", "s")
                    stat("X-rays", e.xray, "x")
                    if let b = e.biggest { stat("Biggest quake", String(format: "M%.1f · %@", b.mag, Music.noteName(Music.quakeNote(depth: b.depth, kp: e.kpAtBiggest).note)), "q") }
                }
            }
            Spacer(minLength: 0)
        }
    }
    private var large: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            HStack(alignment: .top) {
                kpBlock
                Spacer()
                VStack(alignment: .trailing, spacing: 5) {
                    stat("Solar wind", e.speed.isFinite ? "\(Int(e.speed)) km/s" : "–", "s")
                    stat("Bz", e.bz.isFinite ? String(format: "%.1f nT", e.bz) : "–", "s")
                    stat("X-rays", e.xray, "x")
                }
            }
            Rectangle().fill(Theme.line).frame(height: 1)
            Text("\(e.count24h) QUAKES IN 24 H · LATEST").font(Theme.caps(9)).foregroundStyle(Theme.mute)
            ForEach(e.quakes) { q in
                HStack(spacing: 8) {
                    Text(String(format: "M%.1f", q.mag)).font(Theme.mono(13, .bold)).foregroundStyle(Theme.color("q")).frame(width: 46, alignment: .leading)
                    Text(q.place).font(.system(size: 12)).foregroundStyle(Theme.fg).lineLimit(1)
                    Spacer()
                    Text(q.time.shortAgo).font(Theme.mono(10)).foregroundStyle(Theme.fg2)
                }
            }
            Spacer(minLength: 0)
            if e.isDemo { Text("demo data").font(Theme.mono(9)).foregroundStyle(Theme.mute) }
        }
    }
    private func stat(_ l: String, _ v: String, _ k: Character) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(l.uppercased()).font(Theme.caps(8)).foregroundStyle(Theme.mute)
            Text(v).font(Theme.mono(12, .semibold)).foregroundStyle(Theme.color(k)).lineLimit(1).minimumScaleFactor(0.7)
        }
    }
}

// MARK: - Quake widget

struct QuakeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "quake", provider: PlanetProvider()) { e in
            QuakeWidgetView(e: e).containerBackground(for: .widget) { Theme.bg }
        }
        .configurationDisplayName("Biggest quake today")
        .description("The largest earthquake in the last 24 hours and the note it plays.")
        .supportedFamilies([.systemSmall])
    }
}

struct QuakeWidgetView: View {
    let e: PlanetEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("BIGGEST · 24 H").font(Theme.caps(9)).foregroundStyle(Theme.mute)
            if let b = e.biggest {
                Text(String(format: "M%.1f", b.mag)).font(Theme.mono(34, .bold)).foregroundStyle(Theme.color("q"))
                Text(b.place).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.fg).lineLimit(2)
                Spacer(minLength: 0)
                let n = Music.quakeNote(depth: b.depth, kp: e.kpAtBiggest)
                Text("\(Int(b.depth)) km · plays \(Music.noteName(n.note))").font(Theme.mono(10)).foregroundStyle(Theme.fg2)
            } else {
                Text("–").font(Theme.mono(34, .bold)).foregroundStyle(Theme.mute)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Live Activity

#if os(iOS)
struct EarthLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: EarthLiveAttributes.self) { ctx in
            HStack(spacing: 12) {
                ZStack {
                    Circle().stroke(Theme.spectrum, lineWidth: 4).frame(width: 40, height: 40)
                    Text(ctx.state.note.isEmpty ? "♪" : ctx.state.note).font(Theme.mono(11, .bold)).foregroundStyle(Theme.fg)
                }
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(ctx.state.isLive ? "LIVE" : "REPLAY").font(Theme.caps(10)).foregroundStyle(Theme.hex(0xff5a3c))
                        Text(String(format: "KP %.1f · %@", ctx.state.kp, ctx.state.scale.uppercased())).font(Theme.caps(10)).foregroundStyle(Theme.fg2).lineLimit(1)
                    }
                    Text(ctx.state.headline).font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.fg).lineLimit(2)
                }
                Spacer(minLength: 0)
                Button(intent: StopEarthIntent()) {
                    Image(systemName: "stop.fill").foregroundStyle(Theme.fg).frame(width: 34, height: 34).background(Circle().fill(Theme.sf2))
                }.buttonStyle(.plain)
            }
            .padding(14)
            .activityBackgroundTint(Theme.bg)
            .activitySystemActionForegroundColor(Theme.fg)
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(String(format: "Kp %.1f", ctx.state.kp)).font(Theme.mono(13, .bold)).foregroundStyle(Theme.color("g"))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(ctx.state.note).font(Theme.mono(13, .bold)).foregroundStyle(Theme.color(Character(ctx.state.layer.isEmpty ? "q" : ctx.state.layer)))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(ctx.state.headline).font(.system(size: 13)).lineLimit(2).foregroundStyle(Theme.fg)
                }
            } compactLeading: {
                Circle().stroke(Theme.spectrum, lineWidth: 3).frame(width: 16, height: 16)
            } compactTrailing: {
                Text(ctx.state.note.isEmpty ? String(format: "%.0f", ctx.state.kp) : ctx.state.note).font(Theme.mono(12, .bold)).foregroundStyle(Theme.color(Character(ctx.state.layer.isEmpty ? "q" : ctx.state.layer)))
            } minimal: {
                Circle().stroke(Theme.spectrum, lineWidth: 3).frame(width: 14, height: 14)
            }
        }
    }
}
#endif
