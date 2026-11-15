import Foundation

/// Computed, not fetched: the sun, the moon and the space station's orbit (js/core.js).
enum Astro {
    static let d2r = Double.pi / 180

    /// Subsolar point (js sunPos)
    static func sunPos(_ t: Double) -> (lat: Double, lon: Double) {
        let d = Date(timeIntervalSince1970: t)
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let doy = Double(cal.ordinality(of: .day, in: .year, for: d) ?? 1)
        let c = cal.dateComponents([.hour, .minute, .second], from: d)
        let h = Double(c.hour ?? 0), m = Double(c.minute ?? 0), s = Double(c.second ?? 0)
        let g = 2 * Double.pi / 365 * (doy - 1 + (h - 12) / 24)
        let decl = 0.006918 - 0.399912 * cos(g) + 0.070257 * sin(g) - 0.006758 * cos(2 * g) + 0.000907 * sin(2 * g) - 0.002697 * cos(3 * g) + 0.00148 * sin(3 * g)
        let eq = 229.18 * (0.000075 + 0.001868 * cos(g) - 0.032077 * sin(g) - 0.014615 * cos(2 * g) - 0.040849 * sin(2 * g))
        let mins = h * 60 + m + s / 60
        var lon = -(mins + eq - 720) / 4
        lon = (lon + 540).truncatingRemainder(dividingBy: 360) - 180
        return (decl * 180 / .pi, lon)
    }
    /// Sun elevation in degrees at a place (js sunElev)
    static func sunElev(_ lat: Double, _ lon: Double, _ sp: (lat: Double, lon: Double)) -> Double {
        let a = lat * d2r, d = sp.lat * d2r, h = (lon - sp.lon) * d2r
        return asin(sin(a) * sin(d) + cos(a) * cos(d) * cos(h)) / d2r
    }
    static func moonName(_ t: Double) -> String {
        let syn = 29.530588853, ref = 947182440.0
        let age = ((t - ref) / 86400).truncatingRemainder(dividingBy: syn), ph = (age < 0 ? age + syn : age) / syn
        return ph < 0.03 || ph > 0.97 ? "new moon" : ph < 0.22 ? "waxing crescent" : ph < 0.28 ? "first quarter" : ph < 0.47 ? "waxing gibbous" : ph < 0.53 ? "full moon" : ph < 0.72 ? "waning gibbous" : ph < 0.78 ? "last quarter" : "waning crescent"
    }
    static func gcKm(_ a: Double, _ b: Double, _ c: Double, _ d: Double) -> Double {
        let p1 = a * d2r, p2 = c * d2r, dl = (d - b) * d2r
        return 6371 * acos(clamp(sin(p1) * sin(p2) + cos(p1) * cos(p2) * cos(dl), -1, 1))
    }
}

/// Two-line orbital elements, propagated on the device (two-body + J2 + drag term), same as the site.
struct TLE: Sendable {
    let epoch: Double, ndot2: Double, inc: Double, raan: Double, ecc: Double, argp: Double, M: Double, n: Double

    init?(_ l1: String, _ l2: String) {
        let a = Array(l1), b = Array(l2)
        guard a.count >= 63, b.count >= 63 else { return nil }
        func f(_ s: [Character], _ x: Int, _ y: Int) -> Double? { Double(String(s[x..<min(y, s.count)]).trimmingCharacters(in: .whitespaces)) }
        guard let yy = f(a, 18, 20), let doy = f(a, 20, 32), let inc = f(b, 8, 16), let raan = f(b, 17, 25),
              let argp = f(b, 34, 42), let M = f(b, 43, 51), let n = f(b, 52, 63),
              let ecc = Double("0." + String(b[26..<33]).trimmingCharacters(in: .whitespaces)) else { return nil }
        let yr = yy < 57 ? 2000 + yy : 1900 + yy
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let jan1 = cal.date(from: DateComponents(year: Int(yr), month: 1, day: 1))!.timeIntervalSince1970
        epoch = jan1 + (doy - 1) * 86400
        ndot2 = f(a, 33, 43) ?? 0
        self.inc = inc; self.raan = raan; self.ecc = ecc; self.argp = argp; self.M = M; self.n = n
    }

