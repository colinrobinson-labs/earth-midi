# Architecture

Earth MIDI is a static site: one HTML page, 27 plain scripts, no framework, no bundler, no server of its own. This is the map of the code: how a sensor reading becomes a note, what each file in `js/` owns, and the order they have to load in.

For setup, tests and deploys see the [README](../README.md).

## The one rule

**Same reading, same note.** Every sound is a fixed function of a published measurement or of computed astronomy (sun position, the ISS orbit). Nothing is random where it would change a note, and no AI runs while you listen. Controls in the Producer panel change the mapping (key, scale, instrument, levels). They never invent data.

If a change breaks that, it is a bug, however good it sounds.

## From sensor to speaker

```
public feeds (USGS, NOAA, NASA, Open-Meteo, ISS)
      │
      │  every 10 min, in GitHub Actions
      ▼
scripts/snapshot.mjs ──► data/live.json, data/wx.json, data/status.json
      │
      │  in the browser
      ▼
core.js   viaSnap(): snapshot first, the source itself if the copy is stale,
          the last good copy if both fail, labelled demo data if there is none
      │
      ▼
S         app state: readings per layer, what has played, transport
      │
      ├──► ui.js      tick(), every 50 ms: events that are due become notes
      ├──► audio.js   updateEngine(): steady layers follow their readings;
      │               schedulePulse(): drums and bass on the audio clock
      └──► visuals.js frame(), every animation frame: globe, timeline, meters
      │
      ▼
Web Audio master chain  +  Web MIDI out  +  the event log (with its formula trace)
```

The snapshot is only a cache. A page with no `data/` folder, such as a local copy, calls the sources directly and plays the same notes. Details in [live-data-cache.md](live-data-cache.md).

## Globals worth knowing

All of `js/` shares one global scope, so these are the real interfaces.

| Name | Defined in | What it is |
|---|---|---|
| `FEEDS` | `feeds.js` | Every data feed: URL, how often the job refetches it (`every`), how old a copy the page accepts (`ttl`). Also loaded by `scripts/snapshot.mjs`, so it must stay plain data with no page code |
| `LAYERS` | `core.js` | The 13 layers: one-letter key, name, colour. The key (`q` quakes, `s` solar wind, `o` ocean…) is used everywhere: `CFG.vol.q`, `S.hit.q`, CSS `--q` |
| `DEF` | `core.js` | Default settings. This is "the original sound" that Reset returns to |
| `CFG` | `core.js` | Current settings. Saved to `localStorage` (`em5.cfg`), carried by share links, presets and session files |
| `S` | `core.js` | Live state: readings, what has played, transport, mute/solo, per-layer hit levels for the meters |
| `A` | `audio.js` | The audio graph, `null` until the first Play (browsers require a tap before audio) |
| `mergeCFG(src)` | `core.js` | Lays outside settings over `DEF`. Everything that arrives from a link or a file goes through here |
| `afterCFG()` | `ui.js` | Call after changing `CFG`: saves it, retunes the engine, rebuilds the panels |
| `refresh()` | `core.js` | Reloads every feed into `S`. Runs at boot and once a minute while playing |
| `logEv()` | `visuals.js` | Adds a line to the event log, with the reading and the formula behind the note |
| `FX` | `fx.js` | Effects tier (full, light, lower) so phones stay smooth |

Changing a setting from new code is always the same three steps: write to `CFG`, call `afterCFG()`, done. The Console, MIDI learn, presets and share links all work because everything goes through that path.

## Load order

`index.html` loads the scripts in this order, with plain `<script>` tags at the end of the body. Each one runs to completion before the next starts. Nothing enforces the order, so adding or moving a file means checking what it reaches for.

