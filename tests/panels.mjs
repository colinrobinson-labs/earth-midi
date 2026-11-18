// Accessibility of what opens: the smoke test checks each page as it loads, this one opens every panel, dialog
// and mode (Producer tabs, Export, Record, View options, Zeus Mode, Console, the phone Layers drawer) and fails
// on any serious or critical axe finding in that state. Run from the repo root with the site served at SITE.
//   node tests/panels.mjs
import { chromium, devices } from "playwright";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const SITE = (process.env.SITE || "http://localhost:8765/").replace(/\/?$/, "/");
const VIEWS = { phone: devices["iPhone 13"], desktop: { viewport: { width: 1440, height: 900 } } };
const failures = [];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [view, opts] of Object.entries(VIEWS)) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.route(/gc\.zgo\.at|goatcounter/, r => r.abort());
  const errs = [];
  page.on("pageerror", e => errs.push("script error: " + e.message));
  await page.goto(SITE, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const pulse = page.locator('#wlc[open] [data-c="pulse"]');
  if (await pulse.count()) await pulse.click();
  await page.waitForTimeout(1500);
  await page.evaluate(AXE);
  const check = async where => {
    await page.waitForTimeout(700);
    const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations
      .filter(x => x.impact === "serious" || x.impact === "critical").map(x => `${x.impact} ${x.id}: ${x.help} (${x.nodes.slice(0, 2).map(n => n.target.join(" ")).join("; ")})`));
    const all = [...errs.splice(0), ...v];
    console.log(`${all.length ? "FAIL" : "ok  "} ${view} ${where}`);
    all.forEach(e => console.log("     " + e));
    if (all.length) failures.push(`${view} ${where}`);
  };
  const desk = view === "desktop";
  const toggle = id => page.click(desk ? (id === "pro" ? "#bPro" : "#bExp") : `.dock [data-jump="${id}"]`);
  try {
    await toggle("pro");
    const tabs = page.locator("#ptabs button");
    for (let i = 0; i < (await tabs.count()); i++) { await tabs.nth(i).click(); await check(`Producer tab ${i + 1}`); }
    await toggle("pro");
    await toggle("exp"); await check("Export"); await toggle("exp");
    await page.click(desk ? "#bRecord" : "#mRec"); await check("Record"); await page.keyboard.press("Escape");
    await page.click("#vOptBtn"); await check("View options"); await page.keyboard.press("Escape");
    await page.click("#godBtn"); await check("Zeus Mode"); await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.evaluate(() => (location.hash = "#console")); await page.waitForTimeout(1000); await check("Console");
    await page.keyboard.press("Escape");
    if (!desk) { await page.waitForTimeout(500); await page.click("#sheetHead"); await check("Layers drawer"); }
  } catch (e) {
    console.log(`FAIL ${view}: could not open a panel: ${e.message.split("\n")[0]}`);
    failures.push(view);
  }
  await ctx.close();
}
await browser.close();
if (failures.length) { console.log(`\n${failures.length} state(s) failed`); process.exit(1); }
console.log("\nEvery panel passed");
