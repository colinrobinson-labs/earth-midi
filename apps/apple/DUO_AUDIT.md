# 📱 DUO_AUDIT.md: Earth MIDI × iPhone Duo

Audit date: Nov 11, 2026 · Repo: `colinrobinson-labs/earth-midi` at `71cd8e9` (main) · Playbook: IPHONE_DUO.md v1.0
Status (Nov 11): **plan approved by Colin, phases 2–5 and both wow features built.** Nothing here touches the iOS 1.0 (3) / macOS builds in review. Native Duo work ships in the next app build.

| Finding | Status |
|---|---|
| H1 SDK | Colin's Mac has Xcode 27.2 ✅. CI keeps Xcode 16 for the normal check; a manual "duo" run uses Xcode 27 when GitHub's runners have it |
| H2 bottom bar | ✅ System bottom toolbar, symbol + title on every item, Play added, AirPlay also in Settings |
| H3 IS_MOBILE | ✅ Live (site PR #70) |
| M1 sheet close | ✅ `SheetChrome`: NavigationStack + `.cancellationAction` Close |
| M2 bottom stacking | Partly: native bar is now a system bar. Web dock as a side rail waits for real outer-display sizes |
| M3 safe areas | ✅ Both sides (site PR #70) |
| M4 two panes | ✅ From 900px (site PR #70); confirm the inner display's width in the simulator |
| M5 fold | ✅ `js/fold.js` + native `FoldAwareWeb` (behind `DUO_SDK` until the API names are confirmed in Xcode) |
| M6 Readings split | ✅ Map and numbers side by side at regular width |
| L1 console tip | ✅ Viewport-based |
| L2 Live Activity, L3 widgets, L4 Dynamic Type | Open: needs the Duo simulator |

---

## 🧭 What applies to Earth MIDI

| Surface | Applies? | Why |
|---|---|---|
| **iOS / iPadOS app** (`apps/apple`, target `EarthMIDI_iOS`) | ✅ Yes, the main target | Native SwiftUI shell (bottom bar, 3 sheets, Live Activity, widgets) around the site's engine in a `WKWebView` |
| **The web site** (`index.html`, `js/`, `css/`) | ✅ Yes, twice | It *is* the app's main screen (bundled into the app), and it's what Safari users on Duo see. Playbook §9 |
| Widgets + Live Activity | ⚠️ Light check | Outer-display Dynamic Island expands around the camera |
| macOS app | ❌ No | Not affected by Duo |
| tvOS app | ❌ No | Not affected by Duo |
| Cameras (§3.4 occlusion aside, §6 phase 6, §7.4) | ❌ No | The app never uses a camera |

**The one-line read:** the code is clean of the classic anti-patterns (§5.1 grep is empty), but the app's chrome is hand-built, so it won't get the Duo vertical-bar behavior for free, and the web layer has a single 700 px phone/desktop switch that's decided once at launch. Those two things are most of the work.

---

## 🔍 §5.1 static scan

Ran the playbook grep across all 22 Swift files (2,648 lines) plus the Info.plists.

| Check | Result |
|---|---|
| `UIScreen.main`, `nativeBounds`, `UIDevice.current.orientation`, `statusBarOrientation`, `interfaceOrientation` | ✅ 0 hits |
| `userInterfaceIdiom`, `== .pad / .phone`, hard-coded `bounds == 844` | ✅ 0 hits |
| `UIWindow(frame:)`, manual `UIToolbar` / `UINavigationBar` / `UITabBar` | ✅ 0 hits (but see H2: the bar is a hand-built SwiftUI `HStack`, which the grep can't see) |
| `scaleAspectFill` / `.fill` on hero media | ✅ 0 hits |
| `horizontalSizeClass == .regular` ("regular means iPad") | ✅ 0 hits (no size-class logic at all, which is its own gap: see M4) |
| `UIRequiresFullScreen` | ✅ Not set |
| Orientation lock | ✅ None. iPhone: portrait + both landscapes. iPad: all four |
| Multiple scenes | `UIApplicationSupportsMultipleScenes = false`. Fine for Duo (one scene moves between displays) |
| Deployment target | iOS 17.0. OK, but every Duo API needs `if #available(iOS 27.1, *)` |
| **SDK** | ❌ **CI builds with Xcode 16** (`.github/workflows/apple.yml` picks `Xcode_16*` on `macos-15`). See H1 |

Web equivalent of the grep (`screen.width`, `window.orientation`, `innerWidth`, one-shot `matchMedia`):

| Hit | File | Verdict |
|---|---|---|
| `const IS_MOBILE = matchMedia("(max-width:700px)").matches` read once at load, used in 10+ places | `js/core.js:10` | ❌ H3 |
| Tablet tip uses `screen.width/height` + `pointer:coarse` | `js/console.js:435` | ⚠️ L1 |
| `innerWidth > 700` for popover placement | `js/tidy.js:21` | ✅ OK (re-runs on resize) |
| `innerHeight` sizing for the layers sheet and console faders | `js/sheet.js:6`, `js/console.js:326` | ✅ OK (re-run on resize) |
| Globe canvas sizes from its own element on every `resize` | `js/visuals.js:6-7` | ✅ Good, container-based already |

---

## 🚨 Findings, ranked by severity

### 🔴 High: blocks a good Duo experience

**H1. Built with the wrong SDK.**
CI compiles with Xcode 16 (iOS 18 SDK). Per §1, anything built before the iOS 27.1 SDK runs letterboxed on the inner display and offset next to the camera on the outer. Phase 0 fixes this. The archive Colin uploads is built on his Mac, so his Xcode version is what counts for the App Store.
- Fix: Xcode 27.1 on Colin's Mac, and bump the CI runner. ⚠️ verify that GitHub's macOS runners carry Xcode 27.1 yet. If they don't, CI keeps Xcode 16 for a compile check and the 27.1 build happens on the Mac only.

**H2. The iPhone bottom bar is hand-built, so it can't go vertical.**
`apps/apple/App/RootView.swift:50-75` draws Readings / MIDI / AirPlay / Settings as a custom `HStack` pinned under the web view. It isn't a system toolbar, so on the outer display and in inner landscape it stays a horizontal strip at the bottom. That breaks §2.4 (follow the system's vertical bars) and eats height on the outer display, which is the short one.
- The AirPlay button is an `AVRoutePickerView` custom view. Per §3.2, custom views **don't render in vertical bars at all**, so it needs a fallback (symbol button into overflow, or rely on Now Playing / Control Center's AirPlay).
- No Play/Stop in the native bar on iOS (the Mac toolbar has one). On Duo the rail is the natural home for it.
- Fix: wrap the root in `NavigationStack`, move items into `.toolbar` with `Label(title, systemImage:)`, set `visibilityPriority` so Play and Readings stay visible longest, task-focused compression.

**H3. The site decides "phone or desktop" once, at launch.**
`js/core.js:10` sets `IS_MOBILE` on load and never updates it. CSS re-flows on fold/unfold, but the JS keeps the launch display's tuning: tap radius on the globe (24 vs 14 px), particle counts, wind density, weather texture rate, record shape (vertical vs square), share-sheet behavior and default zoom. Open the app closed, then unfold, and you get desktop layout with phone hit-targets and phone particle density, or the reverse. On Duo this happens every time someone opens the phone.
- Fix: make it live (`matchMedia(...).addEventListener("change")` → update and re-tune). Small change, touches the files listed in the grep table. Also fixes iPad Split View and Stage Manager today.

### 🟠 Medium: works, but looks unfinished on Duo

**M1. Sheets carry their own close button.**
Readings, MIDI and Settings use a custom `SheetHeader` with an X inside the content (`RootView.swift:117-130`). On Duo the system wants Close at the top of the vertical axis via `.cancellationAction`. Today it'll sit wherever the content puts it, and on the outer display the sheet has no system bar at all.
- Fix: wrap each sheet in `NavigationStack` + `ToolbarItem(placement: .cancellationAction)`. Set `.presentationPlacement` deliberately for the inner display.

**M2. Bottom stacking on the outer display.**
On phone widths the page already has a fixed bottom dock (`--dock: 70px`, `index.html:327`) and a bottom-snapping layers sheet (`js/sheet.js`), and the app adds its own bottom bar under that. On the outer display, which is wider and shorter than a normal iPhone, that's three bottom strips stacked on the screen that has the least height. H2 fixes the native one. The web dock should move to a side rail when the viewport is wide-and-short (`aspect-ratio` media query), not just when it's narrow.

**M3. Safe areas only respect the left side on the site.**
`index.html:55` pads the body with `env(safe-area-inset-left)` on both sides, and the full-bleed stage (`index.html:331`) does the same. On the outer display the camera and status bar sit on a *side* edge (§9), so the right inset matters now. Inside the app this is mostly hidden because SwiftUI keeps the web view inside the safe area, but Safari users on Duo will see content under the camera. One-line CSS fix per rule.

**M4. The inner display probably lands in the "in-between" layout.**
The site has two real layouts: phone (≤700 px) and desktop with the side panel (≥1100 px). Between them it's a single column. The inner display is iPad-class, and if its CSS width falls in that 701–1099 band, a Duo user unfolds into a stretched single column instead of globe + layers side by side. ⚠️ verify the inner display's CSS width in the simulator. Fix: drive the two-pane layout from the container's width with `@container`, and drop the bar to ~900 px when the globe has room.

**M5. The globe sits exactly where the fold is.**
The globe is centered, and it's interactive: tap a city for weather, drag in Zeus Mode, draw Zones. In book pose the hinge runs down the middle of the globe and the center of the map. Safari has no fold API (WebKit support for Viewport Segments / Device Posture is unknown, §9), but **the native app can read the fold** with `reservedRegions(kind: .division)` and hand it to the page through the existing `Bridge.js` as CSS variables (`--fold-x`, `--fold-w`, `--fold-axis`). The page then splits around it. This is the backbone of both wow features below.

**M6. No extra hierarchy level on the inner display (native).**
Readings is a single scrolling column (map, 2-column grid, chord, quakes). On regular width it should be map on one side, numbers on the other (`ArrangementView` `.split`). The 2-column grid is already even (§2.8 ✅).

### 🟡 Low

**L1. Console tablet tip uses `screen` size** (`js/console.js:435`). On Duo the screen size changes when you fold, so the one-time "Try the Console" tip may show or hide for the wrong display. Use the viewport instead.

**L2. Live Activity around the outer camera.** Compact and minimal Dynamic Island views exist (`Widgets/EarthWidgets.swift`). Fixed-size spectrum ring and stop button should be fine, but ⚠️ verify in the Duo simulator since the outer island expands around a corner camera.

**L3. Widgets** use fixed small frames for dots and icons only. No action expected. Check the medium widget at the outer display's home-screen size.

**L4. Dynamic Type.** The native screens use fixed `Theme.caps(9…10)` and `Theme.mono(...)` sizes, so the largest accessibility sizes won't scale. Not Duo-specific but §5.2 asks for it. Worth doing while we're in those files.

### ✅ Already passing

- **Playback survives fold/unfold.** One `WKWebView` held by `PlayerHub` for the app's life, plus background audio, so a resize never reloads the engine. (§5.3 mid-video equivalent ✅ by design, still to confirm on device.)
- **Globe canvas is container-sized** and re-measures on every resize (`js/visuals.js:6`).
- **No orientation lock, no full-screen requirement, no idiom checks.**
- **Even 2-column grids** in native Readings.
- **Viewport meta** already has `viewport-fit=cover`.
- **Reduce Motion** respected across the site's animations.

---

## 🗺️ Proposed §6 phase plan

Estimates are Claude working time plus what Colin has to do. Everything ships behind the normal PR + auto-merge flow. Web changes go live on merge (reversible). Native changes ride the **next app build after the one in review**.

| Phase | What we'd do for Earth MIDI | Claude time | Colin does | Done when |
|---|---|---|---|---|
| **0. Toolchain** | Point CI at Xcode 27.1 (or keep 16 for compile-only if the runner lacks it). Add the Duo simulator to the README build steps | ~1 hr | Install **Xcode 27.1** on the Mac (App Store, one click) | App launches full-display in the Duo simulator |
| **1. Auto-scan** | Run Xcode's "get my app ready for iPhone Duo" assistant on Colin's Mac through Remote Control, merge its list into this file | ~1 hr | Approve the Remote Control prompt | Combined issue list here |
| **2. Resizability** | H3 (live `IS_MOBILE`), M3 (both safe-area sides), L1 (console tip), M2 web dock as side rail when wide-and-short | ~3 hrs | Nothing | Site behaves the same launched folded or unfolded. Also helps iPad Split View today |
| **3. Bars** | H2 + M1: `NavigationStack` root, system toolbar with symbol + title on every item, Play/Stop on the rail, AirPlay fallback, `visibilityPriority`, sheet close buttons as `.cancellationAction` | ~4 hrs | Nothing | Rail goes vertical on the outer display and inner landscape |
| **4. Inner display** | M4 (two-pane web layout from container width), M6 (Readings as a split view) | ~4 hrs | Nothing | Unfolding feels like the iPad layout, not a stretched phone |
| **5. Fold** | M5: native reads the fold and passes it to the page; page splits globe and panels around it. Even-column grids at fold widths | ~5 hrs | Nothing | Book and tent poses show nothing interactive in the hinge |
| **6. Cameras** | **Skip.** No camera use | 0 | — | — |
| **7. Continuity** | §5.3 script on simulator: fold mid-playback, mid-preset-name typing, mid-scroll in Producer. L2, L4 | ~2 hrs | 20-min device pass once he has a Duo | Zero lost state |
| **8. Wow features** | The two below, behind a setting so they can be switched off | ~6 hrs | Try them on device | Shipped and tested |
| **9. App Store** | Duo screenshots + a short fold-transition preview, featuring nomination text ("optimized for iPhone Duo, all poses") | ~2 hrs | Upload in App Store Connect (his clicks) + submit the build | Badge on the product page |

**Total:** roughly 3 to 4 working days of Claude time, with Colin's part being one Xcode install, one Remote Control approval, a device test and the App Store clicks.

**Order of operations:** phase 2 can start today and ship to the web straight away (it also improves iPad). Phases 3 to 5 and 8 land in the repo and wait for the next build. Phase 0 needs Xcode 27.1 before any native Duo code can compile, because the new APIs (`ArrangementView`, `reservedRegions`, the new toolbar placements) don't exist in the iOS 18 SDK.

---

## 🚀 The 2 best §8 wow features for Earth MIDI

### 1. 📖 Book mode = Instrument + Desk
Partially fold the phone like a book: **the globe plays on one page, the Console (the mixing desk already live at `#console`) sits on the other.** Watch a quake ring on the left, ride its fader on the right. Unfold flat and it goes back to the normal two-pane layout, same selection, same playback, no jump.
- Why it's the best fit: Earth MIDI's two halves are "watch the planet" and "shape the sound". A book fold is literally two pages. The Console already exists and was built for tablets, so this mostly reuses what's live.
- How: M5 (native passes the fold to the page) + a CSS layout keyed on `--fold-axis: vertical`. The playbook's own "Book mode = two-page app" pattern.
- Risk: low. Falls back to today's layout anywhere the fold isn't reported.

### 2. ⛺ Tent / stand mode = Planet Clock
Set it down half-folded on a desk or nightstand: **top half is a full-bleed globe with the last event and the current scale in big type, bottom half is a one-row transport (Play, Ambient/Pulse, volume).** No chrome, screen stays awake while playing, dims after a minute. It turns the phone into an ambient Earth instrument for the studio, the bedside or the FOH table.
- Why: the Apple TV app already proves people want Earth MIDI as an ambient object. This puts that on the desk with no TV needed, and it demos instantly in a store or a video ("fold it and it becomes a clock for the planet").
- How: same fold bridge with `--fold-axis: horizontal`, the playbook's overlay arrangement (content top, controls bottom). Reuses the TV app's ambient styling.
- Risk: low to medium. Needs device time to tune brightness and wake behavior.

**Runner-up:** *Closed glance, open dive.* Closed, the outer display shows a one-thumb "now playing" card (last event, note, scale, play button). Unfold and the globe zooms to that same event. Strong, but phases 2 to 4 already get most of it for free, so it's less of a headline.

**Deliberately skipped:** anything camera-based (no use case) and the "presenter / audience" outer-display mode (the playbook flags it as unverified outside the camera case).

---

## ⚠️ What I couldn't verify from here

- No Duo simulator or device in this environment. Everything above is from reading the code against the playbook. Pixel widths of the two displays, and whether the inner display lands in the 701–1099 px band (M4), need the simulator.
- API names marked ⚠️ in the playbook (`reservedRegions` labels, `visibilityPriority` cases, `ToolbarOverflowMenu` shape) get confirmed against Xcode 27.1 in phase 0.
- Whether GitHub's macOS runners have Xcode 27.1 yet (H1).
