// Hostile-input test: feeds the page junk settings through every door they can arrive by (share link, preset file,
// session file, saved browser storage) and fails if any of it ends up as markup, as a script, on Object.prototype,
// or as a setting outside what the controls allow. Also checks that real presets and genres pass through untouched.
// Run from the repo root with the site served at SITE (default http://localhost:8765/):  node tests/hostile.mjs
import { chromium } from "playwright";
const SITE = (process.env.SITE || "http://localhost:8765/").replace(/\/?$/, "/");
const IGNORE = /Failed to load resource|net::ERR_|status of 4\d\d|status of 5\d\d|goatcounter|MIDI|AudioContext was not allowed/i;

// One string that would show up as an element, an attribute break-out and a handler if it were ever written as HTML.
const BAD = `"'><b data-hostile=1>x</b><img data-hostile=1 src=x onerror="window.__ran=1"><script>window.__ran=1</script>`;
// Built as text so "__proto__" is a real key in the JSON, the way a hand-made file would carry it.
const junkCfg = `{
  "__proto__":{"polluted":1,"genre":"${"x"}"},"constructor":{"prototype":{"polluted":1}},
  "key":${JSON.stringify(BAD)},"oct":1e99,"scale":${JSON.stringify(BAD)},"tune":"440","prog":"constructor","chordEvery":-5,
  "region":"__proto__","revType":${JSON.stringify(BAD)},"dtime":${JSON.stringify(BAD)},"genre":"constructor","pattern":${JSON.stringify(BAD)},
  "tempoSrc":"toString","mapView":${JSON.stringify(BAD)},"viewMix":"hasOwnProperty","bpmMin":999,"bpmMax":-999,"bpmLock":[1],"swing":{"a":1},
  "quant":"yes","rev":null,"mlp":0,"extra":${JSON.stringify(BAD)},
  "vol":{"q":99,"s":${JSON.stringify(BAD)},"__proto__":{"polluted":1},"zz":1},"send":"nope","ch":{"q":0,"s":17.6,"m":${JSON.stringify(BAD)}},
  "inst":{"q":${JSON.stringify(BAD)},"s":"constructor"},"snd":{"xBell":${JSON.stringify(BAD)},"tLp":1e9,"new":1},
  "zones":{"q":{"shape":"circle","lat":999,"lon":${JSON.stringify(BAD)},"r":-1,"move":{"type":${JSON.stringify(BAD)},"bars":7}},
           "o":{"shape":"region","id":"__proto__"},"w":{"shape":${JSON.stringify(BAD)}},"__proto__":{"polluted":1},"r":{"shape":"band","a":0,"b":1}}
}`;
const row = extra => ({ lat: 10, lon: 20, name: BAD, ...extra });
const series = () => ({ t: [Date.now() - 36e5, Date.now()], v: [1, 2] });
const junkSession = `{"app":"Earth MIDI","endT":${Date.now()},"style":${JSON.stringify(BAD)},"cfg":${junkCfg},"data":{
  "__proto__":{"polluted":1},"on":true,"style":${JSON.stringify(BAD)},"played":"x","notes":${JSON.stringify(BAD)},
  "quakes":[${JSON.stringify({ id: BAD, mag: 5.1, depth: 10, time: Date.now() - 6e4, lat: 1, lon: 2, place: BAD, extra: { deep: BAD } })},{"mag":"big"},7,null],
  "events":[${JSON.stringify(row({ id: "e1", title: BAD, kind: BAD, col: BAD, cat: BAD, start: Date.now() - 864e5, last: Date.now(), mag: BAD, magU: BAD }))}],
  "ocean":[${JSON.stringify(row({ h: 2, p: 9, dir: 0, ht: [], hist: [] }))}],
  "jet":[${JSON.stringify(row({ ...series(), d: [1, 2] }))}],"temps":[${JSON.stringify(row(series()))}],
  "air":[${JSON.stringify(row({ t: series().t, pm: [1, 2], uv: [1, 2] }))}],"tides":[${JSON.stringify(row(series()))}],
  "kp":[{"t":${Date.now()},"v":2}],"dst":"x","protons":{},"xray":[[1,2]],
  "sun":{"speed":[400,${JSON.stringify(BAD)}],"t":[${Date.now()}],"__proto__":{"polluted":1}},"iss":{"epoch":${JSON.stringify(BAD)}},"demo":{"q":${JSON.stringify(BAD)}}}}`;
