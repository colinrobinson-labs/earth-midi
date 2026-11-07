import SwiftUI
import MediaPlayer
import AVFoundation

@main
struct EarthMIDITVApp: App {
    @StateObject private var hub = PlayerHub.shared
    var body: some Scene {
        WindowGroup {
            TVRootView().environmentObject(hub).environmentObject(hub.conductor).preferredColorScheme(.dark)
        }
    }
}

/// Apple TV: fully native. The Conductor reads the same snapshot and applies the same note rules as the site.
@MainActor
final class PlayerHub: ObservableObject {
    static let shared = PlayerHub()
    let conductor = Conductor()
    @Published private(set) var isPlaying = false

    private init() {
        conductor.onState = { [weak self] in self?.sync() }
        conductor.onEvent = { [weak self] _ in self?.nowPlaying() }
        let rc = MPRemoteCommandCenter.shared()
        rc.playCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.play() }; return .success }
        rc.pauseCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.stop() }; return .success }
        rc.togglePlayPauseCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.toggle() }; return .success }
        Task { await conductor.load() }
    }
    func toggle() { conductor.toggle() }
    func play() { conductor.play() }
    func stop() { conductor.stop() }

    private func sync() {
        isPlaying = conductor.isPlaying
        UIApplication.shared.isIdleTimerDisabled = isPlaying // ambient mode: no screensaver while the planet plays
        nowPlaying()
    }
    private func nowPlaying() {
        guard isPlaying else { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; return }
        let e = conductor.events.first
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: e?.text ?? "Listening to the planet",
            MPMediaItemPropertyArtist: "Earth MIDI · \(conductor.mode.rawValue)",
            MPMediaItemPropertyAlbumTitle: String(format: "Kp %.1f · %@", conductor.kp, Music.scaleName(kp: conductor.kp)),
            MPNowPlayingInfoPropertyIsLiveStream: conductor.mode == .live,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue
        ]
    }
}