| # | File | Owns | Leans on |
|---|---|---|---|
| 1 | `fx.js` | Effects tiers and frame-rate limits. Has to be first | nothing |
| 2 | `feeds.js` | The feed list, shared with the snapshot job | nothing |
| 3 | `core.js` | Helpers, layers, `DEF`/`CFG`, state `S`, snapshot-first fetching, one loader per feed, sun, moon and ISS maths, the replay clock | `FX`, `FEEDS` |
| 4 | `audio.js` | The synth (oscillators, filters, noise, convolution reverb, no samples), master chain, note rules, Pulse sequencer, Web MIDI out, in and learn | core |
| 5 | `visuals.js` | Globe and flat map, timeline, sparklines, piano roll, scope, meters, event log and trace | core, audio |
| 6 | `weather.js` | Weather grid on the map: wind, cloud, rain, tap for a reading | core, visuals |
| 7 | `groove.js` | Pulse grooves, genres, and which measurement drives the tempo | core, audio, weather |
| 8 | `studio.js` | How the Producer panel looks: step grids, piano keys, chips, preset cards | core, groove |
| 9 | `focus.js` | The globe as a microphone: what faces the camera is louder; spin gestures play the filter and delay | audio, visuals |
| 10 | `io.js` | Export (MIDI, WAV, stems, CSV, data pack), sessions, presets, share links, credit line, the network ledger | everything above |
| 11 | `god.js` | Zeus Mode, the "not real data" sandbox. Wraps `initAudio` and `drawMap` | audio, visuals |
| 12 | `reset.js` | Reset per control, card, tab or everything | `DEF`, `CFG` |
| 13 | `ui.js` | Layer cards, Producer panel, `afterCFG`, the 50 ms playback loop, transport, and `boot()` | everything above |
| 14 | `audition.js` | Short previews when you pick an instrument, scale or preset | audio, ui |
| 15 | `zones.js` | Limit a layer to part of the planet. Wraps `afterCFG` | ui, visuals |
| 16 | `sheet.js` | The Layers drawer on phones | ui |
| 17 | `title.js` | The playable EARTH MIDI title | audio |
| 18 | `record.js` | Video and audio capture, the review and share sheet | audio, visuals, io |
| 19 | `welcome.js` | First-visit card: Ambient, Pulse or enter silently | ui |
| – | GoatCounter | Third-party visit counter, `async`, cookie-free. Stripped out of the apps | – |
| 20 | `procta.js` | The animated Producer button | `S.hit` |
| 21 | `beat.js` | Title and globe move with the kick | audio, title |
| 22 | `home.js` | Home button that returns to the landing view | ui, god, zones |
| 23 | `simple.js` | Simple view (`#simple`, `#embed`) | ui |
| 24 | `console.js` | Console, the touch mixing desk (`#console`) | ui, reset, studio |
| 25 | `fold.js` | Folding-phone layouts: Book and Planet Clock. Wraps `logEv` | console, visuals |
| 26 | `tidy.js` | Moves controls into the globe HUD and the tabbed inspector | ui, zones, god |
| 27 | `extras.js` | Lock-screen controls, wake lock, "what's driving the sound" line, screen-reader announcements, action counts, story image. Wraps `logEv` | ui, visuals |

`boot()` is the last line of `ui.js`. Everything from `audition.js` down runs after the page is already built and attaches itself to what exists. That is why the files up to `ui.js` are the engine and the files after it are features.

## Things that will bite you

**One global scope.** These are classic scripts, not modules. Two files declaring the same top-level `const` or `let` is a syntax error that silently drops the second file, and the page carries on without it. Newer files wrap themselves in `(()=>{ … })()` or a bare `{ … }` block and expose one name on `window` (`EMRec`, `FOLD`, `SIMPLE`). Do the same.

**Wrapping instead of hooks.** There is no event bus. A file that needs to run after something replaces the function and calls the original: `god.js` wraps `initAudio` and `drawMap`, `zones.js` wraps `afterCFG`, `fold.js` and `extras.js` both wrap `logEv`. Wrappers stack in load order. Keep the original's return value and arguments, and wrap in a `try` so a feature can't take the engine down with it.

**Later files are optional to earlier ones.** `ui.js` checks `typeof RESET !== "undefined"` before using it. Follow that pattern when an engine file calls a feature file.

**Each feature brings its own CSS.** The main stylesheet is inline in `index.html`. Most feature files inject a `<style>` block of their own. Use the tokens in [design-system.md](design-system.md), not hex values.

**Element ids are API.** `tidy.js` moves controls around the page and `console.js` mirrors them. Both rely on ids staying put. So do the apps.

