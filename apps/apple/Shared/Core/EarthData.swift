import Foundation

/// A time series: t in seconds since 1970, values may be NaN.
struct Series: Hashable, Sendable {
    var t: [Double] = []
    var v: [Double] = []
    var isEmpty: Bool { v.isEmpty }
    var last: Double? { v.last(where: { $0.isFinite }) }
    /// Linear interpolation, held at the ends (js/core.js at())
    func at(_ time: Double) -> Double {
        guard !v.isEmpty, t.count == v.count else { return .nan }
        if time <= t[0] { return v[0] }
        var lo = 0, hi = t.count - 1
        if time >= t[hi] { return v[hi] }
        while hi - lo > 1 { let m = (lo + hi) >> 1; if t[m] <= time { lo = m } else { hi = m } }
        let a = v[lo], b = v[hi]
        if !a.isFinite { return b }
        if !b.isFinite { return a }
        let span = t[hi] - t[lo]
        return a + (b - a) * (time - t[lo]) / (span == 0 ? 1 : span)
    }
    var minV: Double { v.filter(\.isFinite).min() ?? 0 }
    var maxV: Double { v.filter(\.isFinite).max() ?? 0 }
}

struct Quake: Identifiable, Hashable, Sendable {
    let id: String
    let mag: Double
    let place: String
    let time: Date
    let lat: Double
    let lon: Double
    let depth: Double
    let url: String?
}

struct Place: Hashable, Sendable {
    let name: String
    let lat: Double
    let lon: Double
}

struct PlaceSeries: Hashable, Sendable, Identifiable {
    var id: String { place.name }
    let place: Place
    var series: Series
    var extra: Series = Series() // ocean: wave period history unused; current period in `period`
    var period: Double = 8
}

/// Everything the apps need from the planet, read from earthmidi.com's snapshot (the same cache the site uses).
struct EarthReadings: Sendable {
    var quakes: [Quake] = []
    var speed = Series(), density = Series(), bz = Series(), bt = Series()
    var kp = Series()
    var xray = Series()
    var dst = Series()
    var ocean: [PlaceSeries] = []
    var jet: [PlaceSeries] = []
    var tides: [PlaceSeries] = []
    var temps: [PlaceSeries] = []
    var snapshotAt: Date?
    /// Where weather and city temperatures came from: "open-meteo" or "weatherkit" (the switch in docs/weatherkit.md).
    /// The snapshot job does the WeatherKit calls; the apps only read the result, so no key ships in the app.
    var weatherSource = "open-meteo"
    var weatherLegal = URL(string: "https://weatherkit.apple.com/legal-attribution.html")!
    var weatherLogo: URL?
    var isAppleWeather: Bool { weatherSource == "weatherkit" && !temps.isEmpty }
    var loadedAt = Date.distantPast
    var isDemo = false

    // MARK: readings at a moment (seconds since 1970)
    func kp(at time: Double) -> Double {
        var v = kp.v.last ?? 2
        for (i, t) in kp.t.enumerated() where t <= time { v = kp.v[i] }
        return v.isFinite ? v : 2
    }
    func ocean(at time: Double) -> (h: Double, p: Double) {
        guard !ocean.isEmpty else { return (0, 8) }
        let hs = ocean.map { $0.series.at(time) }.filter(\.isFinite)
        let h = hs.isEmpty ? 0 : hs.reduce(0, +) / Double(hs.count)
        let p = ocean.map(\.period).reduce(0, +) / Double(ocean.count)
        return (h, p)
    }
    func jet(at time: Double) -> Double {
        let v = jet.map { $0.series.at(time) }.filter(\.isFinite)
        return v.isEmpty ? .nan : v.reduce(0, +) / Double(v.count)
    }
    /// Tide −1…1 across the last day's range (js tideNorm)
    func tideNorm(at time: Double, station: Int = 0) -> Double {
        guard tides.indices.contains(station) else { return 0 }
        let s = tides[station].series, v = s.at(time), mn = s.minV, mx = s.maxV
        return mx > mn ? (v - mn) / (mx - mn) * 2 - 1 : 0
    }
    var now: Double { Date().timeIntervalSince1970 }
    var kpNow: Double { kp(at: now) }
    var speedNow: Double { speed.at(now) }
    var densityNow: Double { density.at(now) }
    var bzNow: Double { bz.at(now) }
    var xrayNow: Double { xray.at(now) }
    var quakes24h: [Quake] { quakes.filter { $0.time.timeIntervalSinceNow > -86400 } }
    var biggest24h: Quake? { quakes24h.max { $0.mag < $1.mag } }
    var latest: Quake? { quakes.max { $0.time < $1.time } }
}

