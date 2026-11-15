import SwiftUI
import CoreImage.CIFilterBuiltins

/// Release switch. 1.1 ships the core; Zeus Mode, Zones and the 24-hour scrub are built but stay hidden until 1.2.
enum Features {
    static let v12 = false
}

/// A screen-filling focus target for remote-driven views (Explore, Zeus aiming, the replay scrubber, Ambient):
/// it is the only focusable thing on screen, so every swipe arrives as a move command instead of moving focus.
struct PadButton: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) { Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity).contentShape(Rectangle()) }
            .buttonStyle(InvisibleStyle())
    }
    private struct InvisibleStyle: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label } }
}

// MARK: - Ambient

struct AmbientScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var hub: PlayerHub
    @EnvironmentObject var router: Router

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            PadButton { router.back() }.onMoveCommand { _ in }
            VStack(alignment: .leading, spacing: 14) {
                TimelineView(.periodic(from: .now, by: 1)) { tl in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(tl.date.formatted(date: .omitted, time: .shortened)).font(Theme.title(120)).foregroundStyle(Theme.fg)
                        Text(tl.date.formatted(.dateTime.weekday(.wide).month(.wide).day()) + " · " + Astro.moonName(tl.date.timeIntervalSince1970))
                            .font(Theme.mono(26)).foregroundStyle(Theme.fg2)
                    }
                }
                if let e = c.events.first {
                    HStack(spacing: 14) {
                        Circle().fill(Theme.color(e.layer)).frame(width: 14, height: 14)
                        Text(e.text).font(Theme.mono(28)).foregroundStyle(Theme.fg2).lineLimit(1)
                    }
                    .id(e.id).transition(.opacity)
                }
                HStack(spacing: 20) {
                    LayerMeter(width: 380)
                    Text(String(format: "Kp %.1f · %@", c.kp, c.config.scaleLabel(kp: c.kp).components(separatedBy: " (").first ?? "")).font(Theme.mono(20)).foregroundStyle(Theme.mute)
                    if let s = c.sleepAt { Text("Sleep \(s.formatted(date: .omitted, time: .shortened))").font(Theme.mono(20)).foregroundStyle(Theme.mute) }
                }
            }
            .animation(.easeInOut(duration: 1), value: c.events.first?.id)
            .padding(.horizontal, TV.gutterH + 20).padding(.vertical, TV.gutterV + 20)
            .allowsHitTesting(false)
        }
        .onAppear { if !c.isPlaying { hub.play() } }
    }
}

// MARK: - Explore

struct ExploreScreen: View {
    @EnvironmentObject var g: GlobeState
    @EnvironmentObject var c: Conductor
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            PadButton { g.spin.toggle() }
                .onMoveCommand { d in
                    withAnimation(.easeOut(duration: 0.4)) {
                        switch d {
                        case .left: g.lonOffset -= 20
                        case .right: g.lonOffset += 20
                        case .up: g.tilt = min(80, g.tilt + 12)
                        case .down: g.tilt = max(-80, g.tilt - 12)
                        @unknown default: break
                        }
                    }
                }
            VStack(alignment: .leading, spacing: 8) {
                Text("EXPLORE").font(Theme.title(36))
                Caps(text: "Swipe to spin and tilt · Click to \(g.spin ? "stop" : "start") the turn · Back to leave", size: 17)
            }
            .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
            .allowsHitTesting(false)
        }
        .onDisappear { withAnimation { g.tilt = 18 } }
    }
}

// MARK: - Readings

struct ReadingsScreen: View {
    @EnvironmentObject var c: Conductor
    private let cols = Array(repeating: GridItem(.fixed(400), spacing: 30), count: 4)

