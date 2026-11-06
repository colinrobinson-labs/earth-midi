# Earth MIDI design system

## Direction: "observatory rack"

Earth MIDI is a live instrument fed by scientific sensors. The interface should feel like a piece of studio or lab rack gear running at night: graphite panels, engraved legends, hairline rules, readings in a monospace face, and colour that only lights up where data is actually flowing.

Three rules carry the identity:

1. **Data owns the colour.** The 13 layer hues (quakes red, solar wind amber, ocean cyan…) appear on meters, dots, card top-rules, fader caps, sparklines and channel strips. Chrome (buttons, tabs, panels, dialogs) stays neutral graphite. Selected state is paper-white fill, not a hue.
2. **Three type voices, each with one job.** Archivo Expanded for headings and legends, IBM Plex Sans for anything you read or press, IBM Plex Mono for numbers, readings, rules, timestamps and tiny uppercase captions.
3. **The planet is the light source.** Glows are driven by `--hit` / `--glow` (real events). Nothing glows decoratively at rest except the Play call-to-action and the Producer button's live knobs.

The signature element is the **layer meter** under the title (`#hmeter`): one bar per layer, in its colour, jumping with that layer's live hits and dimming when muted. The 6-hue `--spectrum` strip (hard stops, not a smooth rainbow) is its static echo on the top edge of the Producer panel, Console, welcome card and phone Layers sheet.

## Tokens (index.html `:root`)

| Role | Token | Value | Use |
|---|---|---|---|
| Page | `--bg` | `#07090b` | body, overlays |
| Panel | `--sf0` / `--panel` | `#0c0f12` | cards, panels, dialogs |
| Well | `--sf1` | `#0a0d10` | inset groups, chip rows |
| Control | `--sf2` | `#12161a` | buttons, selects, segments |
| Hover | `--sf3` | `#181d22` | hover fill |
| Rule | `--line` / `--line2` / `--line3` | `#1a2026` / `#262e36` / `#3a4550` | panel borders / control borders / hover borders |
| Text | `--fg` / `--fg2` | `#eceee8` / `#c8cdd0` | primary / body copy |
| Muted | `--mute` | `#97a1aa` | captions, secondary (≈7:1 on panels) |
| Dim | `--dim` | `#69737c` | decorative only, never for text that must be read |
| Record | `--rec` | `#ff3b4e` | record buttons, REC pill |
| Feedback | `--ok` `--warn` `--err` | green / amber / red | status text |
| Layers | `--q --s --o --x --w --t --c --m --k` | unchanged | data colour only |
| Radii | `--r1` / `--r2` / `--r3` | 6 / 10 / 14 px | chips / cards, controls / big panels, dialogs |
| Strip | `--spectrum` | 6 hard stops | 2px top rules on major panels |

Hard-coded chrome hexes in JS-injected CSS were replaced with these tokens. Canvas drawing code still uses literal colours (canvas can't read CSS variables).

## Typography

| Voice | Font | Where |
|---|---|---|
| Display | Archivo, width 125 (Expanded), 700–900 | Title (900), panel and card headings (700, 13–22px, sentence case), PLAY |
| UI / prose | IBM Plex Sans 400–600 | Buttons, tabs, chips, layer names, labels, tagline, dialogs, tables |
| Data | IBM Plex Mono 400–600 | Values, BPM, clock, rules (`velocity = …`), status line, captions (`.cap`: 10–10.5px, uppercase, 0.12em) |

Only the width-125 Archivo face is loaded, so every `var(--disp)` renders Expanded without per-rule `font-stretch`. Headings are sentence case; uppercase is reserved for small mono captions so wide letters never wrap awkwardly. The one exception is the Console section legends (CHANNELS, SOUND, PULSE, MASTER), which read like silkscreen on hardware and are short enough not to wrap. Title size: `min(176px, (viewport − 40px) / 7.55)`, filling the content width.

## Components

- **Buttons:** Plex Sans 500 13px, `--sf2`, 1px `--line2`, 8px radius, 44px tall in the transport. Primary = paper white fill (`.go`, selected segment). Record = `--rec`.
- **Segments (`.seg`, `.vsw`):** one bordered pill, 1px dividers, selected = `--fg` fill.
- **Globe HUD:** every control is a 32px `.seg` on a blurred 80% graphite plate. Zeus Mode is the one gold exception (outline, gold text, filled when on). On phones the HUD is a single horizontally scrollable row with a fade at the right edge.
- **Cards (`.ch`):** `--r2`, 2px top rule in the layer colour, glow and border tint follow `--hit`.
- **Producer groups:** the Sound tab (many groups) uses masonry columns (`.pgrid.mas`) so short groups never leave holes; other tabs use an auto-fit grid; Presets is one column (`.pgrid.pre`).
- **Phone transport:** one row (playback, MIDI out with an inset caption, share), hidden MIDI control where the browser has no Web MIDI (iOS Safari).
- **Status line:** mono 11.5px under a hairline inside the transport bar.
- **Empty states:** say what will appear and how to make it happen (see `#log:empty`).
- **Focus:** every focusable element gets a 2px `--o` outline at 2px offset (`:focus-visible`).
- **Icons:** inline SVG strokes (`.ic`, `.sic`), no emoji in controls.

## Motion

Keep the established motion (letter hue drift, beat bounce, title play, live dot, Producer knobs). New motion must be tied to data (`--hit`, `--glow`, `--bt`). Everything respects `prefers-reduced-motion`.

## Copy

Direct and specific: say what the data is and what the button does. Keep product terms (Live, Go live, Ambient, Pulse, Producer, Console, Zeus Mode, Zones, Layers). AI wording stays as approved: "no active AI"; AI helped design and build the site and the data-to-sound rules; no AI runs while you listen. Never "no AI" / "0% AI", and avoid the word "fixed".

## Coverage (Nov 6, 2026 pass)

Checked at 1440, 768 and 390 px wide, with labelled demo data (the review sandbox can't reach the live feeds):

| Screen / state | Status |
|---|---|
| Header, layer meter, transport bar, status line | Done |
| Globe HUD, Zones button, Zeus Mode (on/off), full-screen button | Done |
| Layers list (desktop) and phone Layers sheet | Done |
| 13 layer cards, MIDI monitor, event log (empty state), Trace, Output | Done |
| Producer: Sound, Mixer, Rhythm, Master, MIDI, Presets | Done |
| Export panel | Done |
| Welcome dialog, Record sheet (desktop + phone bottom sheet) | Done |
| Console (desktop, tablet, phone) and tablet Console suggestion | Done |
| How it works, Use it in your DAW, Accuracy, license, footer | Done |
| Phone dock | Done |
| Recording in progress pill, recorder result view | Styled via tokens; not exercised (needs a real recording) |
| Live data states (real readings, "delayed" note) | Not visible in the sandbox; same components as demo |
| og.png share image | Unchanged (still uses the old title face) |

## Adding a screen

Start from `--sf0` panel + `--line` border + `--r2`. Heading in `var(--disp)` 700 sentence case, captions with `.cap`, controls as plain `button` / `.seg`. Use a layer colour only if the element shows that layer's data, passed as `--c` / `--ac`.