    /// Ground position (js issAt)
    func at(_ t: Double) -> (lat: Double, lon: Double, alt: Double) {
        let mu = 398600.4418, Re = 6378.137, J2 = 1.08262668e-3, d2r = Astro.d2r
        let dtd = (t - epoch) / 86400, dts = dtd * 86400, n0 = n * 2 * .pi / 86400, a = cbrt(mu / (n0 * n0)), e = ecc, i = inc * d2r
        let p = a * (1 - e * e), k = 1.5 * J2 * pow(Re / p, 2) * n0
        let raanT = raan * d2r - k * cos(i) * dts, argpT = argp * d2r + k * (2 - 2.5 * pow(sin(i), 2)) * dts
        let Mt = (M * d2r + 2 * .pi * (n * dtd + ndot2 * dtd * dtd)).truncatingRemainder(dividingBy: 2 * .pi)
        var E = Mt
        for _ in 0..<8 { E = E - (E - e * sin(E) - Mt) / (1 - e * cos(E)) }
        let nu = 2 * atan2(sqrt(1 + e) * sin(E / 2), sqrt(1 - e) * cos(E / 2)), r = a * (1 - e * cos(E)), u = argpT + nu
        let x = r * (cos(raanT) * cos(u) - sin(raanT) * sin(u) * cos(i)), y = r * (sin(raanT) * cos(u) + cos(raanT) * sin(u) * cos(i)), z = r * sin(u) * sin(i)
        let jd = t / 86400 + 2440587.5
        let gmst = ((280.46061837 + 360.98564736629 * (jd - 2451545)).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        var lon = atan2(y, x) / d2r - gmst
        lon = ((lon + 540).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) - 180
        return (atan2(z, hypot(x, y)) / d2r, lon, r - Re)
    }
    /// A demo orbit, only when no real elements have ever loaded
    static let fallback = TLE("1 25544U 98067A   26300.50000000  .00010000  00000-0  18000-3 0  9990",
                              "2 25544  51.6400 120.0000 0005000  90.0000 270.0000 15.50000000400000")!
}

struct NaturalEvent: Identifiable, Hashable, Sendable {
    enum Kind: String, Sendable { case fire, storm, volcano, ice, flood, other }
    let id: String
    let title: String
    let kind: Kind
    let lat: Double, lon: Double
    let start: Double
}

/// The readings the TV adds on top of EarthReadings: air quality, protons, NASA events, the station's orbit.
/// Read from the same snapshot the site uses (earthmidi.com/data/live.json).
struct MoreReadings: Sendable {
    var airPM: [Series] = [], airUV: [Series] = []
    var protons = Series()
    var events: [NaturalEvent] = []
    var tle: TLE?
    var isDemoISS: Bool { tle == nil }

    func air(at t: Double) -> (pm: Double, uv: Double) {
        let pm = airPM.map { $0.at(t) }.filter(\.isFinite), uv = airUV.map { $0.at(t) }.filter(\.isFinite)
        return (pm.isEmpty ? .nan : pm.reduce(0, +) / Double(pm.count), uv.isEmpty ? .nan : uv.reduce(0, +) / Double(uv.count))
    }
    func iss(at t: Double) -> (lat: Double, lon: Double, alt: Double) { (tle ?? TLE.fallback).at(t) }

    static func load() async -> MoreReadings {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest = 15
        if let (d, _) = try? await URLSession(configuration: cfg).data(from: EarthData.snapshotURL), let r = parse(d) { return r }
        return MoreReadings()
    }

