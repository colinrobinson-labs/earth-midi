# Earth MIDI backlog

Audit of `main` at `487bd1e`, 16 Nov 2026. Ranked by impact ÷ effort, best first.
Impact and effort are H / M / L. Tick items off here as their PRs land.

Already covered by earlier audits (PRs #53, #54, #75, #76, #77), so not repeated: self-hosted fonts and
libraries, CSP, cache busting, support/press/what's-new pages, privacy manifests, App Store links,
the MIDI prompt on Play, tap targets, Actions version bumps, phone layout shift.

What the audit ran: `node --check` on every script, `tests/weatherkit.test.mjs`, a local build like
`pages.yml`, `tests/smoke.mjs` (16 page/viewport checks with axe), ESLint over the combined site scripts,
a hostile-input probe against share links, and a visual pass on desktop and phone. Everything that
exists passes. The gaps are below.

| # | Area | Item | Impact | Effort |
|---|------|------|--------|--------|
| 1 | Security | Settings that arrive from outside (share links, imported preset and session files) are merged into the live config without checking keys, types or ranges. Validate against the defaults: known keys only, right type, clamped numbers, allowed values for choices. Details are with the security thread, not in this public file. | H | S |
| 2 | Security | Escape every config or file value that reaches `innerHTML`, or build those nodes with `textContent`. One shared `esc()` instead of the three copies in `visuals.js`, `extras.js` and `studio.js`. | H | S |
| 3 | Tests | Hostile-input test in `tests/`: load a share link and a preset file full of junk values, assert no script runs and the page still plays. Add it to `site-check.yml`. Locks in 1 and 2. | H | S |
| 4 | Bugs | Support page says the app is on Mac (meta description and intro) while the rest of the site says "Mac coming soon". `whats-new.html` has the same mismatch in one heading. Make them agree. | M | S |
| 5 | Docs | README has no setup, run, test or deploy steps. Add: serve locally, run the smoke test, how the deploy and the 10-minute data refresh work, the weather switch, where the Apple apps live, how to check `data/status.json`. | M | S |
| 6 | Tests | No lint in CI. Add a small ESLint config (undefined names, duplicate keys, unreachable code, reassigned functions) and run it in `site-check.yml`. Today's run is clean apart from 12 unused variables and 2 reassigned functions (`initAudio`, `drawMap`), so it starts green. | M | S |
| 7 | Tests | "Same reading, same note" has no test. Add a table test: known readings in, expected notes out, run against `js/audio.js` rules. Then a parity check that `apps/apple/Shared/Core/Music.swift` gives the same table, since the README says it is a 1:1 port. | H | M |
| 8 | Tests | `scripts/snapshot.mjs` has an offline mode (`SNAPSHOT_FAKE`) that no test uses. Add a test for trimming, the keep-last-good-copy path, and `status.json`. Same for `scripts/health.mjs`. | M | S |
| 9 | Security | Session files do `Object.assign(S, j.data)`: a file can overwrite any piece of app state. Copy only the feed fields a session is meant to hold, and check shapes. | M | S |
| 10 | Security | CSP still allows inline scripts and inline styles. Move the two small inline scripts into files and drop `'unsafe-inline'` from `script-src` (keep it for styles for now). Makes any future injection bug far less useful. | M | M |
| 11 | Security | Pin GitHub Actions to commit SHAs (Dependabot keeps them fresh). Pin the Playwright and axe installs in `site-check.yml` with a lockfile instead of `npm i --no-save`. `tv-screens.yml` has `contents: write` on every `claude/**` push; narrow it to the step that commits. | M | S |
| 12 | UX-Polish | Layer cards with no chart (Earthquakes, Solar wind, Solar X-rays) leave half the card empty on desktop. Give them a 24 h strip like the others, or let those cards be shorter. | M | M |
| 13 | De-AI | Design: the 12 reading cards are one repeated box with the same "How it sounds" link. Break the grid's sameness: group by source (ground, sea, sky, space), vary card size by how much the reading has to show, keep it inside the observatory-rack system. Screenshots before and after. | M | M |
| 14 | De-AI | Copy pass in Colin's voice on index, support, press, what's-new, App Store listing. No filler words were found by search, so this is a read-through for flat or over-explained lines (for example "write to us below" on a one-person project, long hints in Producer). Keep the approved AI wording exactly. | M | M |
| 15 | Completeness | Empty and error states: "Live feeds unreachable, playing demo data" is easy to miss, the weather chip says "weather feed unreachable, retrying" forever, and the Event log sits blank while stopped. Make each state say what is happening and what to do. | M | M |
| 16 | Completeness | Web prompts: 7 uses of the browser's `prompt()`/`confirm()` (preset names, copy fallbacks). Replace with the site's own dialog so it matches the design and works the same in the apps. | L | M |
| 17 | Perf | 27 separate script files (about 520 KB unminified) and 88 KB of inline CSS load on every visit. Measure first, then try: `defer`, one minified bundle built in `pages.yml`, lazy-load Console, Zeus Mode and Record until opened. Phone Lighthouse is 91 today; target 95+. | M | M |
| 18 | Perf | Repo weight: `press/earth-midi-story.mp4` (20 MB) and `review/earth-midi-ios-demo.mp4` (9.6 MB) ship with every deploy, and `.git` is 104 MB. Re-encode the press video, and ask Colin before removing the review video (Apple may still reference its URL). Review video removed Nov 16 after all three platforms were approved. | L | S |
| 19 | Completeness | No offline support on the web: with no connection the page loads nothing. A small service worker that caches the shell and the last snapshot would make the installed web app open offline with the last known data, clearly labelled. | M | M |
| 20 | De-AI | Code: comments are mostly useful, but files are written as very long lines (some over 900 characters), which makes review and diffs hard. Format with Prettier in one no-behaviour-change commit, then delete dead code (`typeof measureHud` call in `tidy.js` that can never run, 12 unused variables). Coordinate with open threads first, since it touches every file. | M | M |
| 21 | Bugs | Apple apps: no tests at all, 3 force-unwrap/`print` spots to review, and JS errors from the web view are only printed. Add unit tests for `Music.swift` and `EarthData.swift` decoding, and surface web-view errors to the Readings status. | M | M |
| 22 | Docs | `docs/` has the design system, data cache and WeatherKit notes but no map of the code. Add `docs/architecture.md`: what each `js/` file owns and the load order, since order matters and nothing enforces it. | L | S |
| 23 | UX-Polish | Accessibility beyond axe: keyboard-only pass through Producer, Console and Zeus Mode, screen-reader labels on the globe, and a check that reduced-motion covers the title and globe animation. | M | M |
| 24 | Completeness | ~~When macOS 1.0 is approved: put Mac back in the copy and add the Mac App Store link.~~ Done Nov 16: macOS 1.0 approved; Mac is in the copy on press, support, what's-new and the footer link (the welcome card and JSON-LD already covered it). | M | S |

## Needs Colin's call
- ~~**Review demo video** (#18)~~: removed Nov 16 once iOS, Mac and Apple TV were all approved.
- **Card regrouping** (#13): this changes how the main page looks. Mock-ups first, then a pick.
- **Formatting pass** (#20): rewrites every script file's layout. Safe, but it makes old diffs harder to read.
- Still open from before: code license, and a paid weather plan if the site or apps ever make money.