    var body: some View {
        let d = c.data, now = d.now, air = c.more.air(at: now), iss = c.more.iss(at: now)
        let fires = c.more.events.filter { $0.kind == .fire }.count, storms = c.more.events.filter { $0.kind == .storm }.count, vols = c.more.events.filter { $0.kind == .volcano }.count
        return VStack(alignment: .leading, spacing: 26) {
            ScreenTitle(title: "Readings", hint: d.snapshotAt.map { "Snapshot \($0.shortAgo) · earthmidi.com/data" } ?? "Live feeds")
            ScrollView(.vertical) {
                LazyVGrid(columns: cols, alignment: .leading, spacing: 30) {
                    card("q", "Quakes, 24 h", "\(d.quakes24h.count)", d.biggest24h.map { String(format: "biggest M%.1f · %@", $0.mag, $0.place) } ?? "", "USGS", nil)
                    card("s", "Solar wind", d.speedNow.isFinite ? "\(Int(d.speedNow)) km/s" : "–", d.densityNow.isFinite ? String(format: "%.1f p/cm³ · Bz %.1f nT", d.densityNow, d.bzNow) : "", "NOAA SWPC", d.speed)
                    card("g", "Kp", String(format: "%.1f", d.kpNow), Theme.kpWord(d.kpNow), "NOAA SWPC", d.kp)
                    card("x", "X-rays", Music.flareClass(d.xrayNow), "0.1–0.8 nm flux", "GOES", d.xray)
                    card("o", "Ocean swell", String(format: "%.1f m", d.ocean(at: now).h), String(format: "%.0f s period · 10 seas", d.ocean(at: now).p), "Open-Meteo Marine", d.ocean.first?.series)
                    card("w", "Jet stream", d.jet(at: now).isFinite ? "\(Int(d.jet(at: now))) km/h" : "–", "250 hPa, 6 points", "Open-Meteo", d.jet.first?.series)
                    card("t", "Tide", d.tides.first.map { String(format: "%.2f m", $0.series.at(now)) } ?? "–", d.tides.first?.place.name ?? "", "NOAA CO-OPS", d.tides.first?.series)
                    card("c", "City temps", d.temps.isEmpty ? "–" : "\(Int(d.temps.map { $0.series.at(now) }.filter(\.isFinite).reduce(0, +) / Double(max(1, d.temps.count))))° avg", d.temps.prefix(3).map { "\($0.place.name) \(Int($0.series.at(now).rounded()))°" }.joined(separator: " · "), d.isAppleWeather ? "Apple Weather" : "Open-Meteo", d.temps.first?.series)
                    card("i", "Space station", String(format: "%.0f°, %.0f°", iss.lat, iss.lon), String(format: "%.0f km up", iss.alt), c.more.isDemoISS ? "demo orbit" : "orbital elements", nil)
                    card("e", "Natural events", "\(c.more.events.count) open", "\(fires) fires · \(storms) storms · \(vols) volcanoes", "NASA EONET", nil)
                    card("a", "Air", air.pm.isFinite ? String(format: "PM2.5 %.0f", air.pm) : "–", air.uv.isFinite ? String(format: "UV %.1f · 10 cities", air.uv) : "", "Open-Meteo Air", c.more.airPM.first)
                    card("g", "Magnetosphere", d.dst.at(now).isFinite ? String(format: "Dst %.0f nT", d.dst.at(now)) : "–", c.more.protons.at(now).isFinite ? String(format: "protons %.2f pfu", c.more.protons.at(now)) : "", "Kyoto WDC · GOES", d.dst)
                }
                .padding(20)
            }
            AppleWeatherMark(data: d, size: 18)
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
    }

    private func card(_ k: Character, _ name: String, _ v: String, _ sub: String, _ src: String, _ s: Series?) -> some View {
        Button {} label: {
            VStack(alignment: .leading, spacing: 8) {
                Caps(text: name, size: 16)
                Text(v).font(Theme.mono(36, .semibold)).foregroundStyle(Theme.color(k)).lineLimit(1).minimumScaleFactor(0.6)
                Text(sub).font(.system(size: 19)).foregroundStyle(Theme.fg2).lineLimit(2)
                Spacer(minLength: 0)
                if let s, s.v.count > 1 { Sparkline(series: s, color: Theme.color(k)).frame(height: 44) }
                Text(src).font(Theme.mono(15)).foregroundStyle(Theme.mute)
            }
            .padding(24).frame(width: 400, height: 260, alignment: .topLeading)
        }
        .buttonStyle(TileStyle(tint: Theme.color(k)))
    }
}

// MARK: - About

struct AboutScreen: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 28) {
                ScreenTitle(title: "How it works")
                Text("Earth MIDI turns live readings from the planet into music. Every note comes from a real sensor through a fixed rule, so the same reading always plays the same note.")
                    .font(.system(size: 30)).foregroundStyle(Theme.fg)
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(TV.order, id: \.self) { k in
                        HStack(alignment: .top, spacing: 16) {
                            Circle().fill(Theme.color(k)).frame(width: 14, height: 14).padding(.top, 9)
                            Text(Theme.name(k)).font(.system(size: 23, weight: .semibold)).frame(width: 290, alignment: .leading)
                            Text(TV.what[k] ?? "").font(.system(size: 23)).foregroundStyle(Theme.fg2)
                        }
                    }
                }
                Text("AI helped design and build Earth MIDI and its data-to-sound rules. No active AI runs while you listen.")
                    .font(.system(size: 22)).foregroundStyle(Theme.fg2)
                Text("Earth MIDI by Colin Robinson · earthmidi.com").font(Theme.mono(22)).foregroundStyle(Theme.mute)
                Button {} label: { Text("Data: USGS · NOAA SWPC · NOAA CO-OPS · GOES · NASA EONET · Open-Meteo · Kyoto WDC") .font(Theme.mono(18)) }.buttonStyle(PillStyle(tint: Theme.mute))
            }
            .frame(maxWidth: 1400, alignment: .leading)
            Spacer()
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
    }
}

