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
                SheetChrome {
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
        // System bars, not a hand-built strip: on iPhone Duo they move to a vertical rail on the outer
        // display and in landscape on the inner display. Every item has a symbol and a title.
        NavigationStack {
            FoldAwareWeb(engine: hub.web)
                .background(Theme.bg.ignoresSafeArea())
                .toolbar(.hidden, for: .navigationBar)
                .toolbar { bottomBar }
                .toolbarBackground(Theme.sf0, for: .bottomBar)
                .toolbarBackground(.visible, for: .bottomBar)
                .toolbarColorScheme(.dark, for: .bottomBar)
        }
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
    @ToolbarContentBuilder private var bottomBar: some ToolbarContent {
        #if DUO_SDK || compiler(>=6.4.2)
        if #available(iOS 27.0, *) { prioritizedBar } else { classicBar }
        #else
        classicBar
        #endif
    }

    @ToolbarContentBuilder private var classicBar: some ToolbarContent {
        ToolbarItemGroup(placement: .bottomBar) {
            railButton(hub.isPlaying ? "Stop" : "Play", hub.isPlaying ? "stop.fill" : "play.fill", primary: true) { hub.toggle() }
            Spacer()
            railButton("Readings", "globe.americas") { sheet = .readings }
            Spacer()
            railButton("MIDI", "pianokeys") { sheet = .midi }
            Spacer()
            // AirPlay is a system custom view, so a vertical rail can't show it; it is also in Settings.
            RoutePicker().frame(width: 28, height: 24).accessibilityLabel("AirPlay")
            Spacer()
            railButton("Settings", "slider.horizontal.3") { sheet = .settings }
        }
    }

    #if DUO_SDK || compiler(>=6.4.2)
    /// iOS 27: the same bar as separate items, so Play and Readings stay on the rail longest when it overflows
    /// (iPhone Duo outer display / vertical rail).
    @available(iOS 27.0, *)
    @ToolbarContentBuilder private var prioritizedBar: some ToolbarContent {
        ToolbarItem(placement: .bottomBar) {
            railButton(hub.isPlaying ? "Stop" : "Play", hub.isPlaying ? "stop.fill" : "play.fill", primary: true) { hub.toggle() }
        }.visibilityPriority(.high)
        ToolbarSpacer(.flexible, placement: .bottomBar)
        ToolbarItem(placement: .bottomBar) { railButton("Readings", "globe.americas") { sheet = .readings } }.visibilityPriority(.high)
        ToolbarSpacer(.flexible, placement: .bottomBar)
        ToolbarItem(placement: .bottomBar) { railButton("MIDI", "pianokeys") { sheet = .midi } }
        ToolbarSpacer(.flexible, placement: .bottomBar)
        // AirPlay is a system custom view, so a vertical rail can't show it; it is also in Settings.
        ToolbarItem(placement: .bottomBar) { RoutePicker().frame(width: 28, height: 24).accessibilityLabel("AirPlay") }.visibilityPriority(.low)
        ToolbarSpacer(.flexible, placement: .bottomBar)
        ToolbarItem(placement: .bottomBar) { railButton("Settings", "slider.horizontal.3") { sheet = .settings } }
    }
    #endif

    private func railButton(_ title: String, _ icon: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { Label(title, systemImage: icon) }
            .tint(primary ? Theme.hex(0x3cc8ff) : Theme.fg2)
    }
    #endif
}

#if os(iOS)
/// The site's engine, told where the fold is when the phone is partly folded (iPhone Duo book or tent pose),
/// so the page can lay out around the hinge: js/fold.js (Book = globe + Console, Tent = Planet Clock).
struct FoldAwareWeb: View {
    let engine: WebEngine
    @State private var lastFold = ""
    var body: some View {
        #if DUO_SDK || compiler(>=6.4.2)
        if #available(iOS 27.1, *) {
            // iOS 27.1 SDK: the hinge is a .division reserved region. Its frame is in this proxy's local space (= the web view's),
            // checked on the iPhone Duo simulator: with the proxy at global y 82 the region reported y -82, and the hinge lands
            // on the physical fold in book and tent. It can run past the proxy's bounds, so only minX/minY and the thickness are used.
            GeometryReader { proxy in
                let fold = proxy.reservedRegions(kind: .division).first(where: { $0.isActive })?.frame
                WebEngineView(engine: engine)
                    .onChange(of: fold, initial: true) { _, f in send(f) }
            }
        } else {
            WebEngineView(engine: engine)
        }
        #else
        WebEngineView(engine: engine)
        #endif
    }

    /// Sends {axis, a, w} in the web view's own points (= CSS px), or null when the screen is flat or closed.
    private func send(_ f: CGRect?) {
        var js = "null"
        if let f, f.width > 0, f.height > 0 {
            js = f.height >= f.width
                ? "{axis:'v',a:\(Int(f.minX.rounded())),w:\(Int(f.width.rounded()))}"
                : "{axis:'h',a:\(Int(f.minY.rounded())),w:\(Int(f.height.rounded()))}"
        }
        guard js != lastFold else { return }
        lastFold = js
        engine.call("EMNative.fold(\(js))")
    }
}

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

/// iOS: wraps a sheet in a NavigationStack with a system Close button (cancellationAction), so the bar follows
/// the system on every display, including iPhone Duo's vertical bars. macOS: the sheet as it was.
struct SheetChrome<Content: View>: View {
    @ViewBuilder let content: Content
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        #if os(iOS)
        NavigationStack {
            content
                .navigationBarTitleDisplayMode(.inline)
                .toolbarBackground(Theme.bg, for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbarColorScheme(.dark, for: .navigationBar)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { dismiss() }
                    }
                }
        }
        #else
        content
        #endif
    }
}

struct SheetHeader: View {
    let title: String
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        #if os(iOS)
        Color.clear.frame(height: 0).navigationTitle(title)
        #else
        HStack {
            Text(title).font(Theme.title(22)).foregroundStyle(Theme.fg)
            Spacer()
            Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 14, weight: .semibold)).padding(8).background(Circle().fill(Theme.sf2)) }
                .buttonStyle(.plain).foregroundStyle(Theme.fg2).accessibilityLabel("Close")
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 8)
        #endif
    }
}
