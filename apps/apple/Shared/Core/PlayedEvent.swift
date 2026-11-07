import Foundation

/// What just played, for the screen and Now Playing.
struct PlayedEvent: Identifiable, Hashable {
    let id = UUID()
    let at = Date()
    let layer: Character
    let text: String
    let note: Int?
    var lat: Double? = nil
    var lon: Double? = nil
    var mag: Double? = nil
}

