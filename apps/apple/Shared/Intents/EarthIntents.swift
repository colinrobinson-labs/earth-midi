import AppIntents
import Foundation

// Playback intents live in both the app and the widget extension; the system runs them in the app.

struct TogglePlaybackIntent: AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Play or Stop Earth MIDI"
    static var description = IntentDescription("Starts or stops the live planet.")
    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await MainActor.run { PlayerHub.shared.toggle() }
        #endif
        return .result()
    }
}

struct PlayEarthIntent: AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Play Earth MIDI"
    static var description = IntentDescription("Starts playing the planet live: earthquakes, solar wind, ocean swell and more.")
    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await MainActor.run { PlayerHub.shared.play() }
        #endif
        return .result()
    }
}

struct StopEarthIntent: AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Stop Earth MIDI"
    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await MainActor.run { PlayerHub.shared.stop() }
        #endif
        return .result()
    }
}

struct SpaceWeatherIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Space Weather"
    static var description = IntentDescription("Reads the planetary Kp index and solar wind, and the scale Earth MIDI is playing in.")
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let d = await EarthData.load()
        let kp = d.kpNow, sp = d.speedNow
        var s = String(format: "Kp is %.1f, %@. Earth MIDI is playing in %@.", kp, Theme.kpWord(kp), Music.scaleName(kp: kp))
        if sp.isFinite { s += String(format: " Solar wind is %d kilometres a second.", Int(sp.rounded())) }
        return .result(value: s, dialog: IntentDialog(stringLiteral: s))
    }
}

struct LatestQuakeIntent: AppIntent {
    static var title: LocalizedStringResource = "Biggest Earthquake Today"
    static var description = IntentDescription("The largest earthquake in the last 24 hours, and the note it plays.")
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let d = await EarthData.load()
        guard let q = d.biggest24h else { return .result(value: "No earthquakes reported yet.", dialog: "No earthquakes reported in the last day yet.") }
        let n = Music.quakeNote(depth: q.depth, kp: d.kp(at: q.time.timeIntervalSince1970))
        let s = String(format: "Magnitude %.1f, %@, %d kilometres deep, %@. On Earth MIDI it plays %@.", q.mag, q.place, Int(q.depth.rounded()), q.time.shortAgo, Music.noteName(n.note))
        return .result(value: s, dialog: IntentDialog(stringLiteral: s))
    }
}

struct EarthShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: PlayEarthIntent(), phrases: ["Play \(.applicationName)", "Start \(.applicationName)", "Play the planet on \(.applicationName)"],
                    shortTitle: "Play the planet", systemImageName: "play.circle")
        AppShortcut(intent: StopEarthIntent(), phrases: ["Stop \(.applicationName)"], shortTitle: "Stop", systemImageName: "stop.circle")
        AppShortcut(intent: SpaceWeatherIntent(), phrases: ["What's the space weather on \(.applicationName)", "Check Kp on \(.applicationName)"],
                    shortTitle: "Space weather", systemImageName: "sun.max")
        AppShortcut(intent: LatestQuakeIntent(), phrases: ["Biggest earthquake today on \(.applicationName)", "\(.applicationName) earthquakes"],
                    shortTitle: "Biggest quake today", systemImageName: "waveform.path.ecg")
    }
}
