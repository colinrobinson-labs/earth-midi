// Offline checks for the live-data snapshot job (scripts/snapshot.mjs): what it trims, what it keeps when a source
// fails, and what it reports in status.json. No network: every source is answered from tests/helpers/fake-feeds.mjs.
//   node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fakeFeeds, FEEDS } from "./helpers/fake-feeds.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/snapshot.mjs", import.meta.url));
const SAMPLE = new URL("./fixtures/live-sample.json", import.meta.url);
const url = id => FEEDS.find(f => f.id === id).url;
const MIN = 6e4, HR = 36e5;

/** One run of the job. `feeds`: what the sources answer. `prev`: the snapshot already published ({live, wx} feed maps). */
function snapshot({ feeds = fakeFeeds(), prev, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "em-snap-")), out = join(dir, "out"), prevDir = join(dir, "prev");
  writeFileSync(join(dir, "fake.json"), JSON.stringify(feeds));
  mkdirSync(prevDir);
  for (const [name, f] of Object.entries(prev || {})) writeFileSync(join(prevDir, name + ".json"), JSON.stringify({ v: 1, at: 0, feeds: f }));
  const r = spawnSync(process.execPath, [SCRIPT, out], { encoding: "utf8", env: { PATH: process.env.PATH, SNAPSHOT_FAKE: join(dir, "fake.json"), SNAPSHOT_PREV_DIR: prevDir, ...env } });
  const read = n => JSON.parse(readFileSync(join(out, "data", n + ".json"), "utf8"));
  return { code: r.status, log: r.stdout + r.stderr, out, live: read("live"), wx: read("wx"), status: read("status") };
}
const data = (file, id) => file.feeds[url(id)].data;

test("a clean run publishes every feed and reports all of them current", () => {
  const before = Date.now(), s = snapshot();
  assert.equal(s.code, 0, s.log);
  assert.deepEqual(Object.keys(s.status.feeds).sort(), FEEDS.map(f => f.id).sort());
  for (const [id, st] of Object.entries(s.status.feeds)) assert.equal(st.ok, true, `${id}: ${st.err}`);
  assert.equal(Object.keys(s.live.feeds).length, FEEDS.filter(f => !f.file).length);
  assert.deepEqual(Object.keys(s.wx.feeds), [url("wx0"), url("wx1")]);
  for (const file of [s.live, s.wx, s.status]) { assert.equal(file.v, 1); assert.ok(file.at >= before && file.at <= Date.now()); }
  assert.equal(s.live.wsrc, "open-meteo");
  assert.deepEqual(s.status.weather, { source: "open-meteo", requested: "open-meteo" });
  for (const f of FEEDS) { const e = (f.file ? s.wx : s.live).feeds[f.url]; assert.equal(e.at, s.live.at); assert.equal(e.ttl, f.ttl, f.id); assert.equal(e.src, undefined); }
  assert.match(s.log, new RegExp(`${FEEDS.length}/${FEEDS.length} feeds current`));
});

