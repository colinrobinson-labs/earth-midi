#if os(iOS)
import ActivityKit
import Foundation

/// Lock Screen + Dynamic Island card while Earth MIDI plays.
struct EarthLiveAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var kp: Double
        var scale: String
        var headline: String   // the last thing the planet played
        var note: String       // e.g. "D4"
        var layer: String      // one-letter layer key (q, x, c, e…)
        var isLive: Bool
    }
    var startedAt: Date
}
#endif