// MARK: - Open on iPhone

struct ShareScreen: View {
    @EnvironmentObject var c: Conductor
    var body: some View {
        let url = c.config.shareURL(live: c.mode == .live)
        HStack(spacing: 80) {
            VStack(alignment: .leading, spacing: 26) {
                ScreenTitle(title: "Open on iPhone")
                Text("Point your iPhone camera at the code. Earth MIDI opens on earthmidi.com with this exact mix: key, scale, sounds, genre and levels.")
                    .font(.system(size: 30)).foregroundStyle(Theme.fg).frame(width: 880, alignment: .leading)
                Text("From there you can record WAV and MIDI, export stems for your DAW, and send MIDI to your gear.")
                    .font(.system(size: 26)).foregroundStyle(Theme.fg2).frame(width: 880, alignment: .leading)
                if let p = c.presetName { Text("Mix: \(p)").font(Theme.mono(24)).foregroundStyle(Theme.color("x")) }
                Button {} label: { Text("earthmidi.com").font(Theme.mono(22)) }.buttonStyle(PillStyle(tint: Theme.fg2))
            }
            QRCode(text: url.absoluteString).frame(width: 520, height: 520)
                .padding(30).background(RoundedRectangle(cornerRadius: 30).fill(.white))
        }
        .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
    }
}

struct QRCode: View {
    let text: String
    var body: some View {
        if let img = Self.make(text) { Image(uiImage: img).interpolation(.none).resizable().scaledToFit() }
        else { Color.white }
    }
    static func make(_ s: String) -> UIImage? {
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(s.utf8); f.correctionLevel = "M"
        guard let out = f.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

// MARK: - Last 24 hours (1.2)

struct ReplayScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var hub: PlayerHub
    var body: some View {
        ZStack(alignment: .bottom) {
            PadButton { hub.toggle() }
                .onMoveCommand { d in
                    if d == .left { c.seek(c.replayFrac - 0.03) } else if d == .right { c.seek(c.replayFrac + 0.03) }
                }
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("LAST 24 HOURS").font(Theme.title(36))
                    Spacer()
                    Text("HEARING " + c.clock.formatted(date: .omitted, time: .shortened)).font(Theme.mono(30, .semibold))
                }
                Caps(text: "Swipe ← → to scrub · Click to play or pause · \(Int(86400 / c.replaySeconds))× speed", size: 17)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 12).fill(Theme.sf0)
                        Canvas { ctx, size in
                            let t1 = Date().timeIntervalSince1970, t0 = t1 - 86400
                            for q in c.data.quakes24h {
                                let x = (q.time.timeIntervalSince1970 - t0) / 86400 * size.width, h = mapv(q.mag, 0, 7, 4, size.height)
                                ctx.fill(Path(CGRect(x: x, y: size.height - h, width: 2, height: h)), with: .color(Theme.color("q").opacity(0.3 + q.mag / 10)))
                            }
                        }
                        Rectangle().fill(.white).frame(width: 4).shadow(color: .white, radius: 8).offset(x: geo.size.width * c.replayFrac)
                    }
                }
                .frame(height: 110)
                HStack { Caps(text: "24 h ago"); Spacer(); Caps(text: "now") }
            }
            .padding(32).background(RoundedRectangle(cornerRadius: 28).fill(TV.panel))
            .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
            .allowsHitTesting(false)
        }
        .onAppear { c.mode = .replay; if !c.isPlaying { hub.play() } }
        .onDisappear { c.mode = .live }
    }
}

