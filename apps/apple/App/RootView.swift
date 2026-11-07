import SwiftUI
import WebKit
import AVKit

struct RootView: View {
    @EnvironmentObject var hub: PlayerHub
    @State private var sheet: Sheet?
    enum Sheet: String, Identifiable { case readings, midi, settings; var id: String { rawValue } }

    var body: some View {
        content
            .sheet(item: $sheet) { s in
                Group {
                    switch s {
                    case .readings: ReadingsView()
                    case .midi: MIDIView()
                    case .settings: SettingsView()
                    }
                }
                .environmentObject(hub)
                .preferredColorScheme(.dark)
                #if os(macOS)
                .frame(minWidth: 560, minHeight: 640)
                #endif
            }
    }

    @ViewBuilder private var content: some View {
        #if os(iOS)
        VStack(spacing: 0) {
            WebEngineView(engine: hub.web)
            bar
        }
        .background(Theme.bg.ignoresSafeArea())
        #else
        WebEngineView(engine: hub.web)
            .background(Theme.bg)
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button { hub.toggle() } label: { Label(hub.isPlaying ? "Stop" : "Play", systemImage: hub.isPlaying ? "stop.fill" : "play.fill") }
                    Button { sheet = .readings } label: { Label("Readings", systemImage: "globe.americas") }
                    Button { sheet = .midi } label: { Label("MIDI", systemImage: "pianokeys") }
                    RoutePicker().frame(width: 28, height: 22)
                }
            }
        #endif
    }

    #if os(iOS)
    private var bar: some View {
        HStack(spacing: 0) {
            barButton("Readings", "globe.americas") { sheet = .readings }
            barButton("MIDI", "pianokeys") { sheet = .midi }
            VStack(spacing: 3) {
                RoutePicker().frame(width: 26, height: 22)
                Text("AIRPLAY").font(Theme.caps(9)).foregroundStyle(Theme.mute)
            }.frame(maxWidth: .infinity)
            barButton("Settings", "slider.horizontal.3") { sheet = .settings }
        }
        .padding(.top, 8).padding(.bottom, 2)
        .background(Theme.sf0.overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }.ignoresSafeArea(edges: .bottom))
    }
    private func barButton(_ t: String, _ icon: String, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            VStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: 18, weight: .regular)).frame(height: 22)
                Text(t.uppercased()).font(Theme.caps(9))
            }
            .foregroundStyle(Theme.fg2)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(t)
    }
    #endif
}

#if os(iOS)
struct WebEngineView: UIViewRepresentable {
    let engine: WebEngine
    func makeUIView(context: Context) -> WKWebView { engine.webView }
    func updateUIView(_ v: WKWebView, context: Context) {}
}
struct RoutePicker: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let v = AVRoutePickerView(); v.tintColor = UIColor(Theme.fg2); v.activeTintColor = UIColor(Theme.hex(0x3cc8ff)); v.prioritizesVideoDevices = false; return v
    }
    func updateUIView(_ v: AVRoutePickerView, context: Context) {}
}
#else
struct WebEngineView: NSViewRepresentable {
    let engine: WebEngine
    func makeNSView(context: Context) -> WKWebView { engine.webView }
    func updateNSView(_ v: WKWebView, context: Context) {}
}
struct RoutePicker: NSViewRepresentable {
    func makeNSView(context: Context) -> AVRoutePickerView { let v = AVRoutePickerView(); v.isRoutePickerButtonBordered = false; return v }
    func updateNSView(_ v: AVRoutePickerView, context: Context) {}
}
#endif

/// Small caption + value pair used across the native screens
struct Reading: View {
    let label: String, value: String
    var sub: String = ""
    var color: Color = Theme.fg
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(Theme.caps(10)).foregroundStyle(Theme.mute)
            Text(value).font(Theme.mono(20, .semibold)).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.6)
            if !sub.isEmpty { Text(sub).font(Theme.mono(11)).foregroundStyle(Theme.fg2).lineLimit(1) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.sf2))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
    }
}

struct SheetHeader: View {
    let title: String
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        HStack {
            Text(title).font(Theme.title(22)).foregroundStyle(Theme.fg)
            Spacer()
            Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 14, weight: .semibold)).padding(8).background(Circle().fill(Theme.sf2)) }
                .buttonStyle(.plain).foregroundStyle(Theme.fg2).accessibilityLabel("Close")
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 8)
    }
}
