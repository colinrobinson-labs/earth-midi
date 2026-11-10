# Live data cache

Earth MIDI reads about 22 public data feeds (USGS, NOAA SWPC, NOAA tides, Open-Meteo, NASA EONET, ISS). Before this change every visitor called every feed once a minute while playing, so a traffic spike multiplied straight onto free APIs that can rate-limit or slow down.

## How it works now

| Layer | What it does |
|---|---|
| `js/feeds.js` | One list of every feed URL, with `every` (how often the snapshot job refetches it) and `ttl` (how old a copy the page will still use). Shared by the page and the job, so both build identical URLs. |
| `scripts/snapshot.mjs` | Fetches each feed once, trims it to the fields the page reads, writes `data/live.json` (small feeds), `data/wx.json` (weather grid) and `data/status.json` (health). A failed feed keeps its last good copy with its original timestamp. Never fails the deploy. |
| `.github/workflows/pages.yml` | Runs on every push to `main`, every 10 minutes, and on demand. Copies the site, runs the snapshot, deploys to GitHub Pages. |
| `js/core.js` (`viaSnap`) | Page reads the snapshot first. If a feed's copy is older than its `ttl`, it calls the source directly. If the source fails too, it plays the last real copy (up to 48 h old) and the status line shows a quiet "… delayed" note with a hover listing each feed's age. Only with no copy at all does it fall back to labelled demo data, as before. |
| Browser cache | Pages serves `data/*.json` with a 10-minute cache, so a listener downloads `live.json` about once every 10 minutes. The last snapshot is also kept in `localStorage` (`em.snap.live`) for offline/outage starts. The weather grid keeps its own 90-minute `localStorage` cache. |

**Weather switch:** the weather grid and city temperatures can come from Apple WeatherKit instead of Open-Meteo with one Actions variable (`WEATHER_SOURCE=weatherkit`). See [weatherkit.md](weatherkit.md).

Upstream load is now roughly constant (one fetcher) no matter how many people are listening. The weather-tap lookup (one point, on click) still goes direct, since it can't be precomputed.

## Requirements and limits

- **Pages source must be "GitHub Actions"** (Settings → Pages → Build and deployment → Source). Until then the workflow skips itself and the site keeps deploying from the branch, with the page calling sources directly as before.
- **Freshness:** GitHub's scheduler often runs late under load (10–20 min). Fast feeds have a 20-minute `ttl`, so if the job is late the page quietly goes direct for those feeds.
- **Open-Meteo:** the weather grid counts as 408 calls per fetch, so it refreshes every ~2 hours (~5k calls/day), plus ~2k/day for the other Open-Meteo feeds. Free tier is non-commercial; a paid plan is needed if the site is monetized.
- **Scheduled workflows pause after 60 days without repo activity** (public repos). Any commit re-arms it; the page simply goes direct meanwhile.
- **Bandwidth:** Pages has a soft 100 GB/month limit. `live.json` is ~50–80 KB gzipped, fetched ~6×/hour per active listener. If the site goes truly viral, put Cloudflare (free) in front of earthmidi.com.
- **Health check:** https://earthmidi.com/data/status.json shows each feed's last fetch time and any error.

## Reusing this on other sites

The pattern is portable to any static site that reads public APIs:

1. Put every upstream URL in one plain-data file both the page and a Node script can load.
2. A scheduled Actions workflow fetches them, trims, keeps last-good on failure, and deploys with `actions/deploy-pages`.
3. In the page, wrap fetch: snapshot first → direct if stale → last-good with a visible "delayed" note.

Copy `scripts/snapshot.mjs` and the workflow, swap in the new feed list and trim rules. Deploying from Actions also means merges always publish, even when the merge is made by an app.
