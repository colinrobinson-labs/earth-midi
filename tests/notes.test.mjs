// "Same reading, same note": known readings in, expected notes out, checked against the site's real rules
// (js/core.js + js/audio.js at default Producer settings). The table lives in tests/fixtures/note-table.json and
// the Apple apps check the same file (apps/apple/Tests), so the web and native engines can't drift apart.
// Changing a rule on purpose means changing the table in the same commit.   node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadEngine } from "./helpers/engine.mjs";

const T = JSON.parse(readFileSync(new URL("./fixtures/note-table.json", import.meta.url), "utf8"));
const E = loadEngine();
E.run("setRoot()");
// results come back as JSON so they are plain values on this side of the sandbox
const call = (fn, ...args) => JSON.parse(E.run(`JSON.stringify((${fn})(...${JSON.stringify(args)}))`));
const near = (got, want, what) => assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)), `${what}: got ${got}, want ${want}`);

test("defaults the table assumes: D3 root, A = 440, depth sets pitch, linear velocity 20-127", () => {
  assert.deepEqual(call("()=>[ROOT,+CFG.tune,CFG.scale,CFG.qpitch,CFG.qpan,CFG.vcurve,CFG.velMin,CFG.velMax,CFG.qoct,CFG.coct]"), [50, 440, "auto", "depth", "lon", "linear", 20, 127, 0, 0]);
});

test("Kp picks the scale", () => {
  for (const c of T.scale) {
    assert.deepEqual(call("scaleFor", c.kp), c.steps, `Kp ${c.kp}`);
    assert.equal(call("kpScaleName", c.kp), c.name, `Kp ${c.kp}`);
  }
});

test("scale step to MIDI note, below and above the first octave", () => {
  for (const c of T.degree) assert.equal(call("(n,i)=>degree(SCALES[n],i)", c.scale.toLowerCase(), c.i), c.note, `${c.scale} step ${c.i}`);
});

test("note number to frequency and name", () => {
  for (const c of T.mtof) near(call("mtof", c.m), c.hz, `note ${c.m}`);
  for (const c of T.noteName) assert.equal(call("noteName", c.n), c.name);
});

test("earthquake: depth and Kp at the time of the quake give the note", () => {
  for (const c of T.quake) {
    const r = call("(depth,kp)=>{S.kp=[{t:0,v:kp}];const r=quakeNote({depth,time:1,lat:0,lon:0,mag:3});return {note:r.note,step:r.step,steps:r.steps}}", c.depth, c.kp);
    assert.deepEqual(r, { note: c.note, step: c.step, steps: c.steps }, `${c.depth} km at Kp ${c.kp}`);
  }
});

test("earthquake: magnitude gives velocity, longitude gives pan", () => {
  for (const c of T.velocity) assert.equal(call("velOf", c.mag), c.vel, `M${c.mag}`);
  for (const c of T.pan) near(call("lon=>quakePan({lon,lat:0})", c.lon), c.pan, `lon ${c.lon}`);
});

test("planet chord: city temperature gives the note", () => {
  // the same expression js/audio.js uses for each city voice
  for (const c of T.chord) assert.equal(call("(T,kp)=>{const sc=scaleFor(kp);return degree(sc,Math.round(map(T,-30,45,0,sc.length*3-1)),ROOT+12*CFG.coct)}", c.tempC, c.kp), c.note, `${c.tempC} °C at Kp ${c.kp}`);
});

test("X-ray flux to flare class", () => {
  for (const c of T.flare) assert.equal(call("flareClass", c.flux), c.cls, `flux ${c.flux}`);
  assert.equal(call("()=>flareClass(NaN)"), "–");
});

test("moon phase", () => {
  for (const c of T.moon) near(call("t=>moon(t).illum", c.ms), c.illum, c.iso);
});

test("readings between samples: straight line, held at both ends", () => {
  for (const c of T.interp.cases) near(call("(s,t)=>at(s.t,s.v,t)", T.interp, c.at), c.value, `t=${c.at}`);
  assert.equal(call("()=>Number.isNaN(at([],[],5))"), true, "no data is NaN, never a made-up number");
});

test("Kp at a moment: the latest reading at or before it", () => {
  for (const c of T.kpAt.cases) assert.equal(call("(k,t)=>{S.kp=k.t.map((t,i)=>({t,v:k.v[i]}));return kpAt(t)}", T.kpAt, c.at), c.kp, `t=${c.at}`);
  assert.equal(call("()=>{S.kp=[];return kpAt(0)}"), 2, "no Kp yet = quiet sky");
});

test("tide level across the day's range, -1 to 1", () => {
  for (const c of T.tide.cases) near(call("(o,t)=>tideNorm(o,t)", T.tide, c.at), c.norm, `t=${c.at}`);
});

test("the same reading always gives the same note", () => {
  const once = () => JSON.stringify(T.quake.map(c => call("(depth,kp)=>{S.kp=[{t:0,v:kp}];return [quakeNote({depth,time:1,lat:0,lon:0,mag:3}).note,velOf(depth/100)]}", c.depth, c.kp)));
  const first = once();
  for (let i = 0; i < 5; i++) assert.equal(once(), first);
});
