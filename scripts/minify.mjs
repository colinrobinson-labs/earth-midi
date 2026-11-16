// Deploy step: make the home page lighter to load. Runs on the copied site folder (never on the repo), before stamp.mjs:
//   node scripts/minify.mjs _site
// What it does to the copy:
//   - minifies each script the home page loads, in place, and marks the tags `defer` so the page paints without
//     waiting for them (they still run in page order, before DOMContentLoaded)
//   - puts css/fonts.css inside the page so the first paint doesn't wait on a second stylesheet
//   - minifies the page's own <style> block
// The scripts stay separate files on purpose. Joining them into one changes how they run: a later file's names
// exist before its code is reached, so checks like `typeof CONSOLE!=="undefined"` in an earlier file stop meaning
// "console.js hasn't loaded yet" (tried it; simple.js threw). Separate files behave exactly like the repo's.
// The Apple apps build from the repo's unminified files (apps/apple/scripts/sync-web.sh), so this never touches them.
// Needs esbuild (npm i --no-save esbuild). If esbuild is missing or anything here fails, the site folder is left
// exactly as it was and the page ships unminified, so a broken minifier can never block a deploy.
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {join} from "node:path";

const root = process.argv[2];
if (!root) { console.error("usage: node scripts/minify.mjs <site dir>"); process.exit(1); }
const kb = n => (n / 1024).toFixed(0) + " KB";

try {
  const {transform} = await import("esbuild");
  const page = join(root, "index.html");
  let html = readFileSync(page, "utf8");
  const writes = [];

  // local scripts only: <script src="js/x.js"></script> with nothing else on the tag
  const TAG = /<script src="((?:js|vendor)\/[\w.\-]+\.js)"><\/script>/g;
  const files = [...html.matchAll(TAG)].map(m => m[1]);
  if (files.length < 2) throw new Error("no script tags found");
  let jsBefore = 0, jsAfter = 0;
  for (const f of files) {
    const src = readFileSync(join(root, f), "utf8");
    // names at the top of a file are shared between files and used by onclick="" attributes, so they keep their names
    // (esbuild only shortens names inside functions here)
    const {code} = await transform(src, {minify: true, target: "es2020", legalComments: "none"});
    const out = `/* Earth MIDI by Colin Robinson · earthmidi.com · readable source: github.com/colinrobinson-labs/earth-midi */\n${code}`;
    jsBefore += src.length; jsAfter += out.length;
    if (!f.includes(".min.")) writes.push([join(root, f), out]);
  }
  html = html.replace(TAG, '<script defer src="$1"></script>');

  // fonts.css into the page (its font paths are written relative to css/)
  const link = '<link rel="stylesheet" href="css/fonts.css">';
  const fontsPath = join(root, "css/fonts.css");
  if (html.includes(link) && existsSync(fontsPath)) {
    const {code} = await transform(readFileSync(fontsPath, "utf8").replaceAll("url(../fonts/", "url(fonts/"), {loader: "css", minify: true, legalComments: "none"});
    html = html.replace(link, () => `<style>${code.trim()}</style>`);
  }

  // the page's own styles
  let cssBefore = 0, cssAfter = 0;
  for (const m of [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]) {
    if (m[1].length < 2000) continue;
    const {code} = await transform(m[1], {loader: "css", minify: true, legalComments: "none"});
    cssBefore += m[1].length; cssAfter += code.length;
    html = html.replace(m[0], () => `<style>${code.trim()}</style>`);
  }

  // write only once everything above worked
  for (const [path, text] of writes) writeFileSync(path, text);
  writeFileSync(page, html);
  console.log(`Minified ${files.length} scripts: ${kb(jsBefore)} -> ${kb(jsAfter)} · page styles: ${kb(cssBefore)} -> ${kb(cssAfter)}`);
} catch (e) {
  console.log(`::warning::Minify step skipped, site ships as it is in the repo: ${e.message}`);
}
