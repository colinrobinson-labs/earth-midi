import Foundation

/// Natural Earth 110 m coastlines (TV/Resources/land.json): rings of (lon, lat). Used to draw the globe and to tell when
/// the space station crosses a coast (its plucks ring brighter over land, like the site).
enum Land {
    static let rings: [[(Double, Double)]] = {
        guard let url = Bundle.main.url(forResource: "land", withExtension: "json"), let d = try? Data(contentsOf: url),
              let a = try? JSONSerialization.jsonObject(with: d) as? [[[Double]]] else { return [] }
        return a.map { $0.compactMap { $0.count >= 2 ? ($0[0], $0[1]) : nil } }
    }()
    private static let boxes: [(Double, Double, Double, Double)] = rings.map { r in
        (r.map(\.0).min() ?? 0, r.map(\.0).max() ?? 0, r.map(\.1).min() ?? 0, r.map(\.1).max() ?? 0)
    }
    /// Even-odd point in polygon over every ring
    static func contains(lat: Double, lon: Double) -> Bool {
        var inside = false
        for (i, r) in rings.enumerated() {
            let b = boxes[i]
            guard lon >= b.0, lon <= b.1, lat >= b.2, lat <= b.3, r.count > 2 else { continue }
            var j = r.count - 1
            for k in 0..<r.count {
                let (xi, yi) = r[k], (xj, yj) = r[j]
                if (yi > lat) != (yj > lat), lon < (xj - xi) * (lat - yi) / (yj - yi) + xi { inside.toggle() }
                j = k
            }
        }
        return inside
    }
}
