/* Earth MIDI · offline support.
   Keeps a copy of the page, its scripts, fonts and the last data snapshot, so the site (and the installed
   home-screen app) still opens with no connection and plays the last real readings it saw.
   Rules, in order:
     pages (index, support…)   network first, saved copy if the network is down or takes over 4 s
     data/*.json               network first, saved copy when offline (the page labels it as saved readings)
     files with ?v=<hash>      saved copy first: the hash changes whenever the file does (scripts/stamp.mjs)
     everything else same-site saved copy now, refreshed in the background
   Never touched: other sites (the live data sources), videos, and partial (Range) requests.
   To retire this worker, ship a sw.js that unregisters itself; bump V to drop every saved copy. */
"use strict";
const V = "em-v1", SHELL = V + "-shell", DATA = V + "-data";
const SKIP = /\.(mp4|mov|m4a|zip)$|^\/(review|press|tv)\//;
const here = new URL("./", self.location).pathname;

const ok = r => r && r.ok && r.type === "basic";
async function put(cacheName, req, res) {
  if (!ok(res)) return;
  const c = await caches.open(cacheName), url = new URL(req.url || req, self.location);
  await c.put(req, res);
  // a new ?v= of a file replaces the old one
  if (url.searchParams.has("v")) for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); }
}
const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("slow")), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });

self.addEventListener("install", e => e.waitUntil((async () => {
  const c = await caches.open(SHELL);
  try {
    const res = await fetch(here, { cache: "reload" }), html = await res.clone().text();
    if (ok(res)) await c.put(here, res);
    const refs = [...html.matchAll(/\b(?:src|href)="\/?((?:js|css|vendor|fonts|icons)\/[^"#]+)"/g)].map(m => m[1]);
    const more = ["css/fonts.css", "vendor/land-110m.json", "manifest.webmanifest", "icon.svg", "data/live.json"];
    await Promise.all([...new Set([...refs, ...more])].map(u => fetch(u).then(r => put(u.startsWith("data/") ? DATA : SHELL, new Request(u), r)).catch(() => {})));
  } catch (_) { /* offline during install: the page fills the cache on its next online visit */ }
  self.skipWaiting();
})()));

self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!k.startsWith(V + "-")) await caches.delete(k);
  await self.clients.claim();
})()));

// the page sends the list of files it actually loaded (fonts, images), so the first visit is enough to go offline
self.addEventListener("message", e => {
  const list = e.data && e.data.cache;
  if (!Array.isArray(list)) return;
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    for (const u of list.slice(0, 200)) {
      try { const url = new URL(u, self.location); if (url.origin !== self.location.origin || SKIP.test(url.pathname) || url.pathname.includes("/data/")) continue;
        if (!(await c.match(url.href))) await put(SHELL, new Request(url.href), await fetch(url.href)); } catch (_) {}
    }
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || req.headers.has("range") || SKIP.test(url.pathname)) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith(".html");
  const isData = url.pathname.includes("/data/");
  if (isPage || isData) {
    const name = isData ? DATA : SHELL;
    e.respondWith((async () => {
      try { const res = await timeout(fetch(req), isPage ? 4000 : 8000); e.waitUntil(put(name, req, res.clone())); return res; }
      catch (err) {
        const c = await caches.open(name);
        const hit = await c.match(req, { ignoreSearch: isPage }) || (req.mode === "navigate" && url.pathname === here ? await c.match(here) : null);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(SHELL), hit = await c.match(req);
    if (hit && url.searchParams.has("v")) return hit;
    const fresh = fetch(req).then(res => { e.waitUntil(put(SHELL, req, res.clone())); return res; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  })());
});
