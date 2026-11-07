import Foundation

/// The data-to-note rules, ported 1:1 from the site's js/audio.js + js/core.js (default producer settings).
/// Same reading, same note: any change here must match the web engine.
enum Music {
    static let tune = 440.0
    /// D3: 48 + key (D = 2) + 12 × octave (0)
    static let root = 50

    static let majPent = [0, 2, 4, 7, 9]
    static let minPent = [0, 3, 5, 7, 10]
    static let dorian = [0, 2, 3, 5, 7, 9, 10]
    /// Chord progression "classic" (scale degrees per voice)
    static let progClassic = [[0, 2, 4, 7], [5, 7, 9, 12], [3, 5, 7, 10], [4, 6, 8, 11]]
    static let chordEvery = 8.0

    /// Kp picks the scale: calm sky = major pentatonic, unsettled = dorian, storm = minor pentatonic.
    static func scale(kp: Double) -> [Int] { kp >= 5 ? minPent : kp >= 4 ? dorian : majPent }
    static func scaleName(kp: Double) -> String { kp >= 5 ? "minor pentatonic" : kp >= 4 ? "dorian" : "major pentatonic" }

    static func degree(_ sc: [Int], _ i: Int, base: Int = root) -> Int {
        let n = sc.count
        let o = Int((Double(i) / Double(n)).rounded(.down))
        return base + 12 * o + sc[((i % n) + n) % n]
    }

    static func mtof(_ m: Double) -> Double { tune * pow(2, (m - 69) / 12) }
    static func mtof(_ m: Int) -> Double { mtof(Double(m)) }

    static let names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    static func noteName(_ n: Int) -> String { names[((n % 12) + 12) % 12] + String(Int((Double(n) / 12).rounded(.down)) - 1) }

    /// Quake → note: depth sets the step (shallow = high), Kp at the quake's time sets the scale.
    static func quakeNote(depth: Double, kp: Double) -> (note: Int, step: Int, steps: Int) {
        let sc = scale(kp: kp), steps = sc.count * 3
        let i = jsRound(mapv(depth, 0, 700, Double(steps - 1), 0))
        return (degree(sc, i), i, steps)
    }
    /// Magnitude → velocity, linear curve 20…127
    static func velocity(mag: Double) -> Int {
        let x = clamp((mag - 1) / 6, 0, 1)
        return jsRound(20 + (127 - 20) * x)
    }
    static func quakePan(lon: Double) -> Double { clamp(lon / 180, -1, 1) * 0.85 }

    /// Planet chord: city temperature −30…45 °C → scale step
    static func chordNote(tempC: Double, kp: Double) -> Int {
        let sc = scale(kp: kp), steps = sc.count * 3
        return degree(sc, jsRound(mapv(tempC, -30, 45, 0, Double(steps - 1))), base: root)
    }

    static func flareClass(_ f: Double) -> String {
        guard f.isFinite else { return "–" }
        if f >= 1e-4 { return "X" + String(format: "%.1f", f / 1e-4) }
        if f >= 1e-5 { return "M" + String(format: "%.1f", f / 1e-5) }
        if f >= 1e-6 { return "C" + String(format: "%.1f", f / 1e-6) }
        if f >= 1e-7 { return "B" + String(format: "%.1f", f / 1e-7) }
        return "A" + String(format: "%.1f", f / 1e-8)
    }
}

@inline(__always) func clamp(_ v: Double, _ a: Double, _ b: Double) -> Double { max(a, min(b, v)) }
@inline(__always) func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }
/// JS map(): linear map with the input clamped to its range
@inline(__always) func mapv(_ v: Double, _ a: Double, _ b: Double, _ c: Double, _ d: Double) -> Double {
    guard v.isFinite else { return c }
    return lerp(c, d, clamp((v - a) / (b - a), 0, 1))
}
/// JavaScript Math.round (halves round up)
@inline(__always) func jsRound(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

/// Moon phase (computed, not fetched): same formula as the site
func moonIllumination(_ date: Date) -> Double {
    let syn = 29.530588853
    let ref = Date(timeIntervalSince1970: 947182440) // 2000-01-06 18:14 UTC
    let days = date.timeIntervalSince(ref) / 86400
    let age = (days.truncatingRemainder(dividingBy: syn) + syn).truncatingRemainder(dividingBy: syn)
    return (1 - cos(2 * .pi * age / syn)) / 2
}