test("trimming drops unused fields and stale rows but never changes a reading", () => {
  const src = fakeFeeds(), s = snapshot({ feeds: src });
  const q = data(s.live, "quakes");
  assert.deepEqual(Object.keys(q), ["type", "metadata", "features"]);
  assert.deepEqual(Object.keys(q.metadata), ["generated", "count"]);
  assert.equal(q.features.length, 3);
  assert.deepEqual(Object.keys(q.features[0]), ["id", "properties", "geometry"]);
  assert.deepEqual(Object.keys(q.features[0].properties), ["mag", "place", "time", "url", "tsunami", "felt"]);
  q.features.forEach((f, i) => { const o = src[url("quakes")].features[i]; assert.equal(f.properties.mag, o.properties.mag); assert.deepEqual(f.geometry, { coordinates: o.geometry.coordinates }); });

  const wind = data(s.live, "rtswWind"), mag = data(s.live, "rtswMag");
  assert.equal(wind.length, 14, "standby spacecraft and day-old rows dropped");
  assert.deepEqual(Object.keys(wind[0]), ["time_tag", "active", "proton_speed", "proton_density"]);
  assert.deepEqual(wind.map(r => r.proton_speed), [...Array(14)].map((_, i) => 400 + i * 5));
  assert.equal(wind[3].proton_density, null, "a gap stays a gap");
  assert.equal(mag.length, 14);
  assert.deepEqual(Object.keys(mag[0]), ["time_tag", "active", "bz_gsm", "bt"]);

  assert.deepEqual(data(s.live, "kp"), src[url("kp")], "Kp is passed through whole");
  assert.deepEqual(data(s.live, "dst").map(r => r[1]), ["dst", "-10", "-14", "-18"], "rows older than 50 h dropped, header kept");
  for (const [id, energy] of [["xray", "0.1-0.8nm"], ["protons", ">=10 MeV"]]) {
    const rows = data(s.live, id);
    assert.equal(rows.length, 12, id);
    assert.ok(rows.every(r => r.energy === energy), id);
    assert.deepEqual(Object.keys(rows[0]), ["time_tag", "energy", "flux"]);
  }
  assert.deepEqual(data(s.live, "xray").map(r => r.flux), src[url("xray")].filter(r => r.energy === "0.1-0.8nm").map(r => r.flux));

  const ocean = data(s.live, "ocean");
  assert.equal(ocean.length, 10);
  assert.deepEqual(Object.keys(ocean[0]), ["latitude", "longitude", "current", "hourly"]);
  assert.deepEqual(ocean[4].hourly, src[url("ocean")][4].hourly, "small feeds are not rounded");
  for (const [id, n] of [["jet", 6], ["temps", 10], ["air", 10]]) assert.equal(data(s.live, id).length, n, id);

  for (const f of FEEDS.filter(f => f.id.startsWith("tide"))) {
    const t = s.live.feeds[f.url].data;
    assert.deepEqual(Object.keys(t), ["data"]);
    assert.equal(t.data.length, 10, "blank reading dropped");
    assert.deepEqual(Object.keys(t.data[0]), ["t", "v"]);
  }
  const ev = data(s.live, "events").events;
  assert.deepEqual(ev.map(e => e.id), ["EONET_1", "EONET_2"]);
  assert.deepEqual(ev[0].categories, [{ id: "wildfires" }]);
  assert.deepEqual(ev[0].sources, [{ url: "https://example.org/fire" }]);
  assert.deepEqual(ev[0].geometry.map(g => g.magnitudeValue), [100, 300], "first and latest position only");
  assert.deepEqual(Object.keys(ev[0].geometry[0]).sort(), ["coordinates", "date", "magnitudeUnit", "magnitudeValue"]);
  assert.equal(ev[1].geometry.length, 1);

  assert.deepEqual(Object.keys(data(s.live, "issTle")), ["line1", "line2"]);
  assert.match(data(s.live, "issTleCt"), /^ISS \(ZARYA\)\s+\n1 25544.*\n2 25544.*0$/s);
  assert.deepEqual(Object.keys(data(s.live, "issFix")), ["latitude", "longitude", "altitude", "velocity", "timestamp"]);

  const wx = data(s.wx, "wx0"), raw = src[url("wx0")];
  assert.equal(wx.length, 204);
  assert.equal(data(s.wx, "wx1").length, 204);
  assert.deepEqual(wx[7].hourly.time, raw[7].hourly.time);
  assert.deepEqual(wx[7].hourly.temperature_2m, raw[7].hourly.temperature_2m.map(n => Math.round(n * 10) / 10), "weather grid rounded to 0.1");
});

test("a source that fails keeps its last good copy, with its original time", () => {
  const feeds = fakeFeeds(), old = Date.now() - 40 * MIN;
  feeds[url("quakes")] = { __status: 503 };
  delete feeds[url("kp")];
  const prev = { live: { [url("quakes")]: { at: old, ttl: 1, data: { marker: "last good quakes" } }, [url("kp")]: { at: old, ttl: 1, data: [["time_tag", "Kp"], ["2026-11-16 00:00:00.000", "3.00"]] } } };
  const s = snapshot({ feeds, prev });
  assert.equal(s.code, 0, "a failing source never fails the deploy");
  assert.deepEqual(s.live.feeds[url("quakes")], { at: old, ttl: FEEDS[0].ttl, data: { marker: "last good quakes" } });
  assert.deepEqual(s.status.feeds.quakes, { ok: false, at: old, err: "503", kept: "last good copy" });
  assert.equal(s.live.feeds[url("kp")].at, old);
  assert.equal(s.status.feeds.kp.kept, "last good copy");
  assert.equal(s.status.feeds.xray.ok, true, "other feeds are unaffected");
  assert.match(s.log, /stale or missing: .*quakes/);
});

test("a failing source with no copy, or one older than two days, is left out", () => {
  const feeds = fakeFeeds();
  delete feeds[url("quakes")]; delete feeds[url("xray")];
  const s = snapshot({ feeds, prev: { live: { [url("xray")]: { at: Date.now() - 49 * HR, ttl: 1, data: [] } } } });
  assert.equal(s.code, 0);
  for (const id of ["quakes", "xray"]) {
    assert.equal(url(id) in s.live.feeds, false, id);
    assert.equal(s.status.feeds[id].ok, false);
    assert.equal(s.status.feeds[id].at, undefined);
    assert.equal(s.status.feeds[id].kept, undefined);
  }
});