// MARK: - Loading

enum EarthData {
    static let snapshotURL = URL(string: "https://earthmidi.com/data/live.json")!
    static let usgsURL = URL(string: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson")!
    static let kpURL = URL(string: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json")!

    // Same point lists as js/feeds.js (order matters: the snapshot keeps the API's order)
    static let oceanPts = [Place(name: "N Pacific", lat: 30, lon: -150), Place(name: "Gulf of Alaska", lat: 55, lon: -145), Place(name: "N Atlantic", lat: 50, lon: -30), Place(name: "S Atlantic", lat: -35, lon: -20), Place(name: "Cape of Good Hope", lat: -38, lon: 20), Place(name: "S Indian", lat: -40, lon: 80), Place(name: "Bay of Bengal", lat: 14, lon: 88), Place(name: "Tasman Sea", lat: -38, lon: 160), Place(name: "Southern Ocean", lat: -55, lon: -90), Place(name: "Philippine Sea", lat: 20, lon: 135)]
    static let jetPts = [Place(name: "N Atlantic", lat: 45, lon: -40), Place(name: "N Pacific", lat: 38, lon: 165), Place(name: "N America", lat: 42, lon: -95), Place(name: "Eurasia", lat: 45, lon: 70), Place(name: "S Indian", lat: -45, lon: 90), Place(name: "S Pacific", lat: -45, lon: -120)]
    static let cities = [Place(name: "Reykjavík", lat: 64.14, lon: -21.9), Place(name: "Anchorage", lat: 61.2, lon: -149.9), Place(name: "Tokyo", lat: 35.68, lon: 139.69), Place(name: "Los Angeles", lat: 34.05, lon: -118.24), Place(name: "Cairo", lat: 30.04, lon: 31.24), Place(name: "Mumbai", lat: 19.08, lon: 72.88), Place(name: "Singapore", lat: 1.35, lon: 103.82), Place(name: "Nairobi", lat: -1.29, lon: 36.82), Place(name: "São Paulo", lat: -23.55, lon: -46.63), Place(name: "Sydney", lat: -33.87, lon: 151.21)]
    static let tideStations = [("La Jolla", "9410230", 32.87, -117.26), ("The Battery, NY", "8518750", 40.7, -74.01), ("Honolulu", "1612340", 21.31, -157.87)]

    private static var cacheURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("earthmidi-live.json")
    }

    /// Snapshot first (one small request, kind to the free public APIs); the sources directly only if it fails;
    /// then the last copy on this device; demo data only if there is nothing at all.
    static func load() async -> EarthReadings {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 15
        let session = URLSession(configuration: cfg)
        if let (data, _) = try? await session.data(from: snapshotURL), let r = parseSnapshot(data), !r.quakes.isEmpty || !r.speed.isEmpty {
            if let c = cacheURL { try? data.write(to: c) }
            return r
        }
        var r = EarthReadings()
        if let (d, _) = try? await session.data(from: usgsURL), let j = try? JSONSerialization.jsonObject(with: d) { r.quakes = parseQuakes(j) }
        if let (d, _) = try? await session.data(from: kpURL), let j = try? JSONSerialization.jsonObject(with: d) { r.kp = parseKp(j) }
        if !r.quakes.isEmpty { r.loadedAt = Date(); return r }
        if let c = cacheURL, let d = try? Data(contentsOf: c), var cached = parseSnapshot(d) { cached.loadedAt = Date(); return cached }
        return demo()
    }

    /// The last snapshot saved on this device, shown at once while a fresh one loads.
    static func cached() -> EarthReadings? {
        guard let c = cacheURL, let d = try? Data(contentsOf: c), let r = parseSnapshot(d), !r.quakes.isEmpty || !r.speed.isEmpty else { return nil }
        return r
    }

    static func parseSnapshot(_ data: Data) -> EarthReadings? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let feeds = root["feeds"] as? [String: Any] else { return nil }
        func feedEntry(_ match: String) -> [String: Any]? {
            for (url, v) in feeds where url.contains(match) { return v as? [String: Any] }
            return nil
        }
        func feed(_ match: String) -> Any? { feedEntry(match)?["data"] }
        var r = EarthReadings()
        if let at = root["at"] as? Double { r.snapshotAt = Date(timeIntervalSince1970: at / 1000) }
        if let tf = feedEntry("hourly=temperature_2m&past_days"), let src = tf["src"] as? String { r.weatherSource = src }
        if let wk = root["wk"] as? [String: Any] {
            if let l = wk["legal"] as? String, let u = URL(string: l) { r.weatherLegal = u }
            if let logo = (wk["logo"] as? [String: Any])?["dark"] as? String { r.weatherLogo = URL(string: logo, relativeTo: snapshotURL)?.absoluteURL }
        }
        if let j = feed("all_day.geojson") { r.quakes = parseQuakes(j) }
        if let p = feed("rtsw_wind_1m") as? [[String: Any]] {
            let rows = p.filter { ($0["active"] as? Bool) == true }.compactMap { row -> (Double, Double, Double)? in
                guard let t = swpcTime(row["time_tag"]), let sp = num(row["proton_speed"]), sp.isFinite else { return nil }
                return (t, sp, num(row["proton_density"]) ?? .nan)
            }.sorted { $0.0 < $1.0 }
            r.speed = Series(t: rows.map(\.0), v: rows.map(\.1)); r.density = Series(t: rows.map(\.0), v: rows.map(\.2))
        }
        if let m = feed("rtsw_mag_1m") as? [[String: Any]] {
            let rows = m.filter { ($0["active"] as? Bool) == true }.compactMap { row -> (Double, Double, Double)? in
                guard let t = swpcTime(row["time_tag"]), let bz = num(row["bz_gsm"]), bz.isFinite else { return nil }
                return (t, bz, num(row["bt"]) ?? .nan)
            }.sorted { $0.0 < $1.0 }
            r.bz = Series(t: rows.map(\.0), v: rows.map(\.1)); r.bt = Series(t: rows.map(\.0), v: rows.map(\.2))
        }
        if let k = feed("noaa-planetary-k-index") { r.kp = parseKp(k) }
        if let x = feed("xrays-1-day") as? [[String: Any]] {
            let rows = x.filter { ($0["energy"] as? String) == "0.1-0.8nm" }.compactMap { row -> (Double, Double)? in
                guard let t = isoTime(row["time_tag"]), let f = num(row["flux"]), f > 0 else { return nil }
                return (t, f)
            }
            r.xray = Series(t: rows.map(\.0), v: rows.map(\.1))
        }
        if let d = feed("kyoto-dst") { let rows = swpcTable(d, key: "dst"); r.dst = Series(t: rows.map(\.0), v: rows.map(\.1)) }
        if let o = feed("marine-api") as? [[String: Any]] {
            r.ocean = o.enumerated().compactMap { i, x in
                guard oceanPts.indices.contains(i) else { return nil }
                let cur = x["current"] as? [String: Any], h = x["hourly"] as? [String: Any]
                var ps = PlaceSeries(place: oceanPts[i], series: omSeries(h, "wave_height"))
                ps.period = num(cur?["wave_period"]) ?? 8
                if ps.series.isEmpty, let ch = num(cur?["wave_height"]) { ps.series = Series(t: [Date().timeIntervalSince1970], v: [ch]) }
                return ps
            }
        }
        if let j = feed("wind_speed_250hPa") as? [[String: Any]] {
            r.jet = j.enumerated().compactMap { i, x in jetPts.indices.contains(i) ? PlaceSeries(place: jetPts[i], series: omSeries(x["hourly"] as? [String: Any], "wind_speed_250hPa")) : nil }
        }
        if let j = feed("hourly=temperature_2m&past_days") as? [[String: Any]] {
            r.temps = j.enumerated().compactMap { i, x in cities.indices.contains(i) ? PlaceSeries(place: cities[i], series: omSeries(x["hourly"] as? [String: Any], "temperature_2m")) : nil }
        }
        r.tides = tideStations.compactMap { st in
            guard let j = feed("station=\(st.1)") as? [String: Any], let rows = j["data"] as? [[String: Any]] else { return nil }
            let pts = rows.compactMap { row -> (Double, Double)? in
                guard let ts = row["t"] as? String, let t = isoTime(ts.replacingOccurrences(of: " ", with: "T") + ":00Z"), let v = num(row["v"]) else { return nil }
                return (t, v)
            }
            guard !pts.isEmpty else { return nil }
            return PlaceSeries(place: Place(name: st.0, lat: st.2, lon: st.3), series: Series(t: pts.map(\.0), v: pts.map(\.1)))
        }
        r.loadedAt = Date()
        return r
    }

