// Keyboard, dialog and offline checks. Run from the repo root with the built site served at SITE (default http://localhost:8765/).
//   npm i --no-save playwright && node tests/keyboard-offline.mjs
// Fails if: Space on a focused button plays instead of pressing it, a layer can't be muted from the keyboard, tabs ignore
// arrow keys, the globe or timeline can't be driven by keys, a browser prompt()/confirm() appears, or the page won't open offline.
import { chromium } from "playwright";
const SITE = (process.env.SITE || "http://localhost:8765/").replace(/\/?$/, "/");
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
const check = (name, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) fails.push(name); };
const open = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
  page.on("pageerror", e => check("no script error: " + e.message, false));
  page.on("dialog", d => { check(`no browser ${d.type()}()`, false); d.dismiss(); });
  await page.route(/gc\.zgo\.at|goatcounter/, r => r.abort());
  await page.goto(SITE, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const quiet = page.locator('#wlc[open] [data-c="silent"]').last();
  if (await quiet.count()) await quiet.click();
  await page.waitForTimeout(800);
  return { ctx, page };
};

{ // keyboard
  const { ctx, page } = await open();
  await page.focus("#bPro"); await page.keyboard.press("Space"); await page.waitForTimeout(300);
  check("Space on the Producer button opens Producer and does not start playback", await page.evaluate(() => !document.getElementById("pro").hidden && !S.on));
  // holding Space sends one press and then repeats: it should start playback once, not toggle with every repeat
  await page.evaluate(() => { document.activeElement.blur(); for (let i = 0; i < 6; i++) document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", repeat: i > 0, bubbles: true })); });
  await page.waitForTimeout(800);
  check("holding Space starts playback once", await page.evaluate(() => S.on));
  await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true })));
  await page.waitForTimeout(500);
  check("pressing Space again stops it", await page.evaluate(() => !S.on));
  await page.focus("#ptabs [role=tab][aria-selected=true]"); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(300);
  check("arrow keys move between Producer tabs", await page.evaluate(() => { const t = [...document.querySelectorAll("#ptabs [role=tab]")]; return t[1].getAttribute("aria-selected") === "true" && document.activeElement === t[1]; }));
  // with Producer open the studio rail shows Producer; its Layers tab brings the layer list back
  if (await page.locator('.rail-tabs [data-rail="layers"]').isVisible()) await page.click('.rail-tabs [data-rail="layers"]');
  await page.focus('.lname[data-k="q"]'); await page.keyboard.press("Enter");
  check("Enter on a layer name mutes it", await page.evaluate(() => S.mute.q === true));
  await page.keyboard.press("Enter"); await page.keyboard.press("s");
  check("S on a layer name solos it", await page.evaluate(() => S.solo === "q"));
  await page.keyboard.press("s");
  const lon = await page.evaluate(() => VIEW.lon);
  await page.focus("#map"); await page.keyboard.press("ArrowRight");
  check("arrow keys spin the globe", await page.evaluate(l => VIEW.lon !== l, lon));
  await page.focus("#tl"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(300);
  check("timeline: Left jumps back and starts the replay", await page.evaluate(() => S.on && S.mode > 0 && !S.liveSince));
  await page.keyboard.press("End"); await page.waitForTimeout(200);
  check("timeline: End returns to live", await page.evaluate(() => !!S.liveSince || S.mode === 0));
  await page.evaluate(() => { if (S.on) startStop(); });
  // dialogs: the site's own, never prompt()
  if (await page.locator("#pro").isHidden()) await page.click("#bPro");
  await page.locator("#ptabs [role=tab]").last().click(); await page.waitForTimeout(300);
  await page.click("#bUP"); await page.waitForTimeout(200);
  check("Save preset opens the site's dialog with the name field focused", await page.evaluate(() => !!document.querySelector("dialog.emd[open]") && document.activeElement.tagName === "INPUT"));
  await page.keyboard.type("<img src=x onerror=window.__hit=1>"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  check("preset saved under the typed name, as text", await page.evaluate(() => Object.keys(UPRE).length === 1 && !window.__hit && !document.querySelector("dialog.emd")));
  await page.click(".fpdel"); await page.waitForTimeout(200); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  check("Esc on the delete question keeps the preset", await page.evaluate(() => Object.keys(UPRE).length === 1));
  await ctx.close();
}

{ // offline: one online visit, then no network
  const { ctx, page } = await open();
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(6000);
  await ctx.setOffline(true);
  let loaded = true;
  try { await page.reload({ waitUntil: "load", timeout: 20000 }); } catch (_) { loaded = false; }
  await page.waitForTimeout(2500);
  check("the page opens with no connection", loaded && await page.evaluate(() => typeof startStop === "function" && !!document.getElementById("map")));
  check("offline: the title font still loads", await page.evaluate(() => document.fonts.check("700 20px Archivo")));
  await page.evaluate(() => refresh(true)); await page.waitForTimeout(500);
  check("offline: the status line says so", /offline/i.test(await page.textContent("#dataState")));
  await ctx.close();
}
await browser.close();
if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log("\nAll keyboard and offline checks passed");
