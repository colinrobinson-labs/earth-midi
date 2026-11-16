// Made-up but realistically shaped answers from every source in js/feeds.js, for offline tests.
// Each one carries the extra fields and stale rows the real sources send, so trimming has something to drop.
import { createRequire } from "node:module";
const { FEEDS } = createRequire(import.meta.url)("../../js/feeds.js");

const HR = 36e5;
const iso = (t, cut = 19) => new Date(t).toISOString().slice(0, cut);
const points = url => { const q = new URL(url).searchParams, la = q.get("latitude").split(","), lo = q.get("longitude").split(","); return la.map((a, i) => [+a, +lo[i]]); };

export function fakeFeeds(now = Date.now()) {
  const day0 = Math.floor(now / 864e5) * 864e5 - 864e5;            // Open-Meteo: yesterday 00:00 UTC, 48 hourly slots
  const hours = [...Array(48)].map((_, i) => iso(day0 + i * HR, 16));
  const openMeteo = (url, vars, cur) => points(url).map(([latitude, longitude], p) => ({
    latitude, longitude, generationtime_ms: 0.4, utc_offset_seconds: 0, timezone: "GMT", elevation: 0,
    ...(cur ? { current: Object.fromEntries([["time", iso(now, 16)], ...cur.map((k, n) => [k, +(1.5 + p * 0.25 + n * 3).toFixed(2)])]) } : {}),
    hourly_units: Object.fromEntries(vars.map(v => [v, "unit"])),
    hourly: Object.fromEntries([["time", hours], ...vars.map((v, n) => [v, hours.map((_, h) => +(p + n * 10 + h * 0.1234).toFixed(4))])]),
  }));
  const minutes = (n, row) => [...Array(n)].map((_, i) => row(now - (n - i) * 6e4, i));
  const out = {};
  for (const f of FEEDS) {
    const id = f.id;
    out[f.url] =
      id === "quakes" ? { type: "FeatureCollection", metadata: { generated: now, count: 3, api: "1.14.1", title: "USGS All Earthquakes, Past Day" }, bbox: [-180, -90, 0, 180, 90, 700],
        features: [
          { type: "Feature", id: "us7000aaaa", properties: { mag: 5.8, place: "112 km SE of Hachinohe, Japan", time: now - 3 * HR, updated: now, url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000aaaa", tsunami: 1, felt: 41, sig: 520, net: "us", type: "earthquake" }, geometry: { type: "Point", coordinates: [142.6, 39.8, 35.2] } },
          { type: "Feature", id: "ci40000001", properties: { mag: 1.2, place: "8 km N of Borrego Springs, CA", time: now - 20 * 6e4, url: "https://earthquake.usgs.gov/earthquakes/eventpage/ci40000001", tsunami: 0, felt: null, sig: 22 }, geometry: { type: "Point", coordinates: [-116.37, 33.33, -0.4] } },
          { type: "Feature", id: "ak0260000002", properties: { mag: null, place: "Central Alaska", time: now - 9 * HR, url: null, tsunami: 0, felt: null }, geometry: { type: "Point", coordinates: [-150.1, 63.2, 612] } },
        ] }
      : id === "rtswWind" ? [
        { time_tag: iso(now - 30 * HR), active: true, source: "ACE", proton_speed: 999, proton_density: 99 },            // older than 26 h
        { time_tag: iso(now - 20 * 6e4), active: false, source: "DSCOVR", proton_speed: 111, proton_density: 1 },        // the standby spacecraft
        ...minutes(14, (t, i) => ({ time_tag: iso(t), active: true, source: "ACE", range: 4, proton_speed: 400 + i * 5, proton_density: i === 3 ? null : 4 + i * 0.5, proton_temperature: 81234, overall_quality: 0 })),
      ]
      : id === "rtswMag" ? [
        { time_tag: iso(now - 30 * HR), active: true, bz_gsm: 50, bt: 50 },
        ...minutes(14, (t, i) => ({ time_tag: iso(t), active: true, source: "ACE", bx_gsm: 1.1, by_gsm: -2.2, bz_gsm: -3 + i * 0.5, bt: 6 + i * 0.1, lat_gsm: 4, lon_gsm: 120 })),
      ]
      : id === "kp" ? [["time_tag", "Kp", "a_running", "station_count"], ...[9, 6, 3, 0].map((h, i) => [iso(now - h * HR).replace("T", " ") + ".000", ["1.33", "2.67", "4.33", "5.00"][i], "7", "8"])]
      : id === "dst" ? [["time_tag", "dst"], [iso(now - 60 * HR).replace("T", " "), "-99"], ...[3, 2, 1].map((h, i) => [iso(now - h * HR).replace("T", " "), String(-10 - i * 4)])]
      : id === "xray" ? minutes(12, (t, i) => [
        { time_tag: iso(t) + "Z", satellite: 18, flux: 2e-8, observed_flux: 2.1e-8, electron_correction: 1e-9, electron_contaminaton: false, energy: "0.05-0.4nm" },
        { time_tag: iso(t) + "Z", satellite: 18, flux: 1e-6 * (1 + i), observed_flux: 1.1e-6, electron_correction: 1e-9, electron_contaminaton: false, energy: "0.1-0.8nm" }]).flat()
      : id === "protons" ? minutes(12, (t, i) => [
        { time_tag: iso(t) + "Z", satellite: 18, flux: 0.9, energy: ">=1 MeV" },
        { time_tag: iso(t) + "Z", satellite: 18, flux: 0.2 + i * 0.01, energy: ">=10 MeV" }]).flat()
      : id === "ocean" ? openMeteo(f.url, ["wave_height"], ["wave_height", "wave_period", "wave_direction"])
      : id === "jet" ? openMeteo(f.url, ["wind_speed_250hPa", "wind_direction_250hPa"])
      : id === "temps" ? openMeteo(f.url, ["temperature_2m"])
      : id === "air" ? openMeteo(f.url, ["pm2_5", "uv_index"])
      : id === "wx0" || id === "wx1" ? openMeteo(f.url, ["temperature_2m", "precipitation", "cloud_cover", "wind_speed_10m", "wind_direction_10m", "pressure_msl"])
      : id.startsWith("tide") ? { metadata: { id: id.slice(4), name: "station", lat: "0", lon: "0" },
        data: [...[...Array(10)].map((_, i) => ({ t: iso(Math.floor(now / 36e4) * 36e4 - (10 - i) * 36e4, 16).replace("T", " "), v: (0.5 + i * 0.1).toFixed(3), s: "0.012", f: "0,0,0,0", q: "p" })), { t: iso(now, 16).replace("T", " "), v: "", s: "", f: "1,0,0,0", q: "p" }] }
      : id === "events" ? { title: "EONET Events", description: "Natural events", link: "https://eonet.gsfc.nasa.gov/api/v3/events",
        events: [
          { id: "EONET_1", title: "Wildfire, Example County", description: null, link: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1", closed: null,
            categories: [{ id: "wildfires", title: "Wildfires" }, { id: "severeStorms", title: "Severe Storms" }], sources: [{ id: "IRWIN", url: "https://example.org/fire" }, { id: "X", url: "https://example.org/other" }],
            geometry: [1, 2, 3].map(d => ({ magnitudeValue: 100 * d, magnitudeUnit: "acres", date: iso(now - (4 - d) * 24 * HR) + "Z", type: "Point", coordinates: [-120 + d, 38 + d] })) },
          { id: "EONET_2", title: "Example Volcano", closed: null, categories: [{ id: "volcanoes", title: "Volcanoes" }], sources: [{ id: "SIVolcano", url: "https://example.org/volcano" }],
            geometry: [{ magnitudeValue: null, magnitudeUnit: null, date: iso(now - 24 * HR) + "Z", type: "Point", coordinates: [15, 37.7] }] },
        ] }
      : id === "issTle" ? { requested_timestamp: Math.round(now / 1e3), tle_timestamp: Math.round(now / 1e3) - 4000, id: "25544", name: "iss", header: "ISS (ZARYA)",
        line1: "1 25544U 98067A   26320.50000000  .00010000  00000+0  18000-3 0  9991", line2: "2 25544  51.6400 100.0000 0005000  90.0000 270.0000 15.50000000500000" }
      : id === "issTleCt" ? "ISS (ZARYA)             \r\n1 25544U 98067A   26320.50000000  .00010000  00000+0  18000-3 0  9991\r\n2 25544  51.6400 100.0000 0005000  90.0000 270.0000 15.50000000500000\r\n"
      : id === "issFix" ? { name: "iss", id: 25544, latitude: 12.34, longitude: -56.78, altitude: 421.5, velocity: 27570.2, visibility: "daylight", footprint: 4520.1, timestamp: Math.round(now / 1e3), daynum: 2461000.5, solar_lat: -18, solar_lon: 100, units: "kilometers" }
      : (() => { throw new Error("fake-feeds.mjs has no answer for the feed " + id); })();
  }
  return out;
}
export { FEEDS };
