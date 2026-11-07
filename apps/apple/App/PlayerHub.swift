import SwiftUI
import MediaPlayer
import AVFoundation
#if os(iOS)
import ActivityKit
import UIKit
#endif

/// One place that knows whether the planet is playing, and fans that out to the Lock Screen,
/// Live Activity, haptics, MIDI and the menu bar.
@MainActor
final class PlayerHub: ObservableObject {
    static let shared = PlayerHub()

    @Published private(set) var isPlaying = false
    @Published private(set) var isLive = true
    @Published private(set) var kp = 0.0
    @Published private(set) var speed = 0.0
    @Published private(set) var scale = ""
    @Published private(set) var style = "ambient"
    @Published private(set) var bpm = 0.0
    @Published private(set) var events: [PlayedEvent] = []
    @Published var haptics: Bool { didSet { UserDefaults.standard.set(haptics, forKey: "haptics") } }
    @Published var liveActivity: Bool { didSet { UserDefaults.standard.set(liveActivity, forKey: "liveActivity"); if !liveActivity { endActivity() } } }
    @Published var savedFile: URL?

    let web = WebEngine()
    let midi = MIDIHub()
    private var lastHeadline = "Listening to the planet"
    private var lastNote = ""
    private var lastLayer = "s"
    #if os(iOS)
    private var activity: Activity<EarthLiveAttributes>?
    private var lastActivityPush = Date.distantPast
    #endif

    private init() {
        haptics = UserDefaults.standard.object(forKey: "haptics") as? Bool ?? true
        liveActivity = UserDefaults.standard.object(forKey: "liveActivity") as? Bool ?? true
        configureAudioSession()
        web.onMessage = { [weak self] m in self?.handle(m) }
        midi.onInput = { [weak self] bytes in
            self?.web.call("EMNative.midiIn([\(bytes.map(String.init).joined(separator: ","))])")
        }
        setupRemoteCommands()
    }

    // MARK: transport
    func toggle() { isPlaying ? stop() : play() }
    func play() { configureAudioSession(); web.call("EMNative.play()") }
    func stop() { web.call("EMNative.stop()") }
    func goLive() { web.call("EMNative.goLive()") }
    func setStyle(_ s: String) { web.call("EMNative.setStyle('\(s == "pulse" ? "pulse" : "ambient")')") }

