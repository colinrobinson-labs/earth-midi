import SwiftUI

/// Where the globe sits and how it turns. Screens move it out of the way; Explore and Zeus steer it.
@MainActor
final class GlobeState: ObservableObject {
    @Published var xFrac = 0.64          // horizontal centre as a fraction of the width
    @Published var scale = 0.42          // radius as a fraction of the shorter side
    @Published var spin = true
    @Published var lonOffset = 0.0       // user rotation, degrees
    @Published var tilt = 18.0           // centre latitude, degrees
    @Published var dim = 0.0             // 0…1 darkening behind full-screen panels
    @Published var cursor: (lat: Double, lon: Double)? = nil
    @Published var focusPoint: (lat: Double, lon: Double)? = nil
    var autoLon = -150.0
    var lastFrame = Date()
    var lastKicks = 0, breath = 0.0

    func place(x: Double, scale s: Double, dim d: Double = 0) {
        withAnimation(.easeInOut(duration: 0.7)) { xFrac = x; scale = s; dim = d }
    }
    /// The longitude at the centre of the disc right now
    var centerLon: Double { autoLon + lonOffset }
}

/// Orthographic globe drawn live: land with a day/night terminator and city lights, the aurora oval sized by Kp,
/// the jet stream, ocean swell, NASA events, the space station and its track, the last day's quakes and the rings
/// where they play, Zones, and Zeus Mode's marks. Everything on it comes from the same readings that make the sound.
struct GlobeView: View {
    @EnvironmentObject var c: Conductor
    @EnvironmentObject var g: GlobeState
    private let start = Date()
    private static let stars: [(Double, Double, Double)] = (0..<160).map { i in
        let a = Double(i)
        return ((sin(a * 12.9898) * 43758.5453).truncatingRemainder(dividingBy: 1).magnitude,
                (sin(a * 78.233) * 12543.1234).truncatingRemainder(dividingBy: 1).magnitude,
                0.15 + 0.5 * (sin(a * 3.7) * 0.5 + 0.5))
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { tl in
            Canvas { ctx, size in draw(&ctx, size, tl.date) }
        }
        .accessibilityLabel("Globe with live earthquakes, the space station, the aurora and the day-night line")
    }