    static func parse(_ data: Data) -> MoreReadings? {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let feeds = root["feeds"] as? [String: Any] else { return nil }
        func feed(_ match: String) -> Any? {
            for (url, v) in feeds where url.contains(match) { return (v as? [String: Any])?["data"] }
            return nil
        }
        var r = MoreReadings()
        if let a = feed("air-quality-api") as? [[String: Any]] {
            for x in a {
                let h = x["hourly"] as? [String: Any]
                r.airPM.append(EarthData.omSeries(h, "pm2_5")); r.airUV.append(EarthData.omSeries(h, "uv_index"))
            }
        }
        if let p = feed("integral-protons-1-day") as? [[String: Any]] {
            let rows = p.compactMap { row -> (Double, Double)? in
                guard let t = EarthData.isoTime(row["time_tag"]), let f = EarthData.num(row["flux"]), f > 0 else { return nil }
                return (t, f)
            }.sorted { $0.0 < $1.0 }
            r.protons = Series(t: rows.map(\.0), v: rows.map(\.1))
        }
        if let e = (feed("eonet.gsfc.nasa.gov") as? [String: Any])?["events"] as? [[String: Any]] {
            r.events = e.compactMap { ev in
                guard let id = ev["id"] as? String, let g = ev["geometry"] as? [[String: Any]], let first = g.first, let last = g.last else { return nil }
                var c: Any? = last["coordinates"]
                while let a = c as? [Any], let inner = a.first as? [Any] { c = inner; _ = a }
                guard let co = c as? [Any], co.count >= 2, let lon = EarthData.num(co[0]), let lat = EarthData.num(co[1]) else { return nil }
                let cat = ((ev["categories"] as? [[String: Any]])?.first?["id"] as? String) ?? ""
                let kind: NaturalEvent.Kind = switch cat { case "wildfires": .fire; case "severeStorms": .storm; case "volcanoes": .volcano; case "seaLakeIce": .ice; case "floods": .flood; default: .other }
                let start = EarthData.isoTime(first["date"]) ?? 0
                return NaturalEvent(id: id, title: (ev["title"] as? String) ?? "", kind: kind, lat: lat, lon: lon, start: start)
            }
        }
        if let j = feed("tles?format=json") as? [String: Any], let l1 = j["line1"] as? String, let l2 = j["line2"] as? String { r.tle = TLE(l1, l2) }
        if r.tle == nil, let t = feed("CATNR=25544") as? String {
            let lines = t.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }
            if let l1 = lines.first(where: { $0.hasPrefix("1 ") }), let l2 = lines.first(where: { $0.hasPrefix("2 ") }) { r.tle = TLE(l1, l2) }
        }
        return r
    }
}

/// Sunrise chorus cities (js SUN_CITIES): name, lat, lon, metro population in millions
enum SunCities {
    static let all: [(String, Double, Double, Double)] = [("Tokyo",35.68,139.69,37),("Delhi",28.61,77.21,33),("Shanghai",31.23,121.47,29),("Dhaka",23.81,90.41,23),("São Paulo",-23.55,-46.63,22),("Mexico City",19.43,-99.13,22),("Cairo",30.04,31.24,22),("Beijing",39.9,116.4,22),("Mumbai",19.08,72.88,21),("Osaka",34.69,135.5,19),("New York",40.71,-74.01,19),("Karachi",24.86,67.01,17),("Kinshasa",-4.44,15.27,17),("Lagos",6.52,3.38,16),("Istanbul",41.01,28.98,16),("Buenos Aires",-34.6,-58.38,15),("Kolkata",22.57,88.36,15),("Manila",14.6,120.98,15),("Rio de Janeiro",-22.91,-43.17,14),("Guangzhou",23.13,113.26,14),("Los Angeles",34.05,-118.24,12),("Moscow",55.76,37.62,12.6),("Paris",48.86,2.35,11),("Jakarta",-6.21,106.85,11),("Lima",-12.05,-77.04,11),("Bangkok",13.76,100.5,11),("Bogotá",4.71,-74.07,11),("Seoul",37.57,126.98,10),("London",51.51,-0.13,9.6),("Tehran",35.69,51.39,9.5),("Riyadh",24.71,46.68,7.7),("Santiago",-33.45,-70.67,6.9),("Madrid",40.42,-3.7,6.7),("Toronto",43.65,-79.38,6.3),("Singapore",1.35,103.82,6),("Johannesburg",-26.2,28.05,6),("Sydney",-33.87,151.21,5.3),("Nairobi",-1.29,36.82,5),("San Diego",32.72,-117.16,3.3),("Auckland",-36.85,174.76,1.7),("Honolulu",21.31,-157.86,1),("Reykjavík",64.14,-21.9,0.24)]
}