    static func parseQuakes(_ j: Any) -> [Quake] {
        guard let feats = (j as? [String: Any])?["features"] as? [[String: Any]] else { return [] }
        return feats.compactMap { f in
            guard let id = f["id"] as? String, let p = f["properties"] as? [String: Any],
                  let c = (f["geometry"] as? [String: Any])?["coordinates"] as? [Any], c.count >= 2,
                  let lon = num(c[0]), let lat = num(c[1]), let t = num(p["time"]) else { return nil }
            return Quake(id: id, mag: num(p["mag"]) ?? 0, place: (p["place"] as? String) ?? "", time: Date(timeIntervalSince1970: t / 1000),
                         lat: lat, lon: lon, depth: max(0, c.count > 2 ? (num(c[2]) ?? 0) : 0), url: p["url"] as? String)
        }.sorted { $0.time < $1.time }
    }

    static func parseKp(_ j: Any) -> Series {
        let rows = swpcTable(j, key: "Kp", alt: ["kp_index", "kp"])
        return Series(t: rows.map(\.0), v: rows.map(\.1))
    }

    /// SWPC "products": header row + rows, or a list of objects
    static func swpcTable(_ j: Any, key: String, alt: [String] = []) -> [(Double, Double)] {
        var out: [(Double, Double)] = []
        if let a = j as? [[Any]], let head = a.first as? [String] {
            let ti = head.firstIndex(of: "time_tag") ?? 0
            let ki = head.firstIndex(of: key) ?? alt.compactMap { head.firstIndex(of: $0) }.first
            guard let ki else { return [] }
            for row in a.dropFirst() where row.count > max(ti, ki) {
                if let t = swpcTime(row[ti]), let v = num(row[ki]), v.isFinite { out.append((t, v)) }
            }
        } else if let a = j as? [[String: Any]] {
            for row in a {
                let v = num(row[key]) ?? alt.compactMap { num(row[$0]) }.first
                if let t = swpcTime(row["time_tag"]), let v, v.isFinite { out.append((t, v)) }
            }
        }
        return out.sorted { $0.0 < $1.0 }
    }

