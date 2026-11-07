import SwiftUI

/// "Observatory rack": graphite chrome, colour only on data (docs/design-system.md).
enum Theme {
    static let bg = Color(red: 0.027, green: 0.035, blue: 0.043)
    static let sf0 = Color(red: 0.047, green: 0.059, blue: 0.071)
    static let sf2 = Color(red: 0.071, green: 0.086, blue: 0.102)
    static let line = Color.white.opacity(0.09)
    static let fg = Color(red: 0.91, green: 0.925, blue: 0.95)
    static let fg2 = Color(red: 0.62, green: 0.66, blue: 0.71)
    static let mute = Color(red: 0.45, green: 0.49, blue: 0.54)

    static let layers: [Character: (String, Color)] = [
        "q": ("Earthquakes", hex(0xff5a3c)), "s": ("Solar wind", hex(0xffc53d)), "o": ("Ocean swell", hex(0x3cc8ff)),
        "x": ("Solar X-rays", hex(0xc77dff)), "w": ("Jet stream", hex(0x9ad1ff)), "t": ("Tides", hex(0x4dd6c1)),
        "c": ("Planet chord", hex(0xff8fd1)), "i": ("Space station", hex(0xe8f4ff)), "e": ("Fires, storms, volcanoes", hex(0xff9f43)),
        "g": ("Magnetosphere", hex(0x7cff9e)), "a": ("Air", hex(0xd6c08f)), "u": ("Sunrise chorus", hex(0xffd27a)), "r": ("Pulse drums + bass", hex(0xf2f2f2))]
    static func color(_ k: Character) -> Color { layers[k]?.1 ?? fg }
    static func name(_ k: Character) -> String { layers[k]?.0 ?? "" }
    static let spectrum = LinearGradient(colors: [hex(0xffc53d), hex(0x7cff9e), hex(0x3cc8ff), hex(0xc77dff)], startPoint: .topLeading, endPoint: .bottomTrailing)

    static func hex(_ v: UInt32) -> Color {
        Color(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .monospaced) }
    static func caps(_ size: CGFloat) -> Font { .system(size: size, weight: .semibold, design: .monospaced) }
    static func title(_ size: CGFloat) -> Font { .system(size: size, weight: .heavy, design: .default).width(.expanded) }

    static func kpWord(_ kp: Double) -> String { kp >= 7 ? "severe storm" : kp >= 5 ? "storm" : kp >= 4 ? "unsettled" : kp >= 3 ? "active" : "quiet" }
}

extension Date {
    var shortAgo: String {
        let s = -timeIntervalSinceNow
        if s < 60 { return "now" }
        if s < 3600 { return "\(Int(s / 60))m ago" }
        if s < 86400 { return "\(Int(s / 3600))h ago" }
        return "\(Int(s / 86400))d ago"
    }
}
