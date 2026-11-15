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
    /// Now Playing art: the Breach ring on graphite, drawn once
    private static let artwork: MPMediaItemArtwork = {
        let size = CGSize(width: 600, height: 600)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in
            UIColor(red: 0.027, green: 0.035, blue: 0.043, alpha: 1).setFill(); ctx.fill(CGRect(origin: .zero, size: size))
            let cols: [UIColor] = [UIColor(red: 1, green: 0.77, blue: 0.24, alpha: 1), UIColor(red: 0.49, green: 1, blue: 0.62, alpha: 1), UIColor(red: 0.24, green: 0.78, blue: 1, alpha: 1), UIColor(red: 0.78, green: 0.49, blue: 1, alpha: 1)]
            for (i, c) in cols.enumerated() {
                let p = UIBezierPath(arcCenter: CGPoint(x: 300, y: 300), radius: 190, startAngle: CGFloat(i) * .pi / 2 - .pi / 2, endAngle: CGFloat(i + 1) * .pi / 2 - .pi / 2, clockwise: true)
                p.lineWidth = 34; c.setStroke(); p.stroke()
            }
        }
        return MPMediaItemArtwork(boundsSize: size) { _ in img }
    }()
    private func nowPlaying() {
        guard isPlaying else { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; return }
        let e = conductor.events.first
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: e?.text ?? "Listening to the planet",
            MPMediaItemPropertyArtist: "Earth MIDI · \(conductor.presetName ?? conductor.mode.rawValue)",
            MPMediaItemPropertyAlbumTitle: String(format: "Kp %.1f · %@", conductor.kp, Music.scaleName(kp: conductor.kp)),
            MPNowPlayingInfoPropertyIsLiveStream: conductor.mode == .live,
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPMediaItemPropertyArtwork: Self.artwork
        ]
    }
}
