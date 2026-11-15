import TVServices
import UIKit

/// Top Shelf: a live banner (Kp, quakes today, the latest flare class) and shortcuts that open the app
/// straight into playing, a preset, or Ambient mode. Images are drawn here from the live snapshot.
final class ContentProvider: TVTopShelfContentProvider {
    override func loadTopShelfContent() async -> (any TVTopShelfContent)? {
        let live = await Live.load()
        var items: [TVTopShelfSectionedItem] = []
        func item(_ id: String, _ title: String, _ eyebrow: String, _ line: String, _ tint: UIColor, _ url: String) {
            let it = TVTopShelfSectionedItem(identifier: id)
            it.title = title
            it.imageShape = .hdtv
            if let file = Art.card(id: id, eyebrow: eyebrow, title: title, line: line, tint: tint) { it.setImageURL(file, for: .screenScale1x); it.setImageURL(file, for: .screenScale2x) }
            if let u = URL(string: url) { it.playAction = TVTopShelfAction(url: u); it.displayAction = TVTopShelfAction(url: u) }
            items.append(it)
        }
        item("live", "Play the planet", "LIVE NOW", live.summary, UIColor(red: 1, green: 0.35, blue: 0.24, alpha: 1), "earthmidi://play")
        item("ambient", "Ambient mode", "ALL NIGHT", "Just the planet and the time", UIColor(red: 0.49, green: 1, blue: 0.62, alpha: 1), "earthmidi://ambient")
        item("ring", "Ring of Fire", "PRESET", "Pacific quakes as gongs", UIColor(red: 1, green: 0.62, blue: 0.26, alpha: 1), "earthmidi://preset/Ring%20of%20Fire")
        item("deep", "Deep ambient", "PRESET", "Slow cathedral wash", UIColor(red: 0.24, green: 0.78, blue: 1, alpha: 1), "earthmidi://preset/Deep%20ambient")
        item("space", "Space weather", "PRESET", "Solar wind, X-rays, aurora", UIColor(red: 0.78, green: 0.49, blue: 1, alpha: 1), "earthmidi://preset/Space%20weather")
        item("techno", "Seismic techno", "PRESET", "Four on the floor, 124–136", UIColor(red: 1, green: 0.77, blue: 0.24, alpha: 1), "earthmidi://preset/Seismic%20techno")
        let section = TVTopShelfItemCollection(items: items)
        section.title = live.kp.map { String(format: "Earth MIDI · Kp %.1f", $0) } ?? "Earth MIDI"
        return TVTopShelfSectionedContent(sections: [section])
    }
}

/// The few live numbers the shelf shows, from the same snapshot the app and site read
private struct Live {
    var kp: Double?, quakes = 0, biggest = 0.0
    var summary: String {
        var s: [String] = []
        if quakes > 0 { s.append("\(quakes) quakes today") }
        if biggest > 0 { s.append(String(format: "biggest M%.1f", biggest)) }
        if let kp { s.append(String(format: "Kp %.1f", kp)) }
        return s.isEmpty ? "Every note from a live sensor" : s.joined(separator: " · ")
    }
    static func load() async -> Live {
        var r = Live()
        guard let url = URL(string: "https://earthmidi.com/data/live.json"),
              let (d, _) = try? await URLSession.shared.data(from: url),
              let root = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let feeds = root["feeds"] as? [String: Any] else { return r }
        for (u, v) in feeds {
            let data = (v as? [String: Any])?["data"]
            if u.contains("all_day.geojson"), let f = (data as? [String: Any])?["features"] as? [[String: Any]] {
                r.quakes = f.count
                r.biggest = f.compactMap { (($0["properties"] as? [String: Any])?["mag"] as? NSNumber)?.doubleValue }.max() ?? 0
            }
            if u.contains("noaa-planetary-k-index"), let rows = data as? [[Any]], let head = rows.first as? [String], let ki = head.firstIndex(of: "Kp"), let last = rows.last, last.count > ki {
                r.kp = (last[ki] as? NSNumber)?.doubleValue ?? Double("\(last[ki])")
            } else if u.contains("noaa-planetary-k-index"), let rows = data as? [[String: Any]], let last = rows.last {
                r.kp = (last["Kp"] as? NSNumber)?.doubleValue ?? (last["kp_index"] as? NSNumber)?.doubleValue
            }
        }
        return r
    }
}

/// Shelf art is hosted on earthmidi.com/tv/ (the system loads Top Shelf images itself, so they must be reachable by URL).
private enum Art {
    static func card(id: String, eyebrow: String, title: String, line: String, tint: UIColor) -> URL? {
        URL(string: "https://earthmidi.com/tv/shelf-\(id).png")
    }
}
