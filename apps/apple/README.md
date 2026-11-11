# Earth MIDI for iPhone, iPad, Mac and Apple TV

One XcodeGen project, three platforms, free.

| Target | What it is |
|---|---|
| `EarthMIDI_iOS` / `EarthMIDI_macOS` | The site's own sound engine (bundled from `index.html` + `js/` at build time by `scripts/sync-web.sh`) inside a native shell |
| `EarthMIDIWidgets_*` | Home/Lock Screen/desktop widgets + the iPhone Live Activity |
| `EarthMIDITV` | Fully native Apple TV app: `Shared/Synth` (AVAudioEngine synth + conductor) and a globe view |

Native features: background + Lock Screen playback, Now Playing / remote controls, AirPlay picker,
a virtual CoreMIDI port ("Earth MIDI" out, "Earth MIDI In" for play-along), Network MIDI and Bluetooth MIDI pairing (iOS),
haptics on quakes, Live Activity + Dynamic Island, widgets with a play button, Siri / Shortcuts
("Play Earth MIDI", "What's the space weather on Earth MIDI", "Biggest earthquake today on Earth MIDI"),
share sheet / save panel for every export, Mac menu bar player and keyboard shortcuts, Apple TV ambient mode.

## Same reading, same note
`Shared/Core/Music.swift` is a 1:1 port of the note rules in `js/audio.js` (default producer settings).
If a rule changes on the site, change it there too. All apps read `earthmidi.com/data/live.json` first
(the same snapshot cache as the site), so the free public APIs see one request per refresh.

## Build
```
brew install xcodegen
cd apps/apple && xcodegen generate && open EarthMIDI.xcodeproj
```
Set the team on each target (or pass `DEVELOPMENT_TEAM=…`), then Product → Archive.
CI (`.github/workflows/apple.yml`) compiles all three unsigned on every change.

## Icons
`node apps/apple/scripts/make-icons.js` re-renders every icon (iOS, macOS sizes, tvOS layered icon + Top Shelf) from the site logo.

## iPhone Duo
Audit and plan: [`DUO_AUDIT.md`](DUO_AUDIT.md). What's in the code:
- iPhone uses system bars (`RootView.swift`): Play, Readings, MIDI, AirPlay, Settings as a bottom toolbar, which the system turns into a vertical rail on Duo. Sheets get a system Close button (`SheetChrome`). AirPlay is also in Settings, because a vertical rail can't show a custom view.
- Readings goes side by side (map | numbers) at regular width.
- `FoldAwareWeb` reads the fold and calls `EMNative.fold(...)` (Bridge.js), which drives `js/fold.js`: Book = globe + Console, Tent = Planet Clock. Test the web side on any screen with `?fold=v` or `?fold=h`.
- Code that needs the iOS 27.1 SDK sits behind `#if DUO_SDK` and is off by default. To turn it on: build with Xcode 27.1+, confirm the API names (marked ⚠️), then add `-DDUO_SDK` to Other Swift Flags in `project.yml`. CI: run "Apple apps build" by hand with **duo** ticked.
- Test in the iPhone Duo simulator (Xcode 27.1): closed, open flat, book, tent, Split View, then the 20-minute device pass in DUO_AUDIT.md.
