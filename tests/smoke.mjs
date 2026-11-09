// Site smoke test: opens every page on a phone and a desktop, presses Play, and fails on any script error
// or on a serious accessibility problem. Run from the repo root with the site served at SITE (default http://localhost:8765/).
//   npm i --no-save playwright axe-core && node tests/smoke.mjs
import { chromium, devices } from "playwright";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const SITE = (process.env.SITE || "http://localhost:8765/").replace(/\/?$/, "/");
const PAGES = ["", "support.html", "press.html", "whats-new.html", "privacy.html", "404.html", "#simple", "#embed"];
const VIEWS = { phone: devices["iPhone 13"], desktop: { viewport: { width: 1440, height: 900 } } };
const IGNORE = /Failed to load resource|net::ERR_|status of 4\d\d|status of 5\d\d|goatcounter|MIDI|AudioContext was not allowed/i;
const failures = [];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [view, opts] of Object.entries(VIEWS)) {
  for (const path of PAGES) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push("script error: " + e.message));
    page.on("console", m => { if (m.type() === "error" && !IGNORE.test(m.text())) errs.push("console: " + m.text()); });
    await page.route(/gc\.zgo\.at|goatcounter/, r => r.abort());
    const where = `${view} /${path}`;
    try {
      const resp = await page.goto(SITE + path, { waitUntil: "load", timeout: 30000 });
      if (!resp || (!resp.ok() && path !== "404.html")) errs.push(`HTTP ${resp ? resp.status() : "no response"}`);
      await page.waitForTimeout(1500);
      if (path === "" || path.startsWith("#")) {
        // first visit shows the welcome card: start Ambient, then let it play
        const amb = page.locator('#wlc[open] [data-c="ambient"]');
        if (await amb.count()) await amb.click();
        else { const go = page.locator(".go:visible").first(); if (await go.count()) await go.click(); }
        await page.waitForTimeout(4000);
        const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        if (w[0] > w[1] + 1) errs.push(`page scrolls sideways (${w[0]}px wide in a ${w[1]}px window)`);
      }
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations
        .filter(x => x.impact === "serious" || x.impact === "critical").map(x => `${x.impact} ${x.id}: ${x.help} (${x.nodes.slice(0, 2).map(n => n.target.join(" ")).join("; ")})`));
      errs.push(...v.map(x => "accessibility: " + x));
    } catch (e) { errs.push("could not load: " + e.message); }
    console.log(`${errs.length ? "FAIL" : "ok  "} ${where}`);
    errs.forEach(e => console.log("     " + e));
    if (errs.length) failures.push(where);
    await ctx.close();
  }
}
await browser.close();
if (failures.length) { console.log(`\n${failures.length} page(s) failed`); process.exit(1); }
console.log("\nAll pages passed");
