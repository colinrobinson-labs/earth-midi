import SwiftUI
#if os(iOS)
import CoreAudioKit
#endif

struct MIDIView: View {
    @EnvironmentObject var hub: PlayerHub
    @ObservedObject private var midi = PlayerHub.shared.midi
    #if os(iOS)
    @State private var showBT = false
    #endif
    private let channels: [(Character, Int)] = [("q", 1), ("s", 2), ("o", 3), ("x", 4), ("w", 5), ("t", 6), ("c", 7), ("i", 11), ("e", 12), ("g", 13), ("a", 14), ("u", 15)]

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "MIDI out")
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Toggle(isOn: $midi.enabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Send the planet as MIDI").foregroundStyle(Theme.fg)
                            Text("\(midi.status) · \(midi.sent) messages sent").font(Theme.mono(11)).foregroundStyle(Theme.fg2)
                        }
                    }
                    .tint(Theme.hex(0x3cc8ff))
                    Text("Earth MIDI appears as a MIDI input called “Earth MIDI” in other apps. Pick it as the input on a track and the planet plays your instruments in real time, in key, with tempo clock and CC lanes. “Earth MIDI In” takes notes and knobs back for play-along and MIDI learn.")
                        .font(.subheadline).foregroundStyle(Theme.fg2)
                    #if os(iOS)
                    Text("Works with GarageBand, Cubasis, AUM, Koala, Logic Remote and any app with MIDI input. Use Audio + MIDI in the background so both keep running.")
                        .font(.footnote).foregroundStyle(Theme.mute)
                    Toggle(isOn: $midi.networkSession) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Network MIDI (Wi-Fi)").foregroundStyle(Theme.fg)
                            Text("Send to Logic or Ableton on a Mac: Audio MIDI Setup → MIDI Network").font(Theme.mono(11)).foregroundStyle(Theme.fg2)
                        }
                    }.tint(Theme.hex(0x3cc8ff))
                    Button { showBT = true } label: { Label("Connect a Bluetooth MIDI device", systemImage: "dot.radiowaves.left.and.right") }
                        .buttonStyle(.bordered).tint(Theme.fg2)
                    #else
                    Text("In Logic, Ableton Live, Bitwig or Reaper: enable “Earth MIDI” as a MIDI input and arm a track. Turn on the engine's MIDI clock in the Producer panel to sync tempo.")
                        .font(.footnote).foregroundStyle(Theme.mute)
                    #endif
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CHANNELS").font(Theme.caps(10)).foregroundStyle(Theme.mute)
                        ForEach(channels, id: \.0) { k, ch in
                            HStack {
                                Circle().fill(Theme.color(k)).frame(width: 8, height: 8)
                                Text(Theme.name(k)).font(.subheadline).foregroundStyle(Theme.fg)
                                Spacer()
                                Text("ch \(ch)").font(Theme.mono(12)).foregroundStyle(Theme.fg2)
                            }
                        }
                        HStack {
                            Circle().fill(Theme.color("r")).frame(width: 8, height: 8)
                            Text("Pulse bass · drums").font(.subheadline).foregroundStyle(Theme.fg)
                            Spacer()
                            Text("ch 9 · ch 10").font(Theme.mono(12)).foregroundStyle(Theme.fg2)
                        }
                        Text("Channels and every mapping can be changed in the engine's Producer panel.").font(.footnote).foregroundStyle(Theme.mute).padding(.top, 4)
                    }
                    .padding(12).background(RoundedRectangle(cornerRadius: 10).fill(Theme.sf2))
                }
                .padding(16)
            }
        }
        .background(Theme.bg)
        #if os(iOS)
        .sheet(isPresented: $showBT) { BluetoothMIDIView().ignoresSafeArea() }
        #endif
    }
}

#if os(iOS)
/// Apple's Bluetooth MIDI pairing screen
struct BluetoothMIDIView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UINavigationController {
        let vc = CABTMIDICentralViewController()
        let nav = UINavigationController(rootViewController: vc)
        vc.navigationItem.rightBarButtonItem = UIBarButtonItem(systemItem: .done, primaryAction: UIAction { [weak nav] _ in nav?.dismiss(animated: true) })
        return nav
    }
    func updateUIViewController(_ vc: UINavigationController, context: Context) {}
}
#endif
