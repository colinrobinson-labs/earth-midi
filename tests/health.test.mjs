// Offline checks for the data health report (scripts/health.mjs), which decides when the "Live data stopped
// updating" issue opens and closes. A tiny local server stands in for earthmidi.com/data/status.json.
//   node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/health.mjs", import.meta.url));
const MIN = 6e4;
const MAIN = ["quakes", "rtswWind", "rtswMag", "kp", "xray", "ocean", "temps", "wx0"];

/** Runs the report against a status file (or an HTTP error code) and returns what it printed. */
async function health(status, failFirst = 0) {
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    if (typeof status === "number" || hits <= failFirst) { res.writeHead(typeof status === "number" ? status : 502); res.end("nope"); return; }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(status));
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try {
    return await new Promise((resolve, reject) => execFile(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, HEALTH_RETRY_MS: "10", HEALTH_URL: `http://127.0.0.1:${server.address().port}/status.json` } },
      (err, stdout, stderr) => err ? reject(new Error(`exit ${err.code}: ${stderr}`)) : resolve(stdout)));
  } finally { server.close(); }
}
const good = (over = {}) => {
  const at = Date.now() - 4 * MIN;
  return { v: 1, at, weather: { source: "open-meteo", requested: "open-meteo" }, feeds: { ...Object.fromEntries(MAIN.map(id => [id, { ok: true, at, ms: 120 }])), ...over } };
};

test("all well: prints nothing, so no issue is opened", async () => {
  assert.equal(await health(good()), "");
});

test("a snapshot more than an hour old is reported, with its age on the first line", async () => {
  const s = good(); s.at = Date.now() - 95 * MIN;
  const out = await health(s);
  assert.match(out.split("\n")[0], /^The snapshot is 95 minutes old/);
  assert.match(out, /closes itself when data is back/);
});

test("a main feed that just failed is given time before anyone is alerted", async () => {
  assert.equal(await health(good({ quakes: { ok: false, at: Date.now() - 20 * MIN, err: "HTTP 503", kept: "last good copy" } })), "");
  assert.equal(await health(good({ ocean: { ok: false, at: Date.now() - 100 * MIN, err: "HTTP 503", kept: "last good copy" } })), "", "slow feeds get two hours");
  assert.equal(await health(good({ wx0: { ok: false, at: Date.now() - 5 * 60 * MIN, err: "timeout", kept: "last good copy" } })), "", "the weather grid gets six");
});

test("a main feed that keeps failing is named, with the error and how old its last reading is", async () => {
  const out = await health(good({
    quakes: { ok: false, at: Date.now() - 45 * MIN, err: "HTTP 503", kept: "last good copy" },
    ocean: { ok: false, at: Date.now() - 130 * MIN, err: "expected 10 points, got 9", kept: "last good copy" },
    wx0: { ok: false, at: Date.now() - 7 * 60 * MIN, err: "timeout", kept: "last good copy" },
  }));
  assert.match(out.split("\n")[0], /^Earthquakes \(USGS\): failing \(HTTP 503\), last good reading 45 minutes ago\.$/);
  assert.match(out, /- Ocean swell \(Open-Meteo\): failing \(expected 10 points, got 9\), last good reading 130 minutes ago\./);
  assert.match(out, /- Weather grid \(Open-Meteo\): failing \(timeout\), last good reading 420 minutes ago\./);
});

test("a main feed with no reading at all, or missing from the file, is reported at once", async () => {
  const s = good({ kp: { ok: false, err: "empty" } }); delete s.feeds.xray;
  const out = await health(s);
  assert.match(out, /Kp index \(NOAA\): failing \(empty\), no reading at all\./);
  assert.match(out, /X-rays \(NOAA\): missing from the snapshot\./);
});

test("feeds outside the main list never raise the alarm", async () => {
  assert.equal(await health(good({ issFix: { ok: false, err: "HTTP 500" }, events: { ok: false, at: Date.now() - 9 * 60 * MIN, err: "timeout", kept: "last good copy" } })), "");
});

test("weather switch: missing secrets are reported, and weather feeds name their source", async () => {
  const s = good({ temps: { ok: false, at: Date.now() - 3 * 60 * MIN, err: "WeatherKit refused the key (401)", kept: "last good copy", src: "weatherkit" } });
  assert.match(await health(s), /^City temperatures \(Apple WeatherKit\): failing/);
  const m = good(); m.weather = { source: "open-meteo", requested: "weatherkit", missing: ["WEATHERKIT_KEY", "WEATHERKIT_KEY_ID"] };
  assert.match(await health(m), /^Weather switch is set to WeatherKit but these secrets are missing: WEATHERKIT_KEY, WEATHERKIT_KEY_ID\. Still on Open-Meteo\./);
});

test("a status file that can't be read says so and still exits cleanly", async () => {
  assert.match(await health(404), /^Couldn't read the data status file \(HTTP 404\)\./);
});

test("one or two dropped requests are retried instead of raising a false alarm", async () => {
  assert.equal(await health(good(), 2), "");
  assert.match(await health(good(), 3), /^Couldn't read the data status file \(HTTP 502\)\./);
});

test("a status file with no feed list reports every main feed instead of crashing", async () => {
  const out = await health({ v: 1, at: Date.now() });
  for (const name of ["Earthquakes (USGS)", "Weather grid"]) assert.ok(out.includes(`${name}: missing from the snapshot.`), name);
});
