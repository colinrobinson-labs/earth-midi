import SwiftUI

/// Slowly turning orthographic globe: coastlines (Natural Earth 110m), the last day's quakes as embers,
/// and a ring that blooms where each quake plays.
struct GlobeView: View {
    @EnvironmentObject var c: Conductor
    private static let land: [[(Double, Double)]] = {
        guard let url = Bundle.main.url(forResource: "land", withExtension: "json"), let d = try? Data(contentsOf: url),
              let a = try? JSONSerialization.jsonObject(with: d) as? [[[Double]]] else { return [] }
        return a.map { $0.compactMap { $0.count >= 2 ? ($0[0], $0[1]) : nil } }
    }()
    private let start = Date()

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { tl in
            Canvas { ctx, size in
                let t = tl.date.timeIntervalSince(start)
                let R = min(size.width, size.height) * 0.42
                let cx = size.width * 0.62, cy = size.height * 0.5
                let lon0 = (-150 + t * 2.4).truncatingRemainder(dividingBy: 360) * .pi / 180, lat0 = 18 * Double.pi / 180
                let s0 = sin(lat0), c0 = cos(lat0)
                func proj(_ lat: Double, _ lon: Double) -> CGPoint? {
                    let p = lat * .pi / 180, l = lon * .pi / 180 - lon0
                    let cosc = s0 * sin(p) + c0 * cos(p) * cos(l)
                    guard cosc > 0 else { return nil }
                    return CGPoint(x: cx + R * cos(p) * sin(l), y: cy - R * (c0 * sin(p) - s0 * cos(p) * cos(l)))
                }
                // atmosphere + disc
                let disc = Path(ellipseIn: CGRect(x: cx - R, y: cy - R, width: 2 * R, height: 2 * R))
                let glow = Path(ellipseIn: CGRect(x: cx - R * 1.25, y: cy - R * 1.25, width: 2.5 * R, height: 2.5 * R))
                ctx.fill(glow, with: .radialGradient(Gradient(colors: [Theme.hex(0x3cc8ff).opacity(0.22), .clear]), center: CGPoint(x: cx, y: cy), startRadius: R * 0.92, endRadius: R * 1.25))
                ctx.fill(disc, with: .radialGradient(Gradient(colors: [Theme.hex(0x111a24), Theme.hex(0x070a0e)]), center: CGPoint(x: cx - R * 0.3, y: cy - R * 0.35), startRadius: 0, endRadius: R * 1.3))
                // graticule
                var grid = Path()
                for lat in stride(from: -60.0, through: 60, by: 30) {
                    var on = false
                    for lon in stride(from: -180.0, through: 180, by: 3) {
                        if let p = proj(lat, lon) { if on { grid.addLine(to: p) } else { grid.move(to: p); on = true } } else { on = false }
                    }
                }
                for lon in stride(from: -180.0, to: 180, by: 30) {
                    var on = false
                    for lat in stride(from: -90.0, through: 90, by: 3) {
                        if let p = proj(lat, lon) { if on { grid.addLine(to: p) } else { grid.move(to: p); on = true } } else { on = false }
                    }
                }
                ctx.stroke(grid, with: .color(.white.opacity(0.05)), lineWidth: 1)
                // coastlines
                var coast = Path()
                for ring in Self.land {
                    var on = false
                    for (lon, lat) in ring {
                        if let p = proj(lat, lon) { if on { coast.addLine(to: p) } else { coast.move(to: p); on = true } } else { on = false }
                    }
                }
                ctx.stroke(coast, with: .color(Theme.hex(0x9ad1ff).opacity(0.42)), lineWidth: 1.4)
                // the last day's quakes, brighter when recent
                let now = c.clock.timeIntervalSince1970
                for q in c.data.quakes24h where q.time.timeIntervalSince1970 <= now + 1 {
                    guard let p = proj(q.lat, q.lon) else { continue }
                    let age = max(0, now - q.time.timeIntervalSince1970) / 86400
                    let r = 1.5 + q.mag * 1.3
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r)), with: .color(Theme.color("q").opacity(0.15 + 0.55 * (1 - age))))
                }
                // rings where quakes are playing right now
                let wall = tl.date
                for e in c.events where e.layer == "q" {
                    let age = wall.timeIntervalSince(e.at)
                    guard age < 7, let lat = e.lat, let lon = e.lon, let p = proj(lat, lon) else { continue }
                    let m = e.mag ?? 2
                    let r = 6 + age * (10 + m * 9)
                    let ring = Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r))
                    ctx.stroke(ring, with: .color(Theme.color("q").opacity(max(0, 1 - age / 7))), lineWidth: 2 + m * 0.5)
                }
                // rim
                ctx.stroke(disc, with: .linearGradient(Gradient(colors: [Theme.hex(0xffc53d), Theme.hex(0x7cff9e), Theme.hex(0x3cc8ff), Theme.hex(0xc77dff)]),
                                                       startPoint: CGPoint(x: cx - R, y: cy - R), endPoint: CGPoint(x: cx + R, y: cy + R)), lineWidth: 2)
                // planet-chord cities
                for city in EarthData.cities {
                    guard let p = proj(city.lat, city.lon) else { continue }
                    let pulse = 0.5 + 0.5 * sin(t * 1.3 + city.lon)
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6)), with: .color(Theme.color("c").opacity(0.4 + 0.4 * pulse)))
                }
            }
        }
        .accessibilityLabel("Globe with the last day's earthquakes")
    }
}
