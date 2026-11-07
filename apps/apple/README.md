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