    private func draw(_ ctx: inout GraphicsContext, _ size: CGSize, _ now: Date) {
        let t = now.timeIntervalSince(start)
        let dt = min(0.1, now.timeIntervalSince(g.lastFrame)); g.lastFrame = now
        if g.spin { g.autoLon += dt * 2.4 }
        // the globe breathes a little on each kick (Pulse)
        let k = c.kicks
        if k != g.lastKicks { g.lastKicks = k; g.breath = 1 } else { g.breath *= 0.86 }
        let br = g.breath

        // stars
        for s in Self.stars {
            let p = CGRect(x: s.0 * size.width, y: s.1 * size.height, width: 2, height: 2)
            ctx.fill(Path(p), with: .color(.white.opacity(s.2 * 0.6)))
        }
        let R = min(size.width, size.height) * g.scale * (1 + 0.012 * br)
        let cx = size.width * g.xFrac, cy = size.height * 0.5
        let lon0 = g.centerLon * .pi / 180, lat0 = g.tilt * .pi / 180
        let s0 = sin(lat0), c0 = cos(lat0)
        func view(_ lat: Double, _ lon: Double) -> (x: Double, y: Double, z: Double) {
            let p = lat * .pi / 180, l = lon * .pi / 180 - lon0
            return (cos(p) * sin(l), c0 * sin(p) - s0 * cos(p) * cos(l), s0 * sin(p) + c0 * cos(p) * cos(l))
        }
        func proj(_ lat: Double, _ lon: Double) -> CGPoint? {
            let v = view(lat, lon)
            guard v.z > 0 else { return nil }
            return CGPoint(x: cx + R * v.x, y: cy - R * v.y)
        }
        /// back-side points pushed to the rim, for filling shapes that cross the horizon
        func projClamp(_ lat: Double, _ lon: Double) -> CGPoint {
            let v = view(lat, lon)
            if v.z > 0 { return CGPoint(x: cx + R * v.x, y: cy - R * v.y) }
            let m = max(1e-6, hypot(v.x, v.y))
            return CGPoint(x: cx + R * v.x / m, y: cy - R * v.y / m)
        }
        func line(_ pts: [(Double, Double)]) -> Path {
            var path = Path(); var on = false
            for (la, lo) in pts { if let p = proj(la, lo) { if on { path.addLine(to: p) } else { path.move(to: p); on = true } } else { on = false } }
            return path
        }
        let zeus = c.zeus
        let gold = Theme.hex(0xffc83d)

        // atmosphere + disc
        let disc = Path(ellipseIn: CGRect(x: cx - R, y: cy - R, width: 2 * R, height: 2 * R))
        let glow = Path(ellipseIn: CGRect(x: cx - R * 1.3, y: cy - R * 1.3, width: 2.6 * R, height: 2.6 * R))
        ctx.fill(glow, with: .radialGradient(Gradient(colors: [(zeus ? gold : Theme.hex(0x3cc8ff)).opacity(0.24), .clear]), center: CGPoint(x: cx, y: cy), startRadius: R * 0.92, endRadius: R * 1.3))
        ctx.fill(disc, with: .radialGradient(Gradient(colors: [Theme.hex(0x13202c), Theme.hex(0x060a0e)]), center: CGPoint(x: cx - R * 0.3, y: cy - R * 0.35), startRadius: 0, endRadius: R * 1.3))

        var inner = ctx
        inner.clip(to: disc)
        // graticule
        var grid = Path()
        for lat in stride(from: -60.0, through: 60, by: 30) { grid.addPath(line(stride(from: -180.0, through: 180, by: 3).map { (lat, $0) })) }
        for lon in stride(from: -180.0, to: 180, by: 30) { grid.addPath(line(stride(from: -90.0, through: 90, by: 3).map { ($0, lon) })) }
        inner.stroke(grid, with: .color(.white.opacity(0.05)), lineWidth: 1)
        // land: filled, then coastlines
        var fill = Path(), coast = Path()
        for ring in Land.rings {
            guard ring.contains(where: { view($0.1, $0.0).z > -0.2 }) else { continue }
            var f = Path(); var first = true
            for (lon, lat) in ring { let p = projClamp(lat, lon); if first { f.move(to: p); first = false } else { f.addLine(to: p) } }
            f.closeSubpath(); fill.addPath(f)
            coast.addPath(line(ring.map { ($0.1, $0.0) }))
        }
        inner.fill(fill, with: .color(Theme.hex(0x7aa9cf).opacity(0.13)), style: FillStyle(eoFill: true))
        inner.stroke(coast, with: .color(Theme.hex(0x9ad1ff).opacity(0.5)), lineWidth: 1.4)

        // day / night
        let tNow = c.clock.timeIntervalSince1970
        let sp = Astro.sunPos(c.isPlaying ? tNow : Date().timeIntervalSince1970)
        let sv = view(sp.lat, sp.lon)
        // sunlit side: a soft warm glow centred on the subsolar point (pushed to the rim when it's behind)
        let sunM = max(1e-6, hypot(sv.x, sv.y))
        let sunPt = sv.z > 0 ? CGPoint(x: cx + R * sv.x, y: cy - R * sv.y) : CGPoint(x: cx + R * sv.x / sunM, y: cy - R * sv.y / sunM)
        inner.fill(disc, with: .radialGradient(Gradient(colors: [Theme.hex(0xbfe4ff).opacity(0.13), Theme.hex(0xbfe4ff).opacity(0.04), .clear]), center: sunPt, startRadius: 0, endRadius: R * 1.25))
        // terminator circle: points 90° from the subsolar point
        let sx = sv.x, sy = sv.y, sz = sv.z
        var ux = -sy, uy = sx, uz = 0.0
        var un = hypot(ux, uy); if un < 1e-6 { ux = 1; uy = 0; un = 1 }
        ux /= un; uy /= un
        let vx = sy * uz - sz * uy, vy = sz * ux - sx * uz, vz = sx * uy - sy * ux
        var term: [(Double, Double, Double)] = []
        for i in 0..<120 {
            let a = Double(i) / 120 * 2 * .pi
            term.append((cos(a) * ux + sin(a) * vx, cos(a) * uy + sin(a) * vy, cos(a) * uz + sin(a) * vz))
        }
        // rotate so the visible run is contiguous
        if let startIx = term.indices.first(where: { term[$0].2 >= 0 && term[(($0 - 1) + term.count) % term.count].2 < 0 }) {
            let run = (0..<term.count).map { term[($0 + startIx) % term.count] }.prefix { $0.2 >= 0 }
            if run.count > 1, let a = run.first, let b = run.last {
                var night = Path()
                night.move(to: CGPoint(x: cx + R * a.0, y: cy - R * a.1))
                for p in run { night.addLine(to: CGPoint(x: cx + R * p.0, y: cy - R * p.1)) }
                // back along the rim on the side facing away from the sun
                let aEnd = atan2(-b.1, b.0), aStart = atan2(-a.1, a.0), away = atan2(sy, -sx)
                func norm(_ x: Double) -> Double { var y = x; while y < 0 { y += 2 * .pi }; while y >= 2 * .pi { y -= 2 * .pi }; return y }
                let cw = norm(aStart - aEnd), mid = norm(aEnd + cw / 2)
                let useCW = abs(norm(mid - away + .pi) - .pi) < .pi / 2
                night.addArc(center: CGPoint(x: cx, y: cy), radius: R, startAngle: .radians(aEnd), endAngle: .radians(aStart), clockwise: !useCW)
                night.closeSubpath()
                inner.fill(night, with: .color(.black.opacity(0.5)))
                var tl = Path(); tl.move(to: CGPoint(x: cx + R * a.0, y: cy - R * a.1))
                for p in run { tl.addLine(to: CGPoint(x: cx + R * p.0, y: cy - R * p.1)) }
                if c.effectiveLevel("u") > 0 { inner.stroke(tl, with: .color(Theme.color("u").opacity(0.35)), lineWidth: 1.5) }
            }
        } else if sz < 0 {
            inner.fill(disc, with: .color(.black.opacity(0.5)))
        }
        // city lights on the night side
        for city in SunCities.all {
            guard let p = proj(city.1, city.2), Astro.sunElev(city.1, city.2, sp) < -3 else { continue }
            let r = 1.5 + sqrt(city.3) * 0.5
            inner.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(Theme.hex(0xffd27a).opacity(0.55)))
        }