    private func configureAudioSession() {
        #if os(iOS)
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .default, options: [])
        try? s.setActive(true)
        #endif
    }

    // MARK: messages from the engine
    private func handle(_ m: [String: Any]) {
        switch m["t"] as? String {
        case "midi":
            if let b = m["b"] as? [NSNumber] { midi.send(b.map { $0.uint8Value }, delayMs: (m["d"] as? Double) ?? 0) }
        case "state":
            let on = (m["on"] as? Bool) ?? false
            let changed = on != isPlaying
            isPlaying = on
            isLive = (m["live"] as? Bool) ?? true
            kp = (m["kp"] as? Double) ?? kp
            speed = (m["sp"] as? Double) ?? speed
            scale = (m["scale"] as? String) ?? scale
            style = (m["style"] as? String) ?? style
            bpm = (m["bpm"] as? Double) ?? bpm
            if changed {
                if on { startActivity() } else { endActivity(); midi.panic() }
            }
            updateNowPlaying()
        case "event":
            let text = (m["text"] as? String) ?? ""
            let layer = ((m["layer"] as? String) ?? "").first ?? "m"
            let e = PlayedEvent(layer: layer, text: text, note: nil, lat: m["lat"] as? Double, lon: m["lon"] as? Double, mag: m["mag"] as? Double)
            events.insert(e, at: 0)
            if events.count > 60 { events.removeLast(events.count - 60) }
            lastHeadline = text.count > 90 ? String(text.prefix(88)) + "…" : text
            lastNote = (m["note"] as? String) ?? ""
            lastLayer = String(layer)
            if layer == "q", let mag = e.mag { buzz(mag) }
            updateNowPlaying()
            pushActivity()
        case "file":
            guard let name = m["name"] as? String, let b64 = m["data"] as? String, let data = Data(base64Encoded: b64) else { return }
            let safe = name.replacingOccurrences(of: "/", with: "_")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
            do { try data.write(to: url, options: .atomic); savedFile = url; Dialogs.share(url) } catch { print("save failed \(error)") }
        default: break
        }
    }

    // MARK: haptics — feel big quakes as they play (iPhone)
    private func buzz(_ mag: Double) {
        #if os(iOS)
        guard haptics, mag >= 2.5, UIApplication.shared.applicationState == .active else { return }
        let style: UIImpactFeedbackGenerator.FeedbackStyle = mag >= 5 ? .heavy : mag >= 4 ? .medium : .light
        let g = UIImpactFeedbackGenerator(style: style)
        g.impactOccurred(intensity: CGFloat(mapv(mag, 2.5, 6.5, 0.45, 1)))
        if mag >= 5.5 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { g.impactOccurred(intensity: 0.8) } }
        #endif
    }

    // MARK: Lock Screen / Control Center / menu bar Now Playing
    private func updateNowPlaying() {
        let c = MPNowPlayingInfoCenter.default()
        guard isPlaying else {
            #if os(macOS)
            c.playbackState = .stopped
            #endif
            c.nowPlayingInfo = nil
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: lastHeadline,
            MPMediaItemPropertyArtist: "Earth MIDI · " + (isLive ? "Live" : "Replay"),
            MPMediaItemPropertyAlbumTitle: String(format: "Kp %.1f · %@", kp, scale),
            MPNowPlayingInfoPropertyIsLiveStream: isLive,
            MPNowPlayingInfoPropertyPlaybackRate: 1.0,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue
        ]
        if let art = Self.artwork { info[MPMediaItemPropertyArtwork] = art }
        c.nowPlayingInfo = info
        #if os(macOS)
        c.playbackState = .playing
        #endif
    }
    private static let artwork: MPMediaItemArtwork? = {
        #if os(iOS)
        guard let img = UIImage(named: "Mark") else { return nil }
        #else
        guard let img = NSImage(named: "Mark") else { return nil }
        #endif
        return MPMediaItemArtwork(boundsSize: img.size) { _ in img }
    }()

    private func setupRemoteCommands() {
        let rc = MPRemoteCommandCenter.shared()
        rc.playCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.play() }; return .success }
        rc.pauseCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.stop() }; return .success }
        rc.stopCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.stop() }; return .success }
        rc.togglePlayPauseCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.toggle() }; return .success }
        [rc.nextTrackCommand, rc.previousTrackCommand, rc.skipForwardCommand, rc.skipBackwardCommand, rc.changePlaybackPositionCommand].forEach { $0.isEnabled = false }
    }

    // MARK: Live Activity (Lock Screen + Dynamic Island)
    private var activityState: Any? {
        #if os(iOS)
        return EarthLiveAttributes.ContentState(kp: kp, scale: scale, headline: lastHeadline, note: lastNote, layer: lastLayer, isLive: isLive)
        #else
        return nil
        #endif
    }
    private func startActivity() {
        #if os(iOS)
        guard liveActivity, activity == nil, ActivityAuthorizationInfo().areActivitiesEnabled,
              let st = activityState as? EarthLiveAttributes.ContentState else { return }
        activity = try? Activity.request(attributes: EarthLiveAttributes(startedAt: Date()), content: .init(state: st, staleDate: nil), pushType: nil)
        #endif
    }
    private func pushActivity() {
        #if os(iOS)
        guard let activity, Date().timeIntervalSince(lastActivityPush) > 4, let st = activityState as? EarthLiveAttributes.ContentState else { return }
        lastActivityPush = Date()
        Task { await activity.update(.init(state: st, staleDate: Date().addingTimeInterval(1800))) }
        #endif
    }
    private func endActivity() {
        #if os(iOS)
        guard let a = activity else { return }
        activity = nil
        Task { await a.end(nil, dismissalPolicy: .immediate) }
        #endif
    }
}
