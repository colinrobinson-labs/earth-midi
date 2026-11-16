// Loads the site's data-to-note code (js/feeds.js, js/core.js, js/audio.js) into a bare Node sandbox:
// no browser, no sound, no network. Only the pure rules are usable; anything that draws or plays is stubbed out.
import vm from "node:vm";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);

export function loadEngine(files = ["feeds", "core", "audio"]) {
  const noop = () => {};
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const sandbox = {
    console, Math, JSON, Date, Event: class {},
    setTimeout: noop, setInterval: noop, clearTimeout: noop, clearInterval: noop, requestAnimationFrame: noop,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    addEventListener: noop, dispatchEvent: noop,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    location: { hash: "", search: "", href: "http://localhost/" },
    navigator: { userAgent: "node" },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, documentElement: { classList, style: { setProperty: noop } }, body: null },
    fetch: async () => { throw new Error("offline"); },
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(readFileSync(new URL(`js/${f}.js`, ROOT), "utf8"), sandbox, { filename: `js/${f}.js` });
  // top-level const/let in the site scripts aren't properties of the sandbox, so reach them by evaluating
  return { run: code => vm.runInContext(code, sandbox), sandbox };
}
