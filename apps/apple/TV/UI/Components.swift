import SwiftUI

/// Shared pieces for the 10-foot interface. Observatory-rack look: graphite chrome, colour only on data.
enum TV {
    static let gutterH: CGFloat = 80, gutterV: CGFloat = 60
    static let panel = Color.black.opacity(0.58)
    static let order: [Character] = ["q", "s", "o", "x", "w", "t", "c", "i", "e", "g", "a", "u", "r"]
    static let newLayers: Set<Character> = ["i", "e", "g", "a", "u", "r"]
    static let short: [Character: String] = ["q": "Quakes", "s": "Solar wind", "o": "Ocean", "x": "X-rays", "w": "Jet stream", "t": "Tides", "c": "Chord", "i": "Station", "e": "Fires + storms", "g": "Magnetosphere", "a": "Air", "u": "Sunrise", "r": "Pulse"]
    static let what: [Character: String] = [
        "q": "Every earthquake on Earth. Depth sets the note, magnitude how hard it's struck.",
        "s": "Solar wind speed opens the pad's filter. Density adds resonance.",
        "o": "Real swell height and period breathe the surf.",
        "x": "GOES X-ray flux shimmers. Flares ring bells.",
        "w": "Jet stream speed at 250 hPa sets the wind's pitch.",
        "t": "Measured water level bends a low drone.",
        "c": "Ten cities. Each one's temperature is a note in the chord.",
        "i": "The space station's latitude sets a beacon; it plucks every 5° of track.",
        "e": "NASA open events: fires crackle, volcanoes drone, storms swirl.",
        "g": "Dst storm depth sets a ring-mod drone. Protons glitter.",
        "a": "PM2.5 sets a haze bed. UV index brightens it.",
        "u": "A chime when the sun rises or sets over 42 big cities.",
        "r": "Drums and bass. The planet sets the tempo (Pulse only)."]
}

/// A focusable tile: lifts, brightens and gets a white edge when focused (tvOS feel, our colours)
struct TileStyle: ButtonStyle {
    var tint: Color = Theme.fg
    var corner: CGFloat = 22
    func makeBody(configuration: Configuration) -> some View { TileBody(configuration: configuration, tint: tint, corner: corner) }
    private struct TileBody: View {
        let configuration: Configuration
        let tint: Color, corner: CGFloat
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .background(RoundedRectangle(cornerRadius: corner).fill(focused ? Theme.sf2.opacity(0.98) : Theme.sf0.opacity(0.86)))
                .overlay(RoundedRectangle(cornerRadius: corner).stroke(focused ? Color.white.opacity(0.9) : Theme.line, lineWidth: focused ? 3 : 1))
                .scaleEffect(configuration.isPressed ? 1.02 : focused ? 1.06 : 1)
                .shadow(color: .black.opacity(focused ? 0.7 : 0), radius: 24, y: 14)
                .animation(.easeOut(duration: 0.18), value: focused)
        }
    }
}

/// Pill button for transport rows
struct PillStyle: ButtonStyle {
    var prominent = false
    var tint: Color = Theme.fg
    func makeBody(configuration: Configuration) -> some View { PillBody(configuration: configuration, prominent: prominent, tint: tint) }
    private struct PillBody: View {
        let configuration: Configuration
        let prominent: Bool, tint: Color
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(focused ? Color.black : tint)
                .padding(.horizontal, 30).padding(.vertical, 16)
                .background(Capsule().fill(focused ? Color.white : Color.white.opacity(prominent ? 0.2 : 0.09)))
                .scaleEffect(configuration.isPressed ? 1.02 : focused ? 1.08 : 1)
                .shadow(color: .black.opacity(focused ? 0.6 : 0), radius: 18, y: 10)
                .animation(.easeOut(duration: 0.16), value: focused)
        }
    }
}

struct Logo: View {
    var size: CGFloat = 34
    var tint: Color? = nil
    var body: some View {
        Circle().stroke(tint.map { AnyShapeStyle($0) } ?? AnyShapeStyle(AngularGradient(colors: [Theme.hex(0xffc53d), Theme.hex(0x7cff9e), Theme.hex(0x3cc8ff), Theme.hex(0xc77dff), Theme.hex(0xffc53d)], center: .center)), lineWidth: size * 0.18)
            .frame(width: size, height: size)
    }
}

