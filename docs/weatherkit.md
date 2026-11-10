# Weather switch: Open-Meteo ↔ Apple WeatherKit

Earth MIDI's weather comes from Open-Meteo, whose free tier is non-commercial. If Earth MIDI is ever monetized (paid apps, subscriptions or ads), one switch moves the weather to Apple WeatherKit, which comes with the Apple Developer membership (500,000 calls a month included).

## The switch

**GitHub → repo Settings → Secrets and variables → Actions → Variables → `WEATHER_SOURCE`**

| Value | Weather comes from |
|---|---|
| not set, or anything else | Open-Meteo (default) |
| `weatherkit` | Apple WeatherKit |

The change takes effect on the next data refresh (within about 10 minutes) for the site and every app build already installed. No code change, no deploy, no app update. To switch back, set it to `open-meteo` or delete the variable.

Safety net: if the switch says `weatherkit` but a secret is missing, the job stays on Open-Meteo and the health check opens a "Live data stopped updating" issue naming the missing secret.

## What moves, what stays

| Feed | With the switch on |
|---|---|
| Weather layer: 408-point global grid (wind, cloud, rain, temperature, pressure) | WeatherKit |
| Planet chord: 10 city temperatures | WeatherKit |
| Tap the map for weather | Plays the grid value at that spot. The extra "this exact point" Open-Meteo lookup is skipped; WeatherKit is never called from a browser. |
| Ocean swell (marine model) | Open-Meteo. WeatherKit has no wave data. |
| Jet stream (250 hPa winds) | Open-Meteo. WeatherKit has no upper-air winds. |
| Air quality (PM2.5, UV) | Open-Meteo. WeatherKit has no air quality. |

The three that stay are small (about 2,000 Open-Meteo calls a day). On a monetized site they'd need Open-Meteo's smallest paid plan, or a move to NOAA sources (WaveWatch III for swell, GFS for the jet stream); air quality would need another provider.

## Same sound either way

The snapshot job (`scripts/weatherkit.mjs`) asks WeatherKit for the same points and the same 48 hours, then rewrites the answer into Open-Meteo's exact shape and stores it under the same key. The page, the iOS/Mac apps (same engine) and the Apple TV app (`EarthData.swift`) read it unchanged, so every note rule stays the same.

| WeatherKit (hourly) | Open-Meteo field the sound reads |
|---|---|
| `temperature` °C | `temperature_2m` °C |
| `precipitationAmount` mm | `precipitation` mm |
| `cloudCover` 0–1 | `cloud_cover` %, ×100 |
| `windSpeed` km/h | `wind_speed_10m` km/h |
| `windDirection` ° | `wind_direction_10m` ° |
| `pressure` mbar | `pressure_msl` hPa (same unit) |

The values themselves will differ slightly, because they come from a different weather model. Those are real readings, not errors.

## Why server-side

- The private key lives only in GitHub Actions secrets. Browsers and apps never see it.
- One fetcher, on a fixed schedule. A traffic spike or a million app installs costs **zero** extra WeatherKit calls.
- Quota: 418 points (408 grid + 10 cities). Grid every ~110 min plus cities every 30 min ≈ **5,800 calls a day ≈ 175,000 a month**, about 35% of the 500k included. Each refresh's count is in `earthmidi.com/data/status.json` under `weather.weatherkitCalls`.
- The apps read the same cache, so they need no WeatherKit entitlement, no capability change and no app update to follow the switch.

## Apple's attribution

Apple requires the Apple Weather mark and a link to its legal/data-sources page wherever WeatherKit data appears. With the switch on, the job downloads the official mark from Apple's attribution endpoint into `/data/apple-weather-dark.png` and publishes the legal URL. The mark shows only while WeatherKit data is on screen:

- **Site:** the weather legend on the map, the tap tooltip, the Planet chord card, and the footer credits. Exports (MIDI, WAV, CSV, JSON, zips) credit Apple Weather in their source line.
- **iOS / iPad / Mac:** the site engine shows the same marks; the native Readings sheet shows it under the Planet chord.
- **Apple TV:** under the "just played" lines.

## One-time setup (already done if the secrets exist)

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** → + → **Services IDs** → e.g. `com.colinrobinson.earthmidi.weather`.
2. Same page → **Keys** → + → name "Earth MIDI WeatherKit", tick **WeatherKit** → Continue → Register → **Download** the `.p8` (only downloadable once) and note the **Key ID**.
3. GitHub repo → Settings → Secrets and variables → Actions → **Secrets**: `WEATHERKIT_KEY` (the whole .p8 file), `WEATHERKIT_KEY_ID`, `WEATHERKIT_SERVICE_ID`. Team ID defaults to `VNJA6Y7DCH` (override with a `WEATHERKIT_TEAM_ID` variable).
4. Actions → **WeatherKit check** → Run workflow. It fetches the full set once (~420 calls), compares with Open-Meteo and prints a report. It publishes nothing and leaves the switch alone.

## Testing

- `node tests/weatherkit.test.mjs` runs offline in CI: token signing, field mapping, point order, and the stop on a refused key.
- `WeatherKit check` (above) is the live test with the real key.