    static func omSeries(_ hourly: [String: Any]?, _ key: String) -> Series {
        guard let h = hourly, let times = h["time"] as? [String], let vals = h[key] as? [Any] else { return Series() }
        var t: [Double] = [], v: [Double] = []
        for (i, s) in times.enumerated() where i < vals.count {
            if let tt = isoTime(s + (s.count <= 16 ? ":00Z" : "Z")) { t.append(tt); v.append(num(vals[i]) ?? .nan) }
        }
        return Series(t: t, v: v)
    }

    static func num(_ x: Any?) -> Double? {
        switch x {
        case let d as Double: return d
        case let i as Int: return Double(i)
        case let n as NSNumber: return n.doubleValue
        case let s as String: return s.isEmpty ? nil : Double(s)
        default: return nil
        }
    }
    private static let isoFrac: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    private static let iso: ISO8601DateFormatter = ISO8601DateFormatter()
    static func isoTime(_ x: Any?) -> Double? {
        guard let s = x as? String else { return nil }
        return (iso.date(from: s) ?? isoFrac.date(from: s))?.timeIntervalSince1970
    }
    /// SWPC times: "2026-11-07 15:12:00.000" or "2026-11-07T15:12:00" (UTC unless marked)
    static func swpcTime(_ x: Any?) -> Double? {
        guard var s = x as? String else { return nil }
        s = s.replacingOccurrences(of: " ", with: "T")
        if let dot = s.firstIndex(of: "."), !s.hasSuffix("Z") { s = String(s[..<dot]) }
        if !(s.hasSuffix("Z") || s.range(of: #"[+-]\d\d:?\d\d$"#, options: .regularExpression) != nil) { s += "Z" }
        return isoTime(s)
    }

    /// Clearly-labelled demo data, only used when nothing real has ever loaded on this device.
    static func demo() -> EarthReadings {
        var r = EarthReadings(); r.isDemo = true; r.loadedAt = Date()
        let now = Date().timeIntervalSince1970, t0 = now - 86400
        r.quakes = (0..<120).map { i in
            let s = Double(i)
            return Quake(id: "demo\(i)", mag: 0.8 + 4.5 * pow(abs(sin(s * 12.9898)), 2.2), place: "demo data", time: Date(timeIntervalSince1970: t0 + s * 720),
                         lat: 35 + 20 * sin(s), lon: -120 + 60 * cos(s * 0.7), depth: 300 * pow(abs(sin(s * 3.1)), 2), url: nil)
        }
        let ts = (0..<288).map { t0 + Double($0) * 300 }
        r.speed = Series(t: ts, v: ts.indices.map { 430 + 60 * sin(Double($0) / 9) })
        r.density = Series(t: ts, v: ts.indices.map { 5 + 3 * sin(Double($0) / 9) })
        r.bz = Series(t: ts, v: ts.indices.map { -1 + 5 * sin(Double($0) / 9) })
        r.bt = Series(t: ts, v: ts.indices.map { _ in 6 })
        r.kp = Series(t: [now - 3600], v: [2])
        return r
    }
}
