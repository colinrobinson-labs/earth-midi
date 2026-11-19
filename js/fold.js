/* Earth MIDI · Fold: layouts for folding phones (iPhone Duo and others) when they're partly folded.
   Book pose (fold runs top to bottom): the globe stays on the left page and the whole app (transport, Layers, Producer,
   Export, Console, Zeus, Zones, dialogs) lives on the right page, laid out as it is on a phone, because that's the page's size.
   Tent / stand pose (fold runs side to side): the globe on top. Underneath, the Planet Clock: the last thing the planet
   played in big type and a one-row transport (play, Ambient/Pulse, volume). "Controls" swaps the clock for the whole app,
   top to bottom; "Clock" brings it back. The screen stays awake while the clock plays and dims after a minute without a touch.
   Where the fold is comes from, in order:
     1. the Earth MIDI app, which reads it from the system and calls FOLD.set({axis:"v"|"h", a, w})
        (a = size of the first page in CSS px, w = width of the hinge), or FOLD.set(null) when flat or closed
     2. the browser's Viewport Segments API, where a browser has it
     3. ?fold=v or ?fold=h in the address, for testing on any screen
   Nothing changes on a flat screen. "Exit" leaves the layout until the pose changes; "Always off" remembers it. */
"use strict";
const FOLD = (() => {
  const R = document.documentElement,
    KEY = "em.fold",
    MIN = 280;
  let nat,
    dev = (/[?&#]fold=(v|h)\b/.exec(location.search + location.hash) || [])[1] || null,
    cur = null,
    dismissed = null,
    clock = true,
    fromClock = false,
    wake = null,
    dimT = 0,
    last = null;
  const off = () => {
    try {
      return localStorage.getItem(KEY) === "off";
    } catch (_) {
      return false;
    }
  };
  const css = `
html.fold-book,html.fold-tent{--fa:50vh;--fw:0px;--fp:calc(var(--fa) + var(--fw));-webkit-text-size-adjust:100%;text-size-adjust:100%}
html.fold-book{--pw:calc(100vw - var(--fp))}
html.fold-clock body{overflow:hidden}
html.fold-book body{margin-left:var(--fp)}
html.fold-tent body{padding-top:var(--fp)}
html.fold-tent{scroll-padding-top:var(--fp)}
html.fold-book .dock,html.fold-book .side,html.fold-book .rsheet,html.fold-book #godFrame,html.fold-book body.imm #znPanel{left:var(--fp)}
html.fold-book .vpop{left:calc(var(--fp) + 12px)}
html.fold-book .rpill,html.fold-book .resumepill{left:calc(var(--fp) + var(--pw) / 2)}
html.fold-tent .rsheet,html.fold-tent #godFrame{top:var(--fp)}
html.fold-tent .rpill{top:calc(var(--fp) + 10px)}
html.fold-tent .side{height:calc(100vh - var(--fp) - var(--dock,0px) - 8px)}
html.fold-tent body.imm #znPanel{max-height:calc(100vh - var(--fp) - var(--dock,0px) - var(--peek,0px) - 8px)}
html.fold-book dialog:modal{margin:auto 8px auto calc(var(--fp) + 8px);max-width:calc(100vw - var(--fp) - 16px)}
html.fold-tent dialog:modal{margin:calc(var(--fp) + 8px) auto 8px;max-height:calc(100dvh - var(--fp) - 16px)}
html.fold-book .mapwrap,html.fold-tent .mapwrap{position:fixed;z-index:79;background:var(--bg);margin:0}
html.fold-book .mapwrap{left:0;top:0;bottom:0;width:var(--fa)}
html.fold-tent .mapwrap{left:0;right:0;top:0;height:var(--fa)}
html.fold-book #map,html.fold-tent #map{height:100%;aspect-ratio:auto}
html.fold-book .immb,html.fold-tent .immb,html.fold-clock .hud2,html.fold-tent .hud .hint2{display:none}
html.fold-book .cns{left:var(--fp)}
html.fold-tent .cns{top:var(--fp)}
.fold-hinge{position:fixed;z-index:80;background:#000;pointer-events:none}
html.fold-book .fold-hinge{top:0;bottom:0;left:var(--fa);width:var(--fw)}
html.fold-tent .fold-hinge{left:0;right:0;top:var(--fa);height:var(--fw)}
html.fold-book #wlc{margin:auto 8px auto calc(var(--fp) + 8px);max-width:calc(100vw - var(--fp) - 16px)}
html.fold-tent #wlc{margin:calc(var(--fp) + 8px) auto 8px;max-height:calc(100dvh - var(--fp) - 16px)}
html.fold-tent #wlc .wlc-card{max-height:calc(100dvh - var(--fa) - var(--fw) - 16px)}
.fold-x{position:fixed;z-index:81;display:flex;gap:6px;font:600 10px var(--mono);letter-spacing:.06em;text-transform:uppercase}
.fold-x button{height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--line2);background:rgba(8,12,17,.85);color:var(--fg2);font:inherit;letter-spacing:inherit;cursor:pointer}
html.fold-book .fold-x{left:calc(var(--fa) - 12px);transform:translateX(-100%);bottom:calc(64px + env(safe-area-inset-bottom,0px))}
html.fold-tent .fold-x{right:max(12px,env(safe-area-inset-right,0px));top:calc(var(--fa) - 42px)}
html.fold-book body.god .fold-x{bottom:calc(96px + env(safe-area-inset-bottom,0px))}
html.fold-tent body.god .fold-x{top:calc(var(--fa) - 100px)}
.fold-x [data-f=view]{color:var(--fg);border-color:var(--fg2)}
html.fold-book .vtip,html.fold-tent .vtip{display:none}
/* Sound desk: folded with Producer or Export open, the panel takes the whole page half (beside or under the globe),
   its title and tabs pinned and only the controls scrolling. The dock stays underneath for Play, Ambient/Pulse and Record. */
html.fold-pane body{overflow:hidden}
html.fold-pane .side,html.fold-pane #homeBtn{display:none!important}
html.fold-pane .pro:not([hidden]){position:fixed;z-index:60;right:0;bottom:var(--fdock,0px);margin:0;border:0;border-radius:0;display:flex;flex-direction:column;overflow:hidden;
  padding:10px max(14px,env(safe-area-inset-right,0px)) 0 14px;box-shadow:0 -1px 0 var(--line2)}
html.fold-book.fold-pane .pro:not([hidden]){left:var(--fp);top:0;padding-top:max(10px,env(safe-area-inset-top,0px))}
html.fold-tent.fold-pane .pro:not([hidden]){left:0;top:var(--fp);padding-left:max(14px,env(safe-area-inset-left,0px))}
html.fold-pane .pro>h2,html.fold-pane .pro>.exph{flex:none;margin:0 0 8px;font-size:16px}
html.fold-pane .pro>h2 small,html.fold-pane .pro>.exph small{display:none}
html.fold-pane #ptabs{flex:none;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -14px;padding:2px 14px 8px}
html.fold-pane #ptabs::-webkit-scrollbar{display:none}
html.fold-pane #ptabs button{flex:none}
html.fold-pane #pgrid,html.fold-pane #exp>.exp{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding-bottom:14px;margin:0 -14px;padding-left:14px;padding-right:14px}
html.fold-pane #exp>.exp,html.fold-pane #pgrid{grid-auto-rows:max-content;align-content:start}
html.fold-pane #pgrid.mas{columns:auto}
.fold-close{display:none;flex:none;width:34px;height:34px;border-radius:10px;border:1px solid var(--line2);background:var(--sf1);color:var(--fg);font:20px/1 var(--body);cursor:pointer;margin-left:6px}
html.fold-pane .fold-close{display:inline-grid;place-items:center}
.pc-desk{display:flex;gap:8px}
.pc-desk button{height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);background:var(--sf1);color:var(--fg);font:600 12px var(--body);cursor:pointer}
.pclock{position:fixed;left:0;right:0;bottom:0;top:calc(var(--fa) + var(--fw));z-index:79;display:flex;flex-direction:column;justify-content:center;gap:clamp(8px,3vh,22px);
  padding:12px max(18px,env(safe-area-inset-right,0px)) max(14px,env(safe-area-inset-bottom,0px)) max(18px,env(safe-area-inset-left,0px));
  background:radial-gradient(120% 90% at 50% 0%,#0b1420,var(--bg) 70%);transition:opacity 1.2s}
.pclock[hidden]{display:none}
.pclock.dim{opacity:.42}
.pc-ev{display:flex;align-items:baseline;gap:14px;min-width:0}
.pc-note{font:800 clamp(34px,9vh,72px)/1 var(--disp);letter-spacing:-.02em;color:var(--pcc,var(--fg));text-shadow:0 0 28px color-mix(in srgb,var(--pcc,var(--fg)) 45%,transparent);flex:none}
.pc-txt{min-width:0;font:500 clamp(14px,3.2vh,22px)/1.3 var(--body);color:var(--fg);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pc-meta{font:500 clamp(11px,2vh,14px) var(--mono);color:var(--mute);letter-spacing:.04em}
.pc-row{display:flex;align-items:center;gap:12px}
.pc-row .go{flex:none}
.pc-row .seg{flex:none}
.pc-row input[type=range]{flex:1;min-width:80px;height:44px}
@media (prefers-reduced-motion:reduce){.pclock{transition:none}}
`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  const hinge = document.createElement("div");
  hinge.className = "fold-hinge";
  hinge.hidden = true;
  document.body.appendChild(hinge);
  const bar = document.createElement("div");
  bar.className = "fold-x";
  bar.hidden = true;
  bar.innerHTML = `<button type="button" data-f="view" hidden>Controls</button><button type="button" data-f="exit">Exit</button><button type="button" data-f="off">Always off</button>`;
  const viewB = bar.querySelector("[data-f=view]");
  document.body.appendChild(bar);
  bar.onclick = (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    if (b.dataset.f === "view") {
      clock = !clock;
      fromClock = false;
      apply();
      if (!clock) scrollTo(0, 0);
      return;
    }
    if (b.dataset.f === "off") {
      try {
        localStorage.setItem(KEY, "off");
      } catch (_) {}
      if (typeof xs === "function") xs("Fold layouts off. Clear site data to turn them back on");
    }
    dismissed = cur && cur.axis;
    apply();
  };

  /* Planet Clock panel (tent pose) */
  const pc = document.createElement("section");
  pc.className = "pclock";
  pc.hidden = true;
  pc.setAttribute("aria-label", "Planet Clock");
  pc.innerHTML = `<div class="pc-ev"><span class="pc-note" id="pcNote">♪</span><span class="pc-txt" id="pcTxt">Press play and the planet starts playing.</span></div>
<div class="pc-meta" id="pcMeta"></div>
<div class="pc-row"><button class="go" type="button" aria-label="Play or stop"><i></i><span>PLAY</span></button>
<div class="seg"><button data-style="ambient" aria-pressed="true">Ambient</button><button data-style="pulse" aria-pressed="false">Pulse</button></div>
<input type="range" min="0" max="1" step=".01" aria-label="Volume" id="pcVol"></div>
<div class="pc-desk"><button type="button" data-d="pro">Producer</button><button type="button" data-d="exp">Export</button><button type="button" data-d="cns">Console</button></div>`;
  document.body.appendChild(pc);
  const pv = pc.querySelector("#pcVol"),
    mv = $("vol");
  const syncPC = () => {
    const g = pc.querySelector(".go"),
      on = !!(typeof S !== "undefined" && S.on);
    g.classList.toggle("on", on);
    g.querySelector("span").textContent = on ? "STOP" : "PLAY";
    pc.querySelectorAll("[data-style]").forEach((b) =>
      b.setAttribute("aria-pressed", String(typeof S !== "undefined" && S.style === b.dataset.style)),
    );
    if (mv) pv.value = mv.value;
  };
  pc.querySelector(".go").onclick = () => {
    if (typeof startStop === "function")
      Promise.resolve(startStop()).then(() => {
        syncPC();
        awake();
      });
  };
  pc.querySelectorAll("[data-style]").forEach(
    (b) =>
      (b.onclick = () => {
        if (typeof setStyle === "function") setStyle(b.dataset.style);
        syncPC();
      }),
  );
  pv.oninput = () => {
    if (!mv) return;
    mv.value = pv.value;
    mv.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const meta = () => {
    try {
      const c = S.cur || {},
        kp = +c.kp || 0;
      $("pcMeta").textContent =
        `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Kp ${kp.toFixed(1)}${typeof kpScaleName === "function" ? " · " + kpScaleName(kp || 2) : ""}${S.on ? "" : " · stopped"}`;
    } catch (_) {}
  };
  const hook = () => {
    if (typeof window.logEv !== "function" || window.logEv.__fold) return;
    const orig = window.logEv;
    window.logEv = function (text, layer) {
      const r = orig.apply(this, arguments);
      try {
        last = { text: String(text || "").replace(/<[^>]+>/g, ""), layer: layer || "" };
        if (cur && cur.axis === "h") showLast();
      } catch (_) {}
      return r;
    };
    Object.assign(window.logEv, orig);
    window.logEv.__fold = true;
  };
  const showLast = () => {
    if (!last) return;
    const m = /→\s*([A-G]#?-?\d)/.exec(last.text);
    $("pcNote").textContent = m ? m[1] : "♪";
    $("pcTxt").textContent = last.text.replace(/\s*→.*$/, "");
    pc.style.setProperty("--pcc", last.layer ? `var(--${last.layer})` : "var(--fg)");
  };

  /* stays awake while playing in the clock, dims after a minute without a touch */
  async function awake() {
    const want = cur && cur.axis === "h" && typeof S !== "undefined" && S.on;
    if (want && !wake && navigator.wakeLock) {
      try {
        wake = await navigator.wakeLock.request("screen");
        wake.addEventListener("release", () => {
          wake = null;
        });
      } catch (_) {}
    } else if (!want && wake) {
      try {
        await wake.release();
      } catch (_) {}
      wake = null;
    }
  }
  const poke = () => {
    pc.classList.remove("dim");
    clearTimeout(dimT);
    if (cur && cur.axis === "h") dimT = setTimeout(() => pc.classList.add("dim"), 60000);
  };
  addEventListener("pointerdown", poke, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      wake = null;
      awake();
    }
  });

  /* the page's own width media rules follow the page half, not the whole window (see PAGE_W in core.js) */
  const orig = new WeakMap(),
    WQ = /^\s*\((min|max)-width:\s*\d+(?:\.\d+)?px\)(\s+and\s+\((min|max)-width:\s*\d+(?:\.\d+)?px\))*\s*$/;
  let pageW = 0;
  const walk = (rules) => {
    for (const r of rules) {
      if (!(r instanceof CSSMediaRule)) continue;
      let o = orig.get(r);
      if (o === undefined) orig.set(r, (o = r.media.mediaText));
      if (WQ.test(o)) {
        const want = pageW ? (WIDTH_MQ.test(o, pageW) ? "all" : "not all") : o;
        if (r.media.mediaText !== want) r.media.mediaText = want;
      }
      walk(r.cssRules);
    }
  };
  const media = () => {
    for (const sh of document.styleSheets) {
      let rs;
      try {
        rs = sh.cssRules;
      } catch (_) {
        continue;
      }
      walk(rs);
    }
  };
  new MutationObserver(() => pageW && media()).observe(document.head, { childList: true });
  function setPage(w) {
    w = Math.round(w) || 0;
    if (w === pageW) return;
    pageW = w;
    media();
    if (typeof WIDTH_MQ !== "undefined") WIDTH_MQ.set(w);
  }

  function fromWeb() {
    const s = window.viewport && window.viewport.segments;
    if (!s || s.length !== 2) return null;
    const [a, b] = s;
    return Math.abs(a.top - b.top) < 2
      ? { axis: "v", a: a.width, w: Math.max(0, b.left - a.right) }
      : { axis: "h", a: a.height, w: Math.max(0, b.top - a.bottom) };
  }
  function fromDev() {
    if (!dev) return null;
    const W = innerWidth,
      H = innerHeight,
      w = Math.round(Math.min(W, H) * 0.02);
    return dev === "v" ? { axis: "v", a: Math.round((W - w) / 2), w } : { axis: "h", a: Math.round((H - w) / 2), w };
  }
  /* the sound desk (see the CSS above): one panel at a time, and opening one from the Planet Clock puts the clock away */
  const panes = [$("pro"), $("exp")].filter(Boolean);
  panes.forEach((p) => {
    const h = p.querySelector("h2,.exph"),
      x = document.createElement("button");
    x.type = "button";
    x.className = "fold-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    x.onclick = () => (p.hidden = true);
    if (h) h.appendChild(x);
  });
  const paneSync = () => R.classList.toggle("fold-pane", !!cur && panes.some((p) => !p.hidden));
  const po = new MutationObserver((recs) => {
    let re = false;
    recs.forEach((r) => {
      if (!cur || r.target.hidden) return;
      panes.forEach((p) => p !== r.target && !p.hidden && (p.hidden = true));
      if (cur.axis === "h" && clock) re = !(clock = false);
    });
    // a panel opened from the Planet Clock goes back to the clock when it closes
    if (fromClock && cur && cur.axis === "h" && panes.every((p) => p.hidden)) {
      fromClock = false;
      clock = re = true;
    }
    re ? apply() : paneSync();
  });
  panes.forEach((p) => po.observe(p, { attributes: true, attributeFilter: ["hidden"] }));
  // the desk ends where the dock begins (--fdock: the dock's height from the bottom edge, safe area included)
  const dock = document.querySelector(".dock");
  const dockH = () => {
    if (!dock) return;
    const r = dock.getBoundingClientRect(),
      h = r.height ? Math.max(0, Math.round(innerHeight - r.top)) : 0;
    R.style.setProperty("--fdock", h + "px");
  };
  if (dock && window.ResizeObserver) new ResizeObserver(dockH).observe(dock);
  addEventListener("resize", dockH);
  dockH();
  // in the desk only the controls scroll, so a new tab starts at its top
  const ptabs = $("ptabs"),
    pgrid = $("pgrid");
  if (ptabs && pgrid)
    ptabs.addEventListener("click", () => {
      if (R.classList.contains("fold-pane")) requestAnimationFrame(() => (pgrid.scrollTop = 0));
    });
  pc.querySelector(".pc-desk").onclick = (e) => {
    const b = e.target.closest("[data-d]");
    if (!b) return;
    clock = false;
    fromClock = b.dataset.d !== "cns";
    if (b.dataset.d === "cns") {
      apply();
      if (typeof CONSOLE !== "undefined") CONSOLE.open();
    } else $(b.dataset.d).hidden = false;
    apply();
  };

  function apply() {
    let f = nat !== undefined ? nat : fromWeb() || fromDev();
    if (f && !(f.axis === "v" || f.axis === "h")) f = null;
    if (f) {
      const span = f.axis === "v" ? innerWidth : innerHeight;
      if (f.a < MIN || span - f.a - f.w < MIN) f = null;
    }
    if (!f || f.axis !== dismissed) dismissed = null; // a new pose clears "Exit"
    if (f && (off() || f.axis === dismissed || R.classList.contains("embed"))) f = null;
    const was = cur && cur.axis;
    cur = f;
    R.classList.toggle("fold-book", !!f && f.axis === "v");
    R.classList.toggle("fold-tent", !!f && f.axis === "h");
    if (f) {
      R.style.setProperty("--fa", f.a + "px");
      R.style.setProperty("--fw", f.w + "px");
    } else {
      R.style.removeProperty("--fa");
      R.style.removeProperty("--fw");
    }
    hinge.hidden = bar.hidden = !f;
    const now = f && f.axis;
    if (now === "h" && was !== "h") ((clock = true), (fromClock = false)); // tent opens on the Planet Clock; "Controls" swaps in the full app
    const showClock = now === "h" && clock;
    pc.hidden = !showClock;
    R.classList.toggle("fold-clock", showClock);
    viewB.hidden = now !== "h";
    viewB.textContent = showClock ? "Controls" : "Clock";
    setPage(now === "v" ? innerWidth - f.a - f.w : 0);
    paneSync();
    if (now !== was) {
      if (now === "h") {
        hook();
        syncPC();
        showLast();
        meta();
        poke();
      }
      awake();
      requestAnimationFrame(() => dispatchEvent(new Event("resize")));
    }
  }
  let rt = 0;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(apply, 80);
  });
  if (window.viewport && window.viewport.addEventListener)
    try {
      window.viewport.addEventListener("segmentschange", apply);
    } catch (_) {}
  setInterval(() => {
    if (cur && cur.axis === "h") {
      meta();
      syncPC();
      awake();
    }
  }, 5000);
  setTimeout(apply, 400);
  return {
    set(f) {
      nat = f || null;
      apply();
    },
    get pose() {
      return cur ? (cur.axis === "v" ? "book" : "tent") : "flat";
    },
  };
})();
