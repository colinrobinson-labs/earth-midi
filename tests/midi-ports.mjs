// MIDI port checks with a stand-in MIDI device. Run from the repo root with the built site served at SITE (default http://localhost:8765/).
// Fails if: picking a port doesn't send, unplugging it leaves the menu showing a port that is gone, or plugging it back in
// doesn't pick it up again on its own.
import { chromium } from "playwright";
const SITE = (process.env.SITE || "http://localhost:8765/").replace(/\/?$/, "/");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) });
const fails = [];
const check = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) fails.push(name); };
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", e => check("no script error: " + e.message, false));
await page.route(/gc\.zgo\.at|goatcounter/, r => r.abort());
// a fake MIDI device the test can plug and unplug, already allowed so Play connects to it quietly
await page.addInitScript(() => {
  const port = { id: "p1", name: "Test synth", state: "connected", sent: 0, send() { port.sent++; } };
  const input = { id: "i1", name: "Test knobs", state: "connected", onmidimessage: null };
  const access = { outputs: new Map([["p1", port]]), inputs: new Map([["i1", input]]), onstatechange: null };
  window.__midi = { port, cc(n, v) { input.onmidimessage && input.onmidimessage({ data: new Uint8Array([0xb0, n, v]) }); }, plug(on) { port.state = on ? "connected" : "disconnected"; access.onstatechange && access.onstatechange({ port }); } };
  Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: () => Promise.resolve(access) });
  const q = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = d => (d && d.name === "midi" ? Promise.resolve({ state: "granted" }) : q(d));
});
await page.goto(SITE, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.locator('#wlc[open] [data-c="pulse"]').click();
await page.waitForTimeout(1500);
const state = () => page.evaluate(() => ({ menu: document.getElementById("midiOut").value, line: document.getElementById("midiState").textContent, sent: window.__midi.port.sent }));

await page.selectOption("#midiOut", "p1");
await page.waitForTimeout(1500);
let s = await state();
check("picking the port sends MIDI to it", s.menu === "p1" && s.sent > 0);

await page.evaluate(() => window.__midi.plug(false));
await page.waitForTimeout(200);
const at = (await state()).sent;
await page.waitForTimeout(1200);
s = await state();
check("unplugged: the menu goes back to Off", s.menu === "");
check("unplugged: the status line says so", /unplugged/i.test(s.line));
check("unplugged: nothing more is sent to it", s.sent === at);

await page.evaluate(() => window.__midi.plug(true));
await page.waitForTimeout(1500);
s = await state();
check("plugged back in: picked again and sending", s.menu === "p1" && s.sent > at && /sending/i.test(s.line));

await page.selectOption("#midiOut", "");
await page.evaluate(() => window.__midi.plug(true));
await page.waitForTimeout(300);
check("after choosing Off, a replug doesn't pick the port again", (await state()).menu === "");

// MIDI learn: a new knob for a slider replaces its old knob, and a mapping can be removed from the list
const learn = await page.evaluate(() => {
  LEARN.map = {};
  LEARN.on = true;
  LEARN.armed = "duck";
  window.__midi.cc(20, 64);
  LEARN.armed = "duck";
  window.__midi.cc(21, 64);
  return JSON.stringify(LEARN.map);
});
check("learning a second knob for the same slider replaces the first", learn === '{"21":"duck"}');
await page.evaluate(() => {
  document.getElementById("pro").hidden = false;
  TAB = TABS.findIndex((t) => t[0] === "Presets");
  buildPro();
});
await page.click('[data-uncc="21"]');
check("tapping a mapping in the list removes it", await page.evaluate(() => !Object.keys(LEARN.map).length && !document.querySelector("[data-uncc]") && localStorage.getItem("em5.learn") === "{}"));

await browser.close();
if (fails.length) { console.log(`\n${fails.length} MIDI port check(s) failed`); process.exit(1); }
console.log("\nAll MIDI port checks passed");
