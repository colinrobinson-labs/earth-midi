import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var hub: PlayerHub
    private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0" }

    var body: some View {
        VStack(spacing: 0) {
            #if os(iOS)
            SheetHeader(title: "Settings")
            #endif
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    group("Playback") {
                        HStack(spacing: 8) {
                            styleButton("Ambient", "ambient")
                            styleButton("Pulse", "pulse")
                        }
                        Button { hub.goLive() } label: { Label("Go live", systemImage: "dot.radiowaves.forward") }.buttonStyle(.bordered).tint(Theme.fg2)
                    }
                    group("On this device") {
                        #if os(iOS)
                        Toggle("Feel quakes (haptics, M2.5+)", isOn: $hub.haptics).tint(Theme.hex(0x3cc8ff))
                        Toggle("Live Activity on the Lock Screen", isOn: $hub.liveActivity).tint(Theme.hex(0x3cc8ff))
                        HStack {
                            Text("Play on AirPlay speakers").foregroundStyle(Theme.fg)
                            Spacer()
                            RoutePicker().frame(width: 30, height: 26).accessibilityLabel("AirPlay")
                        }
                        #endif
                        Text("Keeps playing in the background and with the screen locked. Control it from the Lock Screen, Control Center, AirPlay speakers, widgets or Siri (“Play Earth MIDI”).")
                            .font(.footnote).foregroundStyle(Theme.mute)
                    }
                    group("How it works") {
                        Text("Earth MIDI turns live readings from public sensors into sound: earthquakes from USGS, solar wind, X-rays and the magnetosphere from NOAA, ocean swell, the jet stream, city temperatures and air quality from Open-Meteo (city temperatures from Apple Weather when its logo shows), tides from NOAA, natural events from NASA, and the space station's orbit.")
                            .font(.subheadline).foregroundStyle(Theme.fg2)
                        Text("AI helped design and build this app, including the rules that turn data into sound. But no AI runs while you listen: every note comes from a live sensor reading through the same rule every time.")
                            .font(.footnote).foregroundStyle(Theme.mute)
                    }
                    group("About") {
                        Text("Earth MIDI by Colin Robinson").foregroundStyle(Theme.fg)
                        Link("earthmidi.com", destination: URL(string: "https://earthmidi.com")!).foregroundStyle(Theme.hex(0x3cc8ff))
                        Text("Exports are free to use with credit: “Planetary data sonified with Earth MIDI by Colin Robinson · earthmidi.com”. Air quality: Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo.")
                            .font(.footnote).foregroundStyle(Theme.mute)
                        Text("Version \(version)").font(Theme.mono(11)).foregroundStyle(Theme.mute)
                    }
                }
                .padding(16)
            }
        }
        .background(Theme.bg)
    }

    private func styleButton(_ t: String, _ s: String) -> some View {
        Button { hub.setStyle(s) } label: {
            Text(t).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 8).fill(hub.style == s ? Theme.hex(0x3cc8ff).opacity(0.18) : Theme.sf2))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(hub.style == s ? Theme.hex(0x3cc8ff) : Theme.line))
        }
        .buttonStyle(.plain).foregroundStyle(Theme.fg)
    }

    private func group<C: View>(_ title: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased()).font(Theme.caps(10)).foregroundStyle(Theme.mute)
            c()
        }
    }
}

#if os(macOS)
struct MenuBarView: View {
    @EnvironmentObject var hub: PlayerHub
    @Environment(\.openWindow) private var openWindow
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("EARTH MIDI").font(Theme.caps(11)).foregroundStyle(Theme.fg2)
                Spacer()
                Text(hub.isPlaying ? (hub.isLive ? "LIVE" : "REPLAY") : "IDLE").font(Theme.caps(10)).foregroundStyle(hub.isPlaying ? Theme.hex(0xff5a3c) : Theme.mute)
            }
            Button { hub.toggle() } label: {
                Label(hub.isPlaying ? "Stop" : "Play the planet", systemImage: hub.isPlaying ? "stop.fill" : "play.fill").frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonStyle(.borderedProminent).tint(hub.isPlaying ? Theme.sf2 : Theme.hex(0x3cc8ff))
            if hub.isPlaying {
                Text(String(format: "Kp %.1f · %@", hub.kp, hub.scale)).font(Theme.mono(11)).foregroundStyle(Theme.fg2)
                ForEach(hub.events.prefix(4)) { e in
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Circle().fill(Theme.color(e.layer)).frame(width: 6, height: 6)
                        Text(e.text).font(Theme.mono(10)).foregroundStyle(Theme.fg2).lineLimit(2)
                    }
                }
            }
            Divider()
            HStack {
                Button("Ambient") { hub.setStyle("ambient") }
                Button("Pulse") { hub.setStyle("pulse") }
                Spacer()
                Button("Open…") { NSApp.activate(ignoringOtherApps: true); NSApp.windows.first { $0.canBecomeMain }?.makeKeyAndOrderFront(nil) }
                Button("Quit") { NSApp.terminate(nil) }
            }
            .buttonStyle(.borderless).font(.caption)
        }
        .padding(14)
        .frame(width: 300)
    }
}
#endif