const b64 = s => Buffer.from(s, "utf8").toString("base64");

const failures = [];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

// Everything the page must still be after swallowing junk. Runs inside the page.
const verdict = () => {
  const out = [];
  if (window.__ran) out.push("injected script ran");
  if (document.querySelector("[data-hostile]")) out.push("injected markup reached the page: " + document.querySelector("[data-hostile]").parentElement.outerHTML.slice(0, 160));
  if ({}.polluted !== undefined || Object.prototype.genre !== undefined) out.push("Object.prototype was polluted");
  if (Object.getPrototypeOf(S) !== Object.prototype || Object.getPrototypeOf(CFG) !== Object.prototype) out.push("state prototype was swapped");
  const shape = (a, d, path) => {
    for (const k of Object.keys(a)) {
      if (path === "zones") { if (!PAN_KEYS.includes(k) || k === "r") out.push(`unknown zone ${k}`); continue; }
      if (!Object.prototype.hasOwnProperty.call(d, k)) { out.push(`unknown setting ${path}${k}`); continue; }
      if (typeof a[k] !== typeof d[k]) out.push(`${path}${k} is ${typeof a[k]}, should be ${typeof d[k]}`);
      else if (typeof a[k] === "number" && !Number.isFinite(a[k])) out.push(`${path}${k} is not a number`);
      else if (typeof a[k] === "string" && /[<>"'&]/.test(a[k])) out.push(`${path}${k} holds markup`);
      else if (a[k] && typeof a[k] === "object") shape(a[k], d[k], k === "zones" ? "zones" : k + ".");
    }
  };
  shape(CFG, DEF, "");
  if (JSON.stringify(mergeCFG(CFG)) !== JSON.stringify(CFG)) out.push("settings are not stable under a second check");
  if (S.style !== "ambient" && S.style !== "pulse") out.push("style is " + String(S.style).slice(0, 40));
  return out;
};
// Draw every screen that prints settings or readings: each Producer tab, the Console, the map tooltips, the event log.
const exercise = async page => {
  await page.evaluate(() => {
    TABS.forEach((_, i) => { TAB = i; buildPro(); });
    buildCards(); afterCFG();
    const tip = document.createElement("div"); document.body.appendChild(tip);
    for (const [type, list] of [["q", S.quakes], ["o", S.ocean], ["e", S.events], ["c", S.temps], ["t", S.tides]])
      list.slice(0, 3).forEach((o, i) => { try { tip.innerHTML += tipHTML({ type, o, i }); } catch (_) {} });
    location.hash = "#console";
  });
  await page.waitForTimeout(600);
  const go = page.locator(".go:visible").first();
  if (await go.count()) await go.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2500);
};

async function run(name, { hash = "", storage = null, file = null, check = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("script error: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !IGNORE.test(m.text())) errs.push("console: " + m.text()); });
  page.on("dialog", d => { errs.push("a dialog opened: " + d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
  await page.route(/gc\.zgo\.at|goatcounter/, r => r.abort());
  try {
    if (storage) await page.addInitScript(s => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (_) {} }, storage);
    await page.goto(SITE + hash, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(1500);
    // first visit shows the welcome card: enter without sound
    const wl = page.locator('#wlc[open] .wlc-o[data-c="silent"]');
    if (await wl.count()) await wl.click();
    if (file) await page.evaluate(async txt => { await loadFile(new File([txt], "x.earthmidi.json", { type: "application/json" })); }, file);
    await exercise(page);
    errs.push(...await page.evaluate(verdict));
    if (check) errs.push(...await page.evaluate(check, file));
  } catch (e) { errs.push("could not run: " + e.message); }
  console.log(`${errs.length ? "FAIL" : "ok  "} ${name}`);
  [...new Set(errs)].slice(0, 12).forEach(e => console.log("     " + e));
  if (errs.length) failures.push(name);
  await ctx.close();
}

await run("share link with junk settings", { hash: "#s=" + b64(`{"cfg":${junkCfg},"style":${JSON.stringify(BAD)},"mode":${JSON.stringify(BAD)}}`) });
await run("share link that is not an object", { hash: "#s=" + b64(`[1,2,3]`) });
await run("share link with junk instead of settings", { hash: "#s=" + b64(`{"cfg":${JSON.stringify(BAD)},"style":{"a":1},"mode":{"a":1}}`) });
await run("preset file with junk settings", { file: `{"app":"Earth MIDI","preset":true,"name":${JSON.stringify(BAD)},"style":${JSON.stringify(BAD)},"cfg":${junkCfg}}` });
await run("session file with junk readings", {
  file: junkSession,
  // the live feeds keep refreshing behind a loaded session, so the row checks read the cleaner's own answer
  check: file => {
    const out = [], d = fitSession(JSON.parse(file).data);
    if (!(S.played instanceof Set) || !Array.isArray(S.notes)) out.push("session data overwrote app state it should not hold");
    if (Object.keys(d).some(k => !["quakes", "kp", "dst", "protons", "xray", "ocean", "jet", "temps", "air", "tides", "events", "sun", "iss", "demo"].includes(k))) out.push("session data carries fields a session should not hold");
    if (d.quakes.length !== 1 || d.events.length !== 1) out.push(`kept ${d.quakes.length} quakes and ${d.events.length} events, expected 1 and 1`);
    if (!Array.isArray(d.dst) || !Array.isArray(d.protons) || d.xray.length) out.push("malformed lists were not dropped");
    if (d.iss !== null) out.push("malformed station orbit was kept");
    if (d.demo.q !== false) out.push("demo flags are not plain true or false");
    return out;
  },
});
await run("saved browser settings and presets with junk", {
  storage: { "em5.cfg": junkCfg, "em5.presets": `{${JSON.stringify(BAD)}:{"cfg":${junkCfg},"style":${JSON.stringify(BAD)}},"__proto__":{"cfg":{}},"n":7}`, "em5.learn": `{${JSON.stringify(BAD)}:${JSON.stringify(BAD)}}` },
});
await run("real settings pass through unchanged", {
  check: () => {
    const out = [], same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!same(mergeCFG(DEF), DEF)) out.push("the defaults do not survive the settings check");
    for (const n of Object.keys(PRESETS)) { applyPreset(PRESETS[n], n); if (!same(mergeCFG(CFG), CFG)) out.push(`factory preset "${n}" is changed by the settings check`); }
    for (const id of Object.keys(GENRE_BY)) { applyGenre(id); if (!same(mergeCFG(CFG), CFG)) out.push(`genre "${id}" is changed by the settings check`); }
    // a link made by the page itself must open with the same settings
    CFG.zones = { q: { shape: "circle", lat: 35.2, lon: 139.5, r: 2000, move: { type: "drift", bars: 8 } }, o: { shape: "band", a: -20, b: 20 }, e: { shape: "region", id: "ring" } }; CFG.zonesOn = true;
    const before = JSON.stringify(CFG), j = JSON.parse(decodeURIComponent(escape(atob(shareURL().split("#s=")[1]))));
    if (JSON.stringify(mergeCFG(j.cfg)) !== before) out.push("a share link made by the page does not round-trip");
    return out;
  },
});
// The page's own policy must refuse a script that is written into it.
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.route(/gc\.zgo\.at|goatcounter/, r => r.abort());
  await page.goto(SITE, { waitUntil: "load" });
  const ran = await page.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.__inline=1"; document.head.appendChild(s);
    const d = document.createElement("div"); d.innerHTML = `<img src="data:image/gif;base64,AAAA" onerror="window.__inline=1">`; document.body.appendChild(d);
    return new Promise(r => setTimeout(() => r(!!window.__inline), 500)); });
  console.log(`${ran ? "FAIL" : "ok  "} page policy blocks inline script`);
  if (ran) failures.push("inline script policy");
  await ctx.close();
}
await browser.close();
if (failures.length) { console.log(`\n${failures.length} hostile-input check(s) failed`); process.exit(1); }
console.log("\nAll hostile-input checks passed");