struct ScreenTitle: View {
    let title: String
    var hint: String = ""
    var tint: Color = Theme.fg
    var body: some View {
        HStack(alignment: .center, spacing: 18) {
            Logo(size: 32, tint: tint == Theme.fg ? nil : tint)
            Text(title.uppercased()).font(Theme.title(42)).foregroundStyle(tint)
            Spacer()
            if !hint.isEmpty { Text(hint.uppercased()).font(Theme.caps(18)).foregroundStyle(Theme.mute).multilineTextAlignment(.trailing) }
        }
    }
}

struct Caps: View {
    let text: String
    var size: CGFloat = 17
    var body: some View { Text(text.uppercased()).font(Theme.caps(size)).foregroundStyle(Theme.mute).tracking(1.6) }
}

/// The signature 13-layer meter
struct LayerMeter: View {
    @EnvironmentObject var c: Conductor
    var width: CGFloat = 420
    var body: some View {
        HStack(spacing: 5) {
            ForEach(TV.order, id: \.self) { k in
                RoundedRectangle(cornerRadius: 2).fill(Theme.color(k))
                    .opacity(c.isPlaying ? 0.22 + 0.78 * (c.levels[k] ?? 0) : 0.2)
            }
        }
        .frame(width: width, height: 8)
        .animation(.linear(duration: 0.12), value: c.levels)
        .accessibilityHidden(true)
    }
}

struct Sparkline: View {
    let series: Series
    var color: Color
    var body: some View {
        Canvas { ctx, size in
            let v = series.v.enumerated().filter { $0.element.isFinite }
            guard v.count > 1, let t0 = series.t.first, let t1 = series.t.last, t1 > t0 else { return }
            let mn = series.minV, mx = series.maxV, span = mx > mn ? mx - mn : 1
            var p = Path()
            for (j, (i, y)) in v.enumerated() {
                let pt = CGPoint(x: (series.t[i] - t0) / (t1 - t0) * size.width, y: size.height - (y - mn) / span * size.height)
                if j == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            var fill = p; fill.addLine(to: CGPoint(x: size.width, y: size.height)); fill.addLine(to: CGPoint(x: 0, y: size.height)); fill.closeSubpath()
            ctx.fill(fill, with: .linearGradient(Gradient(colors: [color.opacity(0.28), color.opacity(0)]), startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))
            ctx.stroke(p, with: .color(color), lineWidth: 2.5)
        }
    }
}

/// A value card that opens a list of choices (Producer)
struct ChoiceCard: View {
    let label: String
    let value: String
    let note: String
    let tint: Color
    let options: [(String, String)]
    let pick: (String) -> Void
    var body: some View {
        Menu {
            ForEach(options, id: \.0) { o in Button(o.1) { pick(o.0) } }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Caps(text: label, size: 16)
                Text(value).font(Theme.mono(32, .semibold)).foregroundStyle(tint).lineLimit(1).minimumScaleFactor(0.6)
                Text(note).font(.system(size: 20)).foregroundStyle(Theme.fg2).lineLimit(2)
            }
            .frame(width: 470, height: 150, alignment: .topLeading)
            .padding(24)
        }
    }
}

/// − level + row for a layer (Mixer)
struct LevelRow: View {
    @EnvironmentObject var c: Conductor
    let k: Character
    var body: some View {
        let v = c.config.level(k)
        HStack(spacing: 18) {
            Circle().fill(Theme.color(k)).frame(width: 18, height: 18)
            Text(Theme.name(k)).font(.system(size: 26, weight: .semibold)).frame(width: 300, alignment: .leading)
            Button { set(v - 0.1) } label: { Image(systemName: "minus").frame(width: 50, height: 40) }.buttonStyle(PillStyle())
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.08))
                Capsule().fill(Theme.color(k)).frame(width: 360 * min(1, v / 1.6))
            }.frame(width: 360, height: 12)
            Button { set(v + 0.1) } label: { Image(systemName: "plus").frame(width: 50, height: 40) }.buttonStyle(PillStyle())
            Text("\(Int((v * 100).rounded()))%").font(Theme.mono(24)).foregroundStyle(Theme.fg2).frame(width: 90, alignment: .trailing)
        }
    }
    private func set(_ x: Double) { c.config.vol[String(k)] = (clamp(x, 0, 1.6) * 10).rounded() / 10 }
}
