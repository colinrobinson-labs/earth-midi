import Foundation
import CoreMIDI

/// A real virtual MIDI port: "Earth MIDI" shows up as an input in GarageBand, Logic, Ableton, AUM, Cubasis…
/// and "Earth MIDI In" takes notes/knobs from other apps or controllers (play-along + MIDI learn).
final class MIDIHub: ObservableObject {
    @Published var enabled: Bool { didSet { UserDefaults.standard.set(enabled, forKey: "midi.enabled") } }
    @Published private(set) var sent = 0
    @Published private(set) var status = "Starting…"
    #if os(iOS)
    @Published var networkSession: Bool { didSet { MIDINetworkSession.default().isEnabled = networkSession; MIDINetworkSession.default().connectionPolicy = networkSession ? .anyone : .noOne; UserDefaults.standard.set(networkSession, forKey: "midi.network") } }
    #endif
    var onInput: (([UInt8]) -> Void)?

    private var client = MIDIClientRef()
    private var source = MIDIEndpointRef()
    private var dest = MIDIEndpointRef()
    private var timebase = mach_timebase_info_data_t()
    private var counter = 0

    init() {
        enabled = UserDefaults.standard.object(forKey: "midi.enabled") as? Bool ?? true
        #if os(iOS)
        networkSession = UserDefaults.standard.bool(forKey: "midi.network")
        #endif
        mach_timebase_info(&timebase)
        var st = MIDIClientCreateWithBlock("Earth MIDI" as CFString, &client) { _ in }
        if st == noErr { st = MIDISourceCreate(client, "Earth MIDI" as CFString, &source) }
        if st == noErr {
            st = MIDIDestinationCreateWithBlock(client, "Earth MIDI In" as CFString, &dest) { [weak self] list, _ in
                var bytes: [UInt8] = []
                for packet in list.unsafeSequence() {
                    let n = Int(packet.pointee.length)
                    withUnsafeBytes(of: packet.pointee.data) { raw in bytes.append(contentsOf: raw.prefix(n)) }
                }
                guard !bytes.isEmpty else { return }
                DispatchQueue.main.async { self?.onInput?(bytes) }
            }
        }
        // stable IDs so DAWs remember the port between launches
        if st == noErr {
            MIDIObjectSetIntegerProperty(source, kMIDIPropertyUniqueID, 0x45_4D_49_44) // "EMID"
            MIDIObjectSetIntegerProperty(dest, kMIDIPropertyUniqueID, 0x45_4D_49_4E)   // "EMIN"
        }
        status = st == noErr ? "Virtual port ready" : "MIDI unavailable (\(st))"
        #if os(iOS)
        if networkSession { MIDINetworkSession.default().isEnabled = true; MIDINetworkSession.default().connectionPolicy = .anyone }
        #endif
    }

    /// Bytes from the engine's Web MIDI calls; `delayMs` keeps the engine's look-ahead timing (clock, drums).
    func send(_ bytes: [UInt8], delayMs: Double) {
        guard enabled, source != 0, !bytes.isEmpty, bytes.count <= 200 else { return }
        let ticks = UInt64(max(0, delayMs) * 1_000_000 * Double(timebase.denom) / Double(timebase.numer))
        let when = delayMs > 0.5 ? mach_absolute_time() + ticks : 0
        var list = MIDIPacketList()
        withUnsafeMutablePointer(to: &list) { lp in
            let p = MIDIPacketListInit(lp)
            _ = MIDIPacketListAdd(lp, MemoryLayout<MIDIPacketList>.size, p, when, bytes.count, bytes)
            MIDIReceived(source, lp)
        }
        counter += 1
        if counter % 25 == 0 { let c = counter; DispatchQueue.main.async { self.sent = c } }
    }

    /// All notes off on every channel (when playback stops)
    func panic() {
        for ch in 0..<16 { send([UInt8(0xB0 + ch), 123, 0], delayMs: 0) }
    }
}