// MARK: - Zeus Mode (1.2)

struct ZeusScreen: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var g: GlobeState
    @State private var tool = 0
    private let tools = [("Quake", "Click to strike"), ("Storm", "Click to spin one up"), ("Aurora", "Click to raise it"), ("Solar flare", "Click to fire"), ("Moon + tide", "Click to pull the tide")]
    private let gold = Theme.hex(0xffc83d)

    var body: some View {
        ZStack(alignment: .topLeading) {
            PadButton { strike() }
                .onMoveCommand { d in move(d) }
                .onPlayPauseCommand { tool = (tool + 1) % tools.count }
            VStack(alignment: .leading, spacing: 18) {
                ScreenTitle(title: "Zeus Mode", hint: "Not real data · you are the weather", tint: gold)
                Text("The live layers fade. Swipe to aim, click to use the tool, Play/Pause for the next tool.")
                    .font(.system(size: 24)).foregroundStyle(Theme.fg2).frame(width: 760, alignment: .leading)
                Spacer()
                HStack(spacing: 18) {
                    ForEach(tools.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(tools[i].0).font(.system(size: 26, weight: .semibold)).foregroundStyle(i == tool ? .black : gold)
                            Text(tools[i].1).font(Theme.mono(16)).foregroundStyle(i == tool ? .black.opacity(0.7) : Theme.fg2)
                        }
                        .padding(.horizontal, 22).padding(.vertical, 14)
                        .background(RoundedRectangle(cornerRadius: 16).fill(i == tool ? gold : Color.black.opacity(0.6)))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(gold.opacity(0.4)))
                    }
                }
                if c.zeusAurora > 0 { Text(String(format: "Aurora %.0f%% · Kp %.1f", c.zeusAurora * 100, c.kp)).font(Theme.mono(20)).foregroundStyle(Theme.color("g")) }
            }
            .padding(.horizontal, TV.gutterH).padding(.vertical, TV.gutterV)
            .allowsHitTesting(false)
        }
        .onAppear { g.spin = false; g.cursor = (20, g.centerLon) }
    }

    private func move(_ d: MoveCommandDirection) {
        guard var cur = g.cursor else { return }
        switch d {
        case .left: cur.lon -= 8
        case .right: cur.lon += 8
        case .up: cur.lat = min(75, cur.lat + 6)
        case .down: cur.lat = max(-75, cur.lat - 6)
        @unknown default: break
        }
        cur.lon = (cur.lon + 540).truncatingRemainder(dividingBy: 360) - 180
        g.cursor = cur
        // keep the cursor on the near side
        var off = cur.lon - g.centerLon
        off = (off + 540).truncatingRemainder(dividingBy: 360) - 180
        if abs(off) > 45 { withAnimation(.easeOut(duration: 0.5)) { g.lonOffset += off > 0 ? off - 45 : off + 45 } }
    }
    private func strike() {
        guard let cur = g.cursor else { return }
        switch tool {
        case 0: c.zeusQuake(lat: cur.lat, lon: cur.lon, mag: Double.random(in: 3.5...7.8))
        case 1: c.zeusStorm(lat: cur.lat, lon: cur.lon)
        case 2: c.zeusAurora = c.zeusAurora >= 1 ? 0 : min(1, c.zeusAurora + 0.25)
        case 3: c.zeusFlare()
        default: c.zeusTide()
        }
    }
}
