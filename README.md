# Earth MIDI

**The planet as a live instrument.** Earthquakes, solar wind, geomagnetic storms, tides, ocean swell, the ISS orbit and more, each run through the same rule every time and played as sound and MIDI in your browser. Same reading, same note.

Live at **https://earthmidi.com**. The iPhone, iPad, Mac and Apple TV app is [on the App Store](https://apps.apple.com/app/id6832020441).

**No active AI.** AI helped design and build Earth MIDI, including the rules that turn data into sound. No AI runs while you listen: every note comes from a published sensor reading.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | The instrument: markup and the main stylesheet, one page |
| `js/` | 27 plain scripts, no framework and no build step. Load order matters, see [docs/architecture.md](docs/architecture.md) |
| `support.html` `press.html` `whats-new.html` `privacy.html` `404.html` | The other pages, styled by `css/` |
| `vendor/` `fonts/` | topojson-client, JSZip, land outlines and the fonts, all served from earthmidi.com |
| `scripts/` | Node scripts the deploy runs: data snapshot, cache fingerprints, health check, WeatherKit, icons |
| `tests/` | Browser smoke test and the offline WeatherKit test |
| `.github/workflows/` | Deploy, data refresh and checks |
| `apps/apple/` | iPhone, iPad, Mac and Apple TV apps ([apps/apple/README.md](apps/apple/README.md)) |
| `docs/` | Architecture, design system, live data cache, weather switch |

## Run it

You need Python 3 (or any static file server) and nothing else. There is no `package.json` and nothing to install.

```sh
git clone https://github.com/colinrobinson-labs/earth-midi.git
cd earth-midi
python3 -m http.server 8765
```

Open http://localhost:8765/ and press Play. Use a server rather than opening `index.html` from disk, because the page fetches `vendor/land-110m.json` and browsers block that on `file://`.

A local copy has no `data/` folder, so the page skips the snapshot and calls each data source itself. That is the built-in fallback and it sounds identical. If a source is down you get its demo data, labelled as such.

Handy addresses while working:

| Address | Opens |
|---|---|
| `#console` | The mixing desk |
| `#zeus` | Zeus Mode sandbox |
| `#simple` / `#embed` | Simple view / the embed layout |
| `#welcome` | The first-visit card again |
| `?fx=full` `?fx=light` `?fx=auto` | Force an effects tier |
| `?fold=v` `?fold=h` | Folding-phone layouts on any screen |

## Test it

Needs Node 22. The first two checks need no install:

```sh
for f in js/*.js scripts/*.mjs tests/*.mjs; do node --check "$f" || break; done
node tests/weatherkit.test.mjs
```

The smoke test opens every page on a phone and a desktop in Chromium, presses Play, and fails on any script error, sideways scroll or serious accessibility problem. With the site already running on port 8765:

```sh
npm i --no-save playwright@1.49.1 axe-core@4.10.2
npx playwright install chromium
node tests/smoke.mjs
```

Point it somewhere else with `SITE=http://localhost:9000/ node tests/smoke.mjs`.

`npm i --no-save` creates a `node_modules/` folder that is ignored by git. Every pull request runs all three checks in the **Site check** workflow, against a copy of the site built the same way the deploy builds it.

## Deploy it

Merging to `main` deploys. There is no other step.

The **Deploy site + live data** workflow (`.github/workflows/pages.yml`) does this on every push to `main`:

1. Copies the repo to `_site/` and drops `.github`, `scripts`, `docs`, `tests` and `apps`.
2. Runs `scripts/stamp.mjs`, which adds `?v=<content hash>` to every script and stylesheet reference so browsers never run a stale file. Don't hand-edit `?v=` values in the repo.
3. Runs `scripts/snapshot.mjs` to fetch the live data (next section).
4. Publishes `_site/` to GitHub Pages. `CNAME` points it at earthmidi.com.

To see exactly what will ship:

```sh
mkdir _site && git archive HEAD | tar -x -C _site
rm -rf _site/.github _site/scripts _site/docs _site/tests _site/apps
node scripts/stamp.mjs _site
node scripts/snapshot.mjs _site    # optional: adds _site/data/ from the real feeds
(cd _site && python3 -m http.server 8765)
```

`git archive HEAD` only takes committed files, so commit first.

One setting has to stay as it is: **Settings → Pages → Source** must be "GitHub Actions". If it is ever switched back to a branch, the workflow skips itself and the data stops refreshing.

## Live data

Every listener reads one cached snapshot instead of hitting 20 free public feeds directly.

- The same deploy workflow runs again every 10 minutes. It refetches the feeds and republishes `data/live.json`, `data/wx.json` and `data/status.json`.
- GitHub runs scheduled workflows late, so **Keep live data fresh** (`keeper.yml`) starts the deploy every 10 minutes itself. It also opens a "Live data stopped updating" issue when the snapshot goes stale and closes it when data is back.
- A feed that fails keeps its last good copy. The snapshot step can't fail the deploy.
- The feed list lives in `js/feeds.js`, shared by the page and the snapshot job.

Check on it: https://earthmidi.com/data/status.json shows when each feed was last fetched and any error. From a terminal, `node scripts/health.mjs` prints nothing when all is well.

Full write-up: [docs/live-data-cache.md](docs/live-data-cache.md).

## Weather switch

Weather comes from Open-Meteo, whose free tier is non-commercial. One Actions variable, `WEATHER_SOURCE=weatherkit`, moves the weather grid and city temperatures to Apple WeatherKit on the next refresh, with no code change. The key stays in Actions secrets. Setup, quota and what stays on Open-Meteo: [docs/weatherkit.md](docs/weatherkit.md).

## Apple apps

`apps/apple` holds one XcodeGen project for three platforms. The iPhone, iPad and Mac apps bundle this site's own engine at build time, so they play exactly what earthmidi.com plays. The Apple TV app is native Swift, and `Shared/Core/Music.swift` mirrors the note rules in `js/audio.js`. Change a rule in one, change it in the other.

```sh
brew install xcodegen
cd apps/apple && xcodegen generate && open EarthMIDI.xcodeproj
```

The **Apple apps build** workflow compiles all three unsigned on every change. Signing and upload happen on Colin's Mac. More in [apps/apple/README.md](apps/apple/README.md).

## Working on the code

Read [docs/architecture.md](docs/architecture.md) first. The short version:

- Every file in `js/` is a classic script sharing one global scope. A second top-level `const` with a name another file already uses stops that whole file from loading. Wrap new files in a block or a function.
- Scripts run in the order `index.html` lists them, and later files lean on earlier ones.
- Colours, type and spacing follow [docs/design-system.md](docs/design-system.md).
- If you touch a note rule, the reading-to-note mapping has to stay deterministic. That is the product.

## License and credit

© 2026 Colin Robinson. All rights reserved. The source is public so anyone can check what the page does. It is not open source: don't republish or host copies.

What you make with Earth MIDI is yours to release, free, with this credit:

> Planetary data sonified with Earth MIDI by Colin Robinson · earthmidi.com

Full terms, data sources and the privacy note are in [LICENSE.md](LICENSE.md). Questions: hello@earthmidi.com or https://earthmidi.com/support
