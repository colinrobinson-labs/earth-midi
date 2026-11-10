import SwiftUI
import MapKit

@MainActor
final class ReadingsStore: ObservableObject {
    @Published var data = EarthData.cached() ?? EarthReadings()
    @Published var loading = false
    /// Nothing to show yet: no saved snapshot and the first load hasn't finished.
    var waiting: Bool { data.loadedAt == .distantPast }
    func load() async {
        loading = true
        data = await EarthData.load()
        loading = false
    }
}

/// Native live readings: the same numbers the engine is playing, with the note each one makes.
struct ReadingsView: View {
    @EnvironmentObject var hub: PlayerHub
    @StateObject private var store = ReadingsStore()
    @State private var camera: MapCameraPosition = .camera(MapCamera(centerCoordinate: CLLocationCoordinate2D(latitude: 20, longitude: -160), distance: 28_000_000))
    private let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "The planet right now")
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    map
                    if store.data.isDemo { Text("Live feeds unreachable: showing demo data").font(Theme.mono(11)).foregroundStyle(Theme.hex(0xffc53d)) }
                    if store.waiting {
                        HStack(spacing: 10) { ProgressView(); Text("Loading live readings…").font(Theme.mono(13)).foregroundStyle(Theme.mute) }
                            .frame(maxWidth: .infinity, minHeight: 120)
                    } else {
                    LazyVGrid(columns: cols, spacing: 10) {
                        let d = store.data, kp = d.kpNow
                        Reading(label: "Kp index", value: String(format: "%.1f", kp), sub: "\(Theme.kpWord(kp)) · \(Music.scaleName(kp: kp))", color: Theme.color("g"))
                        Reading(label: "Solar wind", value: d.speedNow.isFinite ? "\(Int(d.speedNow)) km/s" : "–", sub: d.bzNow.isFinite ? String(format: "Bz %.1f nT · %.1f p/cm³", d.bzNow, d.densityNow) : "", color: Theme.color("s"))
                        Reading(label: "X-rays", value: Music.flareClass(d.xrayNow), sub: "GOES 0.1–0.8 nm", color: Theme.color("x"))
                        let oc = d.ocean(at: d.now)
                        Reading(label: "Ocean swell", value: String(format: "%.1f m", oc.h), sub: String(format: "%.0f s period · 10 buoys", oc.p), color: Theme.color("o"))
                        let jv = d.jet(at: d.now)
                        Reading(label: "Jet stream", value: jv.isFinite ? "\(Int(jv)) km/h" : "–", sub: "250 hPa, 6 points", color: Theme.color("w"))
                        Reading(label: "Tide · La Jolla", value: String(format: "%+.2f", d.tideNorm(at: d.now)), sub: "−1 low … +1 high", color: Theme.color("t"))
                    }
                    if !store.data.temps.isEmpty { chord }
                    quakes
                    }
                    if !hub.events.isEmpty { justPlayed }
                    Text("Every number comes from a public sensor feed or published physics. The note shown is what the engine plays with the default settings: the same reading always makes the same note.")
                        .font(.footnote).foregroundStyle(Theme.mute).padding(.top, 4)
                }
                .padding(.horizontal, 16).padding(.bottom, 24)
            }
            .refreshable { await store.load() }
        }
        .background(Theme.bg)
        .task { await store.load() }
    }

    private var map: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom, .rotate]) {
            ForEach(store.data.quakes24h) { q in
                Annotation("", coordinate: CLLocationCoordinate2D(latitude: q.lat, longitude: q.lon), anchor: .center) {
                    Circle().fill(Theme.color("q").opacity(0.35)).overlay(Circle().stroke(Theme.color("q"), lineWidth: 1))
                        .frame(width: 4 + q.mag * 4, height: 4 + q.mag * 4)
                }
            }
        }
        .mapStyle(.imagery(elevation: .realistic))
        .frame(height: 300)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(alignment: .bottomLeading) {
            Text("\(store.data.quakes24h.count) QUAKES · 24 H").font(Theme.caps(10)).padding(6).background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 6)).padding(8).foregroundStyle(Theme.fg)
        }
    }

    private var chord: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PLANET CHORD · TEMPERATURE → NOTE").font(Theme.caps(10)).foregroundStyle(Theme.mute)
            let kp = store.data.kpNow
            FlowRow(items: store.data.temps.map { c -> String in
                let T = c.series.at(store.data.now)
                return T.isFinite ? "\(c.place.name) \(Int(T.rounded()))° \(Music.noteName(Music.chordNote(tempC: T, kp: kp)))" : c.place.name
            })
            AppleWeatherMark(data: store.data)
        }
    }

    private var quakes: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("BIGGEST QUAKES · 24 H").font(Theme.caps(10)).foregroundStyle(Theme.mute).padding(.bottom, 8)
            ForEach(store.data.quakes24h.sorted { $0.mag > $1.mag }.prefix(12)) { q in
                let n = Music.quakeNote(depth: q.depth, kp: store.data.kp(at: q.time.timeIntervalSince1970))
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(String(format: "M%.1f", q.mag)).font(Theme.mono(15, .bold)).foregroundStyle(Theme.color("q")).frame(width: 56, alignment: .leading)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(q.place.isEmpty ? "Unnamed location" : q.place).font(.subheadline).foregroundStyle(Theme.fg).lineLimit(1)
                        Text("\(Int(q.depth.rounded())) km deep · \(q.time.shortAgo)").font(Theme.mono(11)).foregroundStyle(Theme.fg2)
                    }
                    Spacer()
                    Text("\(Music.noteName(n.note)) v\(Music.velocity(mag: q.mag))").font(Theme.mono(12, .semibold)).foregroundStyle(Theme.fg2)
                }
                .padding(.vertical, 8)
                .overlay(alignment: .bottom) { Rectangle().fill(Theme.line).frame(height: 1) }
            }
        }
    }

    private var justPlayed: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("JUST PLAYED").font(Theme.caps(10)).foregroundStyle(Theme.mute)
            ForEach(hub.events.prefix(10)) { e in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Circle().fill(Theme.color(e.layer)).frame(width: 7, height: 7)
                    Text(e.text).font(Theme.mono(11)).foregroundStyle(Theme.fg2).lineLimit(2)
                }
            }
        }
    }
}

/// Simple wrapping row of chips
struct FlowRow: View {
    let items: [String]
    var body: some View {
        WrapLayout(spacing: 6) {
            ForEach(items, id: \.self) { s in
                Text(s).font(Theme.mono(11)).foregroundStyle(Theme.fg).padding(.horizontal, 8).padding(.vertical, 5)
                    .background(Capsule().fill(Theme.sf2)).overlay(Capsule().stroke(Theme.color("c").opacity(0.4)))
            }
        }
    }
}

struct WrapLayout: Layout {
    var spacing: CGFloat = 6
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 360
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x + z.width > w, x > 0 { x = 0; y += row + spacing; row = 0 }
            x += z.width + spacing; row = max(row, z.height)
        }
        return CGSize(width: w, height: y + row)
    }
    func placeSubviews(in b: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = b.minX, y = b.minY, row: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x + z.width > b.maxX, x > b.minX { x = b.minX; y += row + spacing; row = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(z))
            x += z.width + spacing; row = max(row, z.height)
        }
    }
}
