/* Earth MIDI · Undo and redo for the sound, like any DAW: Cmd/Ctrl+Z steps back, Shift+Cmd/Ctrl+Z (or Ctrl+Y)
   steps forward, and the arrows in the Producer and Console headers do the same on touch screens.
   Every change to the sound goes through afterCFG() or setStyle() in ui.js, which call HIST.note(). A burst of
   changes (one slider drag, one preset, one Reset all) settles for a moment and then becomes one step.
   View settings (globe/flat, spin, weather, zones, sound follows view) are never undone: they're where you're
   looking, not what you hear. Mute and solo aren't either, same as most DAWs. History lives only in this tab. */
"use strict";
const HIST = (() => {
  const MAX = 100,
    SETTLE = 400;
  const VIEW = ["mapView", "spin", "weather", "viewMix", "zonesOn", "zones", "loop"];
  const snap = () => {
    const c = clone(CFG);
    VIEW.forEach((k) => delete c[k]);
    return { c, s: S.style, j: JSON.stringify(c) + "|" + S.style };
  };
  let last = snap(),
    timer = 0,
    busy = false;
  const back = [],
    fwd = [];

  function note() {
    if (busy) return;
    clearTimeout(timer);
    timer = setTimeout(commit, SETTLE);
  }
  function commit() {
    clearTimeout(timer);
    timer = 0;
    const now = snap();
    if (now.j === last.j) return;
    back.push(last);
    if (back.length > MAX) back.shift();
    fwd.length = 0;
    last = now;
    sync();
  }

  // the name of what changed between two steps, for the status line: one control by its label, else a count
  const nice = (k) => {
    const el = document.querySelector(`[data-k="${k}"]`),
      pc = el && el.closest(".pc"),
      lab = pc && pc.querySelector("label");
    if (lab && lab.textContent.trim()) return lab.textContent.trim();
    const m = /^(vol|send)\.(\w+)$/.exec(k);
    if (m && typeof LNAME !== "undefined" && LNAME[m[2]])
      return `${LNAME[m[2]]} ${m[1] === "vol" ? "level" : "reverb send"}`;
    return null;
  };
  function what(a, b) {
    const keys = [];
    for (const k of Object.keys(a.c)) {
      const x = a.c[k],
        y = b.c[k];
      if (x && typeof x === "object") {
        for (const kk of Object.keys(x))
          if (JSON.stringify(x[kk]) !== JSON.stringify((y || {})[kk])) keys.push(k + "." + kk);
      } else if (x !== y) keys.push(k);
    }
    if (a.s !== b.s) keys.push("style");
    if (keys.length === 1) return keys[0] === "style" ? "Ambient / Pulse" : nice(keys[0]) || "1 setting";
    return `${keys.length} settings`;
  }

  function go(from, to, verb) {
    if (timer) commit();
    if (!from.length) {
      xs(verb === "Undo" ? "Nothing to undo" : "Nothing to redo");
      return false;
    }
    const step = from.pop();
    to.push(last);
    const was = last;
    busy = true;
    try {
      const keep = {};
      VIEW.forEach((k) => (keep[k] = CFG[k]));
      CFG = mergeCFG(Object.assign(clone(step.c), keep));
      if (S.style !== step.s) setStyle(step.s);
      if (typeof TEMPO !== "undefined") {
        TEMPO.bpm = 0;
        TEMPO.lt = 0;
      }
      if (typeof NEEDS_WX !== "undefined" && NEEDS_WX.has(CFG.tempoSrc) && typeof loadWX === "function") loadWX();
      if (typeof STUDIO !== "undefined" && STUDIO.setLast) STUDIO.setLast(null);
      afterCFG();
      if (typeof CONSOLE !== "undefined" && CONSOLE.refresh) CONSOLE.refresh();
    } finally {
      busy = false;
    }
    last = snap();
    last.why = step.why;
    // a preset or reset that was offered with its own name says that name again
    const why = verb === "Undo" ? was.why : step.why;
    xs(`${verb}: ${why || what(was, last)}`);
    sync();
    return true;
  }
  const undo = () => go(back, fwd, "Undo"),
    redo = () => go(fwd, back, "Redo");
  const can = (w) => (w === "undo" ? back.length > 0 || !!timer : fwd.length > 0);

  /* status line with an Undo button, for one-tap changes that replace a lot at once (presets, Reset all) */
  function offer(msg) {
    const e = $("xState");
    if (!e) return xs(msg);
    // let the change settle into its own step first, so Undo takes back exactly this
    commit();
    last.why = msg;
    xs(msg);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "xundo";
    b.textContent = "Undo";
    b.onclick = () => undo();
    e.append(" ", b);
    clearTimeout(xs.t);
    xs.t = setTimeout(() => {
      e.textContent = "";
      e.classList.remove("on");
    }, 8000);
  }

  /* ---------- buttons ---------- */
  const ICO = {
    undo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`,
    redo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>`,
  };
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const KEY = { undo: MAC ? "⌘Z" : "Ctrl+Z", redo: MAC ? "⇧⌘Z" : "Ctrl+Y" };
  const button = (w, cls) =>
    `<button type="button" class="${cls}" data-hist="${w}" aria-label="${w === "undo" ? "Undo" : "Redo"} (${KEY[w]})" title="${w === "undo" ? "Undo" : "Redo"} · ${KEY[w]}"${can(w) ? "" : " disabled"}>${ICO[w]}</button>`;
  function sync() {
    document.querySelectorAll("[data-hist]").forEach((b) => {
      const off = !can(b.dataset.hist);
      if (b.disabled !== off) b.disabled = off;
    });
    // like the Reset buttons, the Producer pair stays out of sight until there's something to step through
    const ph = document.querySelector(".phist");
    if (ph) ph.hidden = !back.length && !fwd.length;
  }
  const h2 = document.querySelector("#pro h2");
  if (h2) {
    const span = document.createElement("span");
    span.className = "phist";
    span.hidden = true;
    span.innerHTML = button("undo", "hb") + button("redo", "hb");
    const st = $("pstat");
    st ? h2.insertBefore(span, st) : h2.appendChild(span);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-hist]");
    if (!b || b.disabled) return;
    b.dataset.hist === "undo" ? undo() : redo();
  });

  /* ---------- keys: the standard ones. Text fields keep their own undo. ---------- */
  addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k !== "z" && k !== "y") return;
    const t = e.target;
    if (
      t &&
      (t.isContentEditable ||
        t.matches('textarea,input:not([type="range"]):not([type="checkbox"]):not([type="radio"])'))
    )
      return;
    if (document.querySelector("dialog[open]")) return;
    e.preventDefault();
    if (k === "y" || e.shiftKey) redo();
    else undo();
  });

  const css = document.createElement("style");
  css.textContent = `
.phist{display:inline-flex;gap:4px;margin-left:auto;order:2}.phist[hidden]{display:none}
.phist .hb,.cns-top .hb{display:inline-grid;place-items:center;width:30px;height:30px;padding:0;border-radius:9px;border:1px solid var(--line2);background:transparent;color:var(--fg);cursor:pointer;flex:none}
.cns-top .hb{width:40px;height:40px;border-radius:11px}
.phist .hb svg,.cns-top .hb svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.phist .hb:hover:not(:disabled),.cns-top .hb:hover:not(:disabled){background:var(--sf2);border-color:var(--mute)}
.phist .hb:disabled,.cns-top .hb:disabled{opacity:.3;cursor:default}
.xundo{margin-left:6px;padding:1px 9px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;font:600 11px var(--body);cursor:pointer;min-height:0}
.xundo:hover{background:color-mix(in srgb,currentColor 15%,transparent)}`;
  document.head.appendChild(css);

  return { note, undo, redo, can, offer, button, sync, commit };
})();