        // aurora ovals, sized by Kp (equatorward as the sky gets stormy)
        if c.effectiveLevel("g") > 0 || zeus {
            let kpv = c.kp, ovalLat = 67 - kpv * 2.2
            for pole in [(80.7, -72.7), (-80.7, 107.3)] {
                var pts: [(Double, Double)] = []
                let d = (90 - ovalLat) * .pi / 180, pl = pole.0 * .pi / 180, plo = pole.1 * .pi / 180
                for i in 0...90 {
                    let b = Double(i) / 90 * 2 * .pi + t * 0.05
                    let wob = d * (1 + 0.05 * sin(b * 5 + t))
                    let la = asin(sin(pl) * cos(wob) + cos(pl) * sin(wob) * cos(b))
                    let lo = plo + atan2(sin(b) * sin(wob) * cos(pl), cos(wob) - sin(pl) * sin(la))
                    pts.append((la * 180 / .pi, lo * 180 / .pi))
                }
                let a = clamp(0.12 + kpv / 12, 0.12, 0.8)
                inner.stroke(line(pts), with: .color(Theme.color("g").opacity(a * 0.5)), lineWidth: R * 0.05)
                inner.stroke(line(pts), with: .color(Theme.color("g").opacity(a)), lineWidth: 2)
            }
        }
        // jet stream: a moving ribbon at each hemisphere's jet latitude, faster flow when the jet is strong
        if c.effectiveLevel("w") > 0 && !zeus {
            let jv = c.data.jet(at: tNow), sp2 = jv.isFinite ? jv : 150
            for (base, amp, ph) in [(45.0, 9.0, 0.0), (-47.0, 6.0, 1.7)] {
                var pts: [(Double, Double)] = []
                for lon in stride(from: -180.0, through: 180.0, by: 3.0) {
                    let wave: Double = sin(lon * Double.pi / 60.0 + t * 0.05 + ph)
                    pts.append((base + amp * wave, lon))
                }
                var st = StrokeStyle(lineWidth: 2.2, lineCap: .round, dash: [12, 10]); st.dashPhase = -t * sp2 * 0.12
                inner.stroke(line(pts), with: .color(Theme.color("w").opacity(0.42)), style: st)
            }
        }
        // ocean swell: each sea point breathes at its real period
        if c.effectiveLevel("o") > 0 && !zeus {
            for o in c.data.ocean {
                guard let p = proj(o.place.lat, o.place.lon) else { continue }
                let h = o.series.at(tNow), ph = (t / max(3, o.period)).truncatingRemainder(dividingBy: 1)
                let r = 4 + (h.isFinite ? h : 1) * 4 * ph
                inner.stroke(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(Theme.color("o").opacity(0.7 * (1 - ph))), lineWidth: 2)
            }
        }
        // NASA events
        if c.effectiveLevel("e") > 0 && !zeus {
            for e in c.more.events where e.start <= tNow {
                guard let p = proj(e.lat, e.lon) else { continue }
                switch e.kind {
                case .fire:
                    let fl = 0.5 + 0.5 * sin(t * 7 + e.lon)
                    inner.fill(Path(ellipseIn: CGRect(x: p.x - 2.5, y: p.y - 2.5, width: 5, height: 5)), with: .color(Theme.hex(0xff7a2e).opacity(0.45 + 0.4 * fl)))
                case .volcano:
                    var tri = Path(); tri.move(to: CGPoint(x: p.x, y: p.y - 7)); tri.addLine(to: CGPoint(x: p.x + 6, y: p.y + 5)); tri.addLine(to: CGPoint(x: p.x - 6, y: p.y + 5)); tri.closeSubpath()
                    inner.fill(tri, with: .color(Theme.hex(0xff3d2e).opacity(0.85)))
                case .storm:
                    var sp = Path()
                    for i in 0..<30 { let a = Double(i) * 0.4 - t * 2, r = Double(i) * 0.5; let q = CGPoint(x: p.x + r * cos(a), y: p.y + r * sin(a)); if i == 0 { sp.move(to: q) } else { sp.addLine(to: q) } }
                    inner.stroke(sp, with: .color(Theme.hex(0x9ad1ff).opacity(0.8)), lineWidth: 1.6)
                default:
                    inner.fill(Path(ellipseIn: CGRect(x: p.x - 2, y: p.y - 2, width: 4, height: 4)), with: .color(Theme.color("e").opacity(0.5)))
                }
            }
        }
        // zones
        if c.zone != "world" || c.sweep {
            if let boxes = Tunings.regionBoxes[c.zone] {
                for b in boxes {
                    var pts: [(Double, Double)] = []
                    for lo in stride(from: b[2], through: b[3], by: 2) { pts.append((b[1], lo)) }
                    for la in stride(from: b[1], through: b[0], by: -2) { pts.append((la, b[3])) }
                    for lo in stride(from: b[3], through: b[2], by: -2) { pts.append((b[0], lo)) }
                    for la in stride(from: b[0], through: b[1], by: 2) { pts.append((la, b[2])) }
                    var f = Path(); var first = true
                    for (la, lo) in pts { let p = projClamp(la, lo); if first { f.move(to: p); first = false } else { f.addLine(to: p) } }
                    f.closeSubpath()
                    inner.fill(f, with: .color(Theme.color("o").opacity(0.08)))
                    inner.stroke(line(pts), with: .color(Theme.color("o").opacity(0.8)), lineWidth: 2)
                }
            }
            if c.sweep {
                for edge in [-22.0, 22.0] { inner.stroke(line(stride(from: -85.0, through: 85, by: 3).map { ($0, c.sweepLon + edge) }), with: .color(Theme.color("o").opacity(0.55)), lineWidth: 2) }
                inner.stroke(line(stride(from: -85.0, through: 85, by: 3).map { ($0, c.sweepLon) }), with: .color(Theme.color("o")), lineWidth: 3)
            }
        }
        // the last day's quakes, brighter when recent and inside the zone
        if c.effectiveLevel("q") > 0 && !zeus {
            for q in c.data.quakes24h where q.time.timeIntervalSince1970 <= tNow + 1 && q.mag >= c.config.mmin {
                guard let p = proj(q.lat, q.lon) else { continue }
                let age = max(0, tNow - q.time.timeIntervalSince1970) / 86400
                let inside = Tunings.inRegion(c.zone, lat: q.lat, lon: q.lon) && Tunings.inRegion(c.config.region, lat: q.lat, lon: q.lon)
                let r = 1.5 + q.mag * 1.3
                inner.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(Theme.color("q").opacity(inside ? 0.15 + 0.55 * (1 - age) : 0.07)))
            }
        }
        // rings where quakes are playing right now (also Zeus strikes)
        for e in c.events where e.layer == "q" {
            let age = now.timeIntervalSince(e.at)
            guard age < 7, let lat = e.lat, let lon = e.lon, let p = proj(lat, lon) else { continue }
            let m = e.mag ?? 2
            let r = 6 + age * (10 + m * 9)
            inner.stroke(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color((zeus ? gold : Theme.color("q")).opacity(max(0, 1 - age / 7))), lineWidth: 2 + m * 0.5)
        }
        // sunrise flashes
        for e in c.events where e.layer == "u" {
            let age = now.timeIntervalSince(e.at)
            guard age < 5, let lat = e.lat, let lon = e.lon, let p = proj(lat, lon) else { continue }
            let r = 4 + age * 10
            inner.stroke(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(Theme.color("u").opacity(1 - age / 5)), lineWidth: 2)
        }
        // planet-chord cities
        if c.effectiveLevel("c") > 0 && !zeus {
            for city in EarthData.cities {
                guard let p = proj(city.lat, city.lon) else { continue }
                let pulse = 0.5 + 0.5 * sin(t * 1.3 + city.lon)
                inner.fill(Path(ellipseIn: CGRect(x: p.x - 4, y: p.y - 4, width: 8, height: 8)), with: .color(Theme.color("c").opacity(0.4 + 0.45 * pulse)))
            }
        }
        // space station and its next orbit
        if c.effectiveLevel("i") > 0 && !zeus {
            let base = c.isPlaying ? tNow : Date().timeIntervalSince1970
            let track = stride(from: -1200.0, through: 5400, by: 60).map { c.more.iss(at: base + $0) }.map { ($0.lat, $0.lon) }
            var segs: [[(Double, Double)]] = [[]]
            for (i, p) in track.enumerated() { if i > 0, abs(p.1 - track[i - 1].1) > 180 { segs.append([]) }; segs[segs.count - 1].append(p) }
            for s in segs { inner.stroke(line(s), with: .color(Theme.color("i").opacity(0.2)), style: StrokeStyle(lineWidth: 1.2, dash: [4, 6])) }
            let now2 = c.more.iss(at: base)
            if let p = proj(now2.lat, now2.lon) {
                let pulse = 0.5 + 0.5 * sin(t * 3)
                inner.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)), with: .color(Theme.color("i")))
                inner.stroke(Path(ellipseIn: CGRect(x: p.x - 9 - 4 * pulse, y: p.y - 9 - 4 * pulse, width: 18 + 8 * pulse, height: 18 + 8 * pulse)), with: .color(Theme.color("i").opacity(0.5)), lineWidth: 1.5)
            }
        }
        // Zeus Mode: storm spirals, aurora, cursor
        if zeus {
            for m in c.zeusMarks where m.kind == "storm" {
                guard let p = proj(m.lat, m.lon) else { continue }
                let age = now.timeIntervalSince(m.at)
                for j in 0..<3 {
                    var arc = Path()
                    arc.addArc(center: p, radius: R * 0.06 * Double(j + 1) + sin(t * 3 + Double(j)) * 3, startAngle: .radians(t * 2 + Double(j)), endAngle: .radians(t * 2 + Double(j) + 4.2), clockwise: false)
                    inner.stroke(arc, with: .color(gold.opacity(max(0, 0.6 - Double(j) * 0.15) * max(0, 1 - age / 14))), lineWidth: 2.5)
                }
            }
            if let cur = g.cursor, let p = proj(cur.lat, cur.lon) {
                var ch = Path()
                ch.move(to: CGPoint(x: p.x - 26, y: p.y)); ch.addLine(to: CGPoint(x: p.x - 8, y: p.y))
                ch.move(to: CGPoint(x: p.x + 8, y: p.y)); ch.addLine(to: CGPoint(x: p.x + 26, y: p.y))
                ch.move(to: CGPoint(x: p.x, y: p.y - 26)); ch.addLine(to: CGPoint(x: p.x, y: p.y - 8))
                ch.move(to: CGPoint(x: p.x, y: p.y + 8)); ch.addLine(to: CGPoint(x: p.x, y: p.y + 26))
                inner.stroke(ch, with: .color(gold), lineWidth: 3)
                inner.stroke(Path(ellipseIn: CGRect(x: p.x - 16, y: p.y - 16, width: 32, height: 32)), with: .color(gold.opacity(0.6 + 0.3 * sin(t * 4))), lineWidth: 2)
            }
        }
        // rim
        ctx.stroke(disc, with: .linearGradient(Gradient(colors: zeus ? [gold, Theme.hex(0xff9f43), gold] : [Theme.hex(0xffc53d), Theme.hex(0x7cff9e), Theme.hex(0x3cc8ff), Theme.hex(0xc77dff)]),
                                               startPoint: CGPoint(x: cx - R, y: cy - R), endPoint: CGPoint(x: cx + R, y: cy + R)), lineWidth: 2)
        // flare flash
        if c.flash > 0.01 { ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Theme.hex(0xffecb4).opacity(c.flash * 0.35))) }
        if g.dim > 0.01 { ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Theme.bg.opacity(g.dim))) }
    }
}