test("an answer that fails the sanity check is treated as a failure", () => {
  const bad = {
    quakes: { type: "FeatureCollection" },                                       // no features
    rtswWind: fakeFeeds()[url("rtswWind")].slice(0, 5),                          // too few rows
    ocean: fakeFeeds()[url("ocean")].slice(0, 9),                                // a point missing
    temps: fakeFeeds()[url("temps")].map(({ hourly, ...x }) => x),               // no hourly data
    issTle: { line1: "1 25544U" },
    issTleCt: "<html>rate limited</html>",
    issFix: { latitude: "n/a", timestamp: 1 },
    events: {},
    tide9410230: { error: { message: "No data was found" } },
  };
  const feeds = fakeFeeds();
  for (const [id, v] of Object.entries(bad)) feeds[url(id)] = v;
  const s = snapshot({ feeds });
  assert.equal(s.code, 0);
  for (const id of Object.keys(bad)) { assert.equal(s.status.feeds[id].ok, false, id); assert.ok(s.status.feeds[id].err, id); assert.equal(url(id) in s.live.feeds, false, id); }
  assert.equal(s.status.feeds.kp.ok, true);
});

test("a feed that isn't due yet is carried over without asking the source", () => {
  const recent = Date.now() - 2 * MIN, prevKp = { at: recent, ttl: 1, data: "carried over" };
  const feeds = fakeFeeds(); delete feeds[url("kp")];
  const s = snapshot({ feeds, prev: { live: { [url("kp")]: prevKp } } });
  assert.deepEqual(s.live.feeds[url("kp")], { ...prevKp, ttl: FEEDS.find(f => f.id === "kp").ttl });
  assert.deepEqual(s.status.feeds.kp, { ok: true, at: recent, kept: "not due" });
});

test("weather switch: WeatherKit copies are marked, and a copy from the other source is refetched at once", () => {
  const feeds = fakeFeeds(), recent = Date.now() - 2 * MIN;
  const wkAnswer = id => feeds[url(id)].map(x => ({ latitude: x.latitude, longitude: x.longitude, hourly: x.hourly }));
  for (const id of ["temps", "wx0", "wx1"]) feeds["wk:" + id] = wkAnswer(id);
  const prev = { live: { [url("temps")]: { at: recent, ttl: 1, data: "open-meteo copy" } } };
  const s = snapshot({ feeds, prev, env: { SNAPSHOT_WK_FAKE: "1" } });
  assert.equal(s.code, 0, s.log);
  assert.equal(s.live.wsrc, "weatherkit"); assert.equal(s.wx.wsrc, "weatherkit");
  assert.equal(s.live.wk.name, "Apple Weather"); assert.match(s.live.wk.legal, /^https:\/\//);
  for (const id of ["temps", "wx0", "wx1"]) assert.deepEqual(s.status.feeds[id].src, "weatherkit", id);
  assert.equal(s.live.feeds[url("temps")].src, "weatherkit");
  assert.equal(s.live.feeds[url("temps")].at, s.live.at, "not carried over from the Open-Meteo copy");
  assert.equal(s.live.feeds[url("ocean")].src, undefined, "ocean stays on Open-Meteo");
  assert.equal(s.status.weather.source, "weatherkit");

  // wrong number of points from WeatherKit = failure, not a half-filled chord
  feeds["wk:temps"] = wkAnswer("temps").slice(0, 4);
  const s2 = snapshot({ feeds, env: { SNAPSHOT_WK_FAKE: "1" } });
  assert.equal(s2.status.feeds.temps.ok, false);
  assert.match(s2.status.feeds.temps.err, /wrong point count/);
});

// The Apple apps decode this file in their own tests (apps/apple/Tests). It has to stay in the exact shape the job
// writes, so compare shapes here. Regenerate after changing the trimming:  UPDATE_SAMPLE=1 node --test tests/snapshot.test.mjs
test("tests/fixtures/live-sample.json is still shaped like a real snapshot", () => {
  const live = snapshot().live;
  if (process.env.UPDATE_SAMPLE) writeFileSync(SAMPLE, JSON.stringify(live) + "\n");
  assert.ok(existsSync(SAMPLE), "sample missing: run with UPDATE_SAMPLE=1");
  const shape = v => Array.isArray(v) ? [[...new Set(v.map(x => JSON.stringify(shape(x))))].sort().join("|")]
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, shape(v[k])])) : v === null ? "null" : typeof v;
  assert.deepEqual(shape(JSON.parse(readFileSync(SAMPLE, "utf8"))), shape(live));
});