**Cache keys are automatic.** The deploy stamps `?v=<hash>` onto every script and stylesheet reference (`scripts/stamp.mjs`). The repo copy has none.

**Audio starts late.** `A` is `null` until the first Play. Anything that touches the audio graph has to cope with that.

**Settings from outside are untrusted.** Share links (`#s=`), preset files and session files are written by other people. They go through `mergeCFG` in `core.js` and `loadFile` / `readHash` in `io.js`. Anything from `CFG` that reaches the page should be treated as text, not markup.

## Where a change goes

| You want to | Touch |
|---|---|
| Add or change a data feed | `feeds.js` (URL, `every`, `ttl`), a loader in `core.js`, a trim rule in `scripts/snapshot.mjs`, the host in the CSP `connect-src` in `index.html` |
| Change how a reading becomes a note | `audio.js`, then the same rule in `apps/apple/Shared/Core/Music.swift`, then the card text in `ui.js` (`CARDS`) and the trace in `logEv` calls so the page still tells the truth |
| Add a Producer setting | A default in `DEF` (`core.js`), a control in `ui.js` (`buildPro`), then read it where it applies. Reset, Console, MIDI learn, presets and sharing pick it up from `CFG` |
| Add a layer | `LAYERS` and `DEF.vol` / `send` / `ch` in `core.js`, a voice in `audio.js`, a card in `ui.js`, a colour token in `index.html`. Check `PAN_KEYS`, the meters and the Console strips |
| Add a preset or genre | `PRESETS` in `ui.js`, `GENRES` in `groove.js` |
| Add an export format | `io.js`, and a button in the Export panel in `index.html` |
| Add a view or mode | A new file after `ui.js`, wrapped in a block, opened by a `#hash` |

## State in the browser

Nothing is stored on a server. Settings live in `localStorage`:

| Key | Holds |
|---|---|
| `em5.cfg` | Current settings (`CFG`) |
| `em5.presets` | Your saved presets |
| `em5.vol` | Volume |
| `em5.learn` | MIDI learn assignments |
| `em5.console` | Console layout |
| `em.snap.live` | Last data snapshot, for offline or outage starts |
| `em.fx`, `em.simple`, `em.welcome` and other `em.*` keys | View preferences and one-time hints |

## Outside the page

**Deploy and data** (`.github/workflows/`, `scripts/`)

| Workflow | Does |
|---|---|
| `pages.yml` | Builds `_site/`, stamps cache keys, fetches the snapshot, deploys. Runs on push to `main`, on demand, on its own schedule, and whenever the keeper starts it |
| `keeper.yml` | Starts `pages.yml` every 10 minutes and opens or closes the "Live data stopped updating" issue using `scripts/health.mjs` |
| `site-check.yml` | Syntax check, WeatherKit test, smoke test on every pull request |
| `apple.yml` | Compiles the three Apple apps unsigned |
| `tv-screens.yml` | Apple TV simulator screenshots |
| `weatherkit-check.yml` | Manual end-to-end test of the WeatherKit key. Publishes nothing |

**Apple apps** (`apps/apple/`)

- iPhone, iPad and Mac run this same page inside a web view. `scripts/sync-web.sh` copies `index.html`, `js/`, `css/`, `fonts/` and `vendor/` into the app at build time and strips the visit counter. `App/Bridge.js` connects the page to the system: CoreMIDI, share sheet, Now Playing, Live Activity, haptics, fold position. The page knows it is in the app when `window.EMNative` exists.
- Apple TV is native Swift with its own synth in `Shared/Synth`. `Shared/Core/Music.swift` has to match the note rules in `js/audio.js`.
- All apps read `earthmidi.com/data/live.json`, the same snapshot as the site.

A site change reaches the web on merge. It reaches the iPhone, iPad and Mac apps only with the next app build.

## Related docs

- [live-data-cache.md](live-data-cache.md): the snapshot job, freshness and limits
- [weatherkit.md](weatherkit.md): the Open-Meteo / WeatherKit switch
- [design-system.md](design-system.md): tokens, type, the "observatory rack" direction
- [../apps/apple/README.md](../apps/apple/README.md): building the apps
