import SwiftUI

@main
struct EarthMIDIApp: App {
    @StateObject private var hub = PlayerHub.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(hub)
                .preferredColorScheme(.dark)
                #if os(macOS)
                .frame(minWidth: 900, minHeight: 640)
                #endif
        }
        #if os(macOS)
        .commands {
            CommandMenu("Playback") {
                Button(hub.isPlaying ? "Stop" : "Play") { hub.toggle() }.keyboardShortcut(.space, modifiers: [])
                Button("Go Live") { hub.goLive() }.keyboardShortcut("l", modifiers: [.command])
                Divider()
                Button("Ambient") { hub.setStyle("ambient") }.keyboardShortcut("1", modifiers: [.command])
                Button("Pulse") { hub.setStyle("pulse") }.keyboardShortcut("2", modifiers: [.command])
            }
        }
        MenuBarExtra {
            MenuBarView().environmentObject(hub)
        } label: {
            Image(systemName: hub.isPlaying ? "globe.americas.fill" : "globe.americas")
        }
        .menuBarExtraStyle(.window)
        Settings {
            SettingsView().environmentObject(hub).frame(width: 460, height: 560)
        }
        #endif
    }
}
