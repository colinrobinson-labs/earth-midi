// Checks the published live-data snapshot. Prints a short report and exits quietly when all is well,
// or prints what's wrong (first line = summary) when the snapshot is old or a main feed keeps failing.
// Used by .github/workflows/keeper.yml to open and close the "Live data stopped updating" issue.
const URL_ = process.env.HEALTH_URL || "https://earthmidi.com/data/status.json";
const MAIN = { quakes: "Earthquakes (USGS)", rtswWind: "Solar wind speed (NOAA)", rtswMag: "Solar wind field (NOAA)", kp: "Kp index (NOAA)", xray: "X-rays (NOAA)", ocean: "Ocean swell (Open-Meteo)", temps: "City temperatures", wx0: "Weather grid" };
const SRC = { weatherkit: "Apple WeatherKit", "open-meteo": "Open-Meteo" };
const now = Date.now(), min = ms => Math.round(ms / 6e4);
let s;
try {
  const r = await fetch(URL_ + "?t=" + now, { headers: { "user-agent": "earthmidi.com health check" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  s = await r.json();
} catch (e) {
  console.log(`Couldn't read the data status file (${e.message}).\n\n${URL_}`);
  process.exit(0);
}
const problems = [];
if (now - s.at > 60 * 6e4) problems.push(`The snapshot is ${min(now - s.at)} minutes old (it should refresh every 10).`);
if (s.weather?.missing) problems.push(`Weather switch is set to WeatherKit but these secrets are missing: ${s.weather.missing.join(", ")}. Still on Open-Meteo.`);
for (let [id, name] of Object.entries(MAIN)) {
  const f = s.feeds?.[id];
  if (!f) { problems.push(`${name}: missing from the snapshot.`); continue; }
  if (id === "temps" || id === "wx0") name += ` (${SRC[f.src || "open-meteo"]})`;
  // a failing feed keeps its last good copy; alert once that copy is more than three refreshes behind
  const limit = id.startsWith("wx") ? 6 * 60 : id === "ocean" || id === "temps" ? 120 : 30;
  if (!f.ok && f.at && now - f.at > limit * 6e4) problems.push(`${name}: failing (${f.err || "error"}), last good reading ${min(now - f.at)} minutes ago.`);
  else if (!f.ok && !f.at) problems.push(`${name}: failing (${f.err || "error"}), no reading at all.`);
}
if (problems.length) {
  console.log(`${problems[0]}\n\nEverything found:\n${problems.map(p => "- " + p).join("\n")}\n\nThe site keeps playing: visitors' browsers fall back to calling the sources directly.\nStatus file: https://earthmidi.com/data/status.json\nThis issue closes itself when data is back.`);
}
