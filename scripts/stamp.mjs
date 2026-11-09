// Deploy step: fingerprint every local script and stylesheet so browsers always fetch the version that was just deployed.
// Rewrites src="js/x.js" and href="css/x.css" in each top-level HTML file of the built site to ...?v=<content hash>.
// Run on the copied site folder (never on the repo): node scripts/stamp.mjs _site
import {readFileSync, writeFileSync, readdirSync, existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
const root = process.argv[2];
if (!root) { console.error("usage: node scripts/stamp.mjs <site dir>"); process.exit(1); }
const hashOf = f => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 10);
const cache = {};
let n = 0, missing = [];
for (const page of readdirSync(root).filter(f => f.endsWith(".html"))) {
  const p = join(root, page);
  const html = readFileSync(p, "utf8").replace(/(\b(?:src|href)=")(\/?)((?:js|css|vendor)\/[\w.\-]+\.(?:js|css))(?:\?v=[\w]+)?"/g, (m, a, slash, rel) => {
    const f = join(root, rel);
    if (!existsSync(f)) { missing.push(`${page}: ${rel}`); return m; }
    n++;
    return `${a}${slash}${rel}?v=${cache[rel] ??= hashOf(f)}"`;
  });
  writeFileSync(p, html);
}
if (missing.length) { console.error("Missing files:\n" + missing.join("\n")); process.exit(1); }
console.log(`Stamped ${n} references`);
