/* Earth MIDI · Rooms: one place for listening, mixing, readings and export, on every flat screen.
   Phones (up to 700 px): a tab bar under the dock, like a music app.
     Listen    the globe, the player and the Layers drawer, all on one screen with nothing to scroll past
     Mix       Producer full screen (Sound, Mixer, Rhythm, Master, MIDI, Presets)
     Readings  the reading cards and the Event log
     Export    files, recording, sharing
     Play, Ambient/Pulse and Record stay in the dock above the tabs in every room.
   Big screens (900 px and up): the right-hand column becomes a studio rail with three tabs, Layers, Producer and
   Export. The globe never moves, and Producer is just the rail's next tab, so there's no mode to get in or out of.
   The Producer and Export buttons in the top bar pick the rail tab (a second press goes back to Layers).
   Tablets between 701 and 899 px keep the Producer and Export sheets from js/desk.js.
   Folded phones (js/fold.js), Simple and embed keep their own layouts. Share links and #pro still open Producer. */
"use strict";
const SECTIONS = (() => {
  const R = document.documentElement,
    pro = $("pro"),
    exp = $("exp"),
    side = $("side"),
    dock = document.querySelector(".dock"),
    PHONE = matchMedia("(max-width:700px)"),
    RAIL = matchMedia("(min-width:900px)"),
    RM = matchMedia("(prefers-reduced-motion: reduce)");
  if (!pro || !exp || !side || !dock) return { mode: () => null };
  const css = document.createElement("style");
  css.textContent = `
.rtabs,.rail-tabs{display:none}
/* ---------- phone tabs ---------- */
html.rooms-phone .dock [data-jump]{display:none}
html.rooms-phone .dock{background:var(--bg)}
html.rooms-phone .rtabs{display:flex;justify-content:space-around;gap:4px;max-width:460px;width:100%;margin:8px auto 0;padding-top:6px;border-top:1px solid var(--line)}
.rtabs button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 0 2px;border:0;background:none;color:var(--mute);font:600 10.5px var(--body);letter-spacing:.01em;cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative}
.rtabs svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;transition:transform .25s cubic-bezier(.2,1.4,.4,1)}
.rtabs button[aria-current=page]{color:var(--fg)}
.rtabs button[aria-current=page] svg{transform:translateY(-1px) scale(1.08);stroke-width:2.1}
.rtabs button::after{content:"";position:absolute;top:-7px;left:30%;right:30%;height:2px;border-radius:2px;background:var(--spectrum,var(--fg));opacity:0;transform:scaleX(.3);transition:opacity .2s,transform .3s cubic-bezier(.2,1,.3,1)}
.rtabs button[aria-current=page]::after{opacity:1;transform:none}
.rtabs button:focus-visible{outline:2px solid var(--o);outline-offset:2px;border-radius:8px}
html.room-listen.rooms-phone .grid,html.room-listen.rooms-phone #insp,html.room-listen.rooms-phone .refs,html.room-listen.rooms-phone footer{display:none}
html.room-listen.rooms-phone body:not(.flat):not(.imm) #map{aspect-ratio:auto;height:var(--lh,auto)}
html.room-readings.rooms-phone header,html.room-readings.rooms-phone .bar{display:none}
html.room-readings.rooms-phone .main{position:fixed;left:0;right:0;top:0;visibility:hidden;pointer-events:none;z-index:-1}
html.room-readings.rooms-phone .grid{margin-top:max(8px,env(safe-area-inset-top,0px))}
html.room-readings.rooms-phone #homeBtn{display:none!important}
html.room-panel body{overflow:hidden}
html.room-panel .pro:not([hidden]){left:0;right:0;top:0;bottom:var(--dock);border:0;border-radius:0;box-shadow:none;
  padding:max(12px,env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 0 max(14px,env(safe-area-inset-left,0px));animation:roomIn .28s cubic-bezier(.2,1,.3,1)}
html.room-panel .pro>h2,html.room-panel .pro>.exph{padding-right:0}
html.room-panel .fold-close,html.room-panel .desk-grip,html.room-panel #homeBtn{display:none!important}
html.room-panel .side{visibility:hidden}
/* ---------- big screens: the studio rail ---------- */
html.rooms-rail .rail-tabs{display:flex;gap:4px;margin:0 0 12px;padding:3px;border:1px solid var(--line2);border-radius:12px;background:var(--sf1)}
.rail-tabs button{flex:1;min-width:0;height:36px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:9px;background:none;color:var(--mute);font:600 13px var(--body);cursor:pointer;transition:background .2s,color .2s}
.rail-tabs button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.rail-tabs button:hover{color:var(--fg)}
.rail-tabs button[aria-selected=true]{background:var(--fg);color:var(--bg)}
.rail-tabs button:focus-visible{outline:2px solid var(--o);outline-offset:2px}
html.rooms-rail.rail-pro .side>:not(.rail-tabs):not(#pro),html.rooms-rail.rail-exp .side>:not(.rail-tabs):not(#exp){display:none}
html.rooms-rail .side>.pro{margin:0;border:0;padding:12px 0 0;background:none;animation:roomIn .28s cubic-bezier(.2,1,.3,1)}
html.rooms-rail .side>.pro>h2,html.rooms-rail .side>.pro>.exph{font-size:16px;flex-wrap:wrap;justify-content:flex-start}
html.rooms-rail .side>.pro>h2 small,html.rooms-rail .side>.pro>.exph small{flex-basis:100%}
html.rooms-rail .side #ptabs{flex-wrap:wrap}
html.rooms-rail .side #pgrid,html.rooms-rail .side #pgrid.mas{display:grid;grid-template-columns:minmax(0,1fr);columns:auto}
html.rooms-rail .side .exp{grid-template-columns:minmax(0,1fr)!important}
html.rooms-rail .side .exp>*{grid-column:auto!important;grid-row:auto!important}
html.rooms-rail.rail-pro .main,html.rooms-rail.rail-exp .main{grid-template-columns:minmax(0,1fr) 440px}
@media (min-width:1500px){html.rooms-rail.rail-pro .main,html.rooms-rail.rail-exp .main{grid-template-columns:minmax(0,1fr) 520px}
  html.rooms-rail .side #pgrid.mas{display:block;columns:2 230px}html.rooms-rail .side #pgrid.mas>*{break-inside:avoid;margin:0 0 12px}}
/* the rail is one long column: a short, capped stagger so the last cards don't trail in a second late */
html.rooms-rail .side .enter>*{animation-duration:.4s;animation-delay:calc(min(var(--i,0),4)*35ms)}
@keyframes roomIn{from{opacity:0;transform:translateY(8px)}}
@media (prefers-reduced-motion:reduce){html.room-panel .pro:not([hidden]),html.rooms-rail .side>.pro{animation:none}.rtabs svg,.rtabs button::after{transition:none}}
`;
  document.head.appendChild(css);

  const I = {
    listen:
      '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/>',
    mix: '<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="14" r="2.2"/><circle cx="12" cy="8" r="2.2"/><circle cx="18" cy="16" r="2.2"/>',
    readings: '<path d="M3 17l4-6 4 3 4-8 6 11"/><path d="M3 21h18"/>',
    export: '<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/>',
    layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

  /* phone tab bar, inside the dock under the transport row */
  const tabs = document.createElement("nav");
  tabs.className = "rtabs";
  tabs.setAttribute("aria-label", "Sections");
  tabs.innerHTML = [
    ["listen", "Listen"],
    ["mix", "Mix"],
    ["readings", "Readings"],
    ["export", "Export"],
  ]
    .map(([k, t]) => `<button type="button" data-room="${k}">${svg(k)}<span>${t}</span></button>`)
    .join("");
  dock.appendChild(tabs);

  /* studio rail tabs, top of the right-hand column */
  const rt = document.createElement("div");
  rt.className = "rail-tabs";
  rt.setAttribute("role", "tablist");
  rt.setAttribute("aria-label", "Studio");
  rt.innerHTML = [
    ["layers", "Layers", "layers"],
    ["pro", "Producer", "mix"],
    ["exp", "Export", "export"],
  ]
    .map(
      ([k, t, ic]) => `<button type="button" role="tab" data-rail="${k}" aria-selected="false">${svg(ic)}${t}</button>`,
    )
    .join("");
  side.prepend(rt);

  // where the panels normally live, so they can go back when the rail isn't in use
  const homes = [pro, exp].map((p) => {
    const m = document.createComment(p.id);
    p.before(m);
    return [p, m];
  });

  let mode = null,
    readings = false;
  const flat = () => !/\b(fold-book|fold-tent|simple|embed)\b/.test(R.className);
  const room = () => (!pro.hidden ? "mix" : !exp.hidden ? "export" : readings ? "readings" : "listen");

  function place() {
    const want = flat() ? (PHONE.matches ? "phone" : RAIL.matches ? "rail" : null) : null;
    if (want === mode) return false;
    const was = mode;
    mode = want;
    homes.forEach(([p, m]) => {
      if (mode === "rail" && p.parentNode !== side) side.appendChild(p);
      else if (mode !== "rail" && p.parentNode === side) m.after(p);
    });
    if (was === "phone") R.style.removeProperty("--dock");
    if (mode !== "phone") readings = false;
    return true;
  }
  // the dock grew a row of tabs: everything that sits on top of the dock follows its real height
  const dockH = () => {
    if (mode !== "phone") return;
    const h = Math.round(dock.getBoundingClientRect().height);
    if (h) R.style.setProperty("--dock", h + "px");
  };
  if (window.ResizeObserver) new ResizeObserver(dockH).observe(dock);

  // Listen on a phone is one screen: the globe takes whatever height is left between the player bar and the
  // Layers drawer, so it's whole instead of cut off under the dock
  const map = $("map");
  function fit() {
    if (!(mode === "phone" && room() === "listen") || !map) return R.style.removeProperty("--lh");
    const top = map.getBoundingClientRect().top + scrollY,
      peek = parseFloat(getComputedStyle(R).getPropertyValue("--peek")) || 64,
      h = Math.round(innerHeight - top - dock.getBoundingClientRect().height - peek - 6);
    R.style.setProperty("--lh", Math.max(260, Math.min(h, innerWidth * 1.15)) + "px");
  }
  addEventListener("resize", () => mode === "phone" && fit());
  function sync() {
    const moved = place(),
      r = room();
    R.classList.toggle("rooms-phone", mode === "phone");
    R.classList.toggle("rooms-rail", mode === "rail");
    ["listen", "mix", "readings", "export"].forEach((k) =>
      R.classList.toggle("room-" + k, mode === "phone" && r === k),
    );
    R.classList.toggle("room-panel", mode === "phone" && (r === "mix" || r === "export"));
    R.classList.toggle("rail-pro", mode === "rail" && !pro.hidden);
    R.classList.toggle("rail-exp", mode === "rail" && pro.hidden && !exp.hidden);
    tabs.querySelectorAll("[data-room]").forEach((b) => {
      if (b.dataset.room === r) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    const rk = !pro.hidden ? "pro" : !exp.hidden ? "exp" : "layers";
    rt.querySelectorAll("[data-rail]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.rail === rk)));
    if (mode === "phone") dockH();
    fit();
    if (moved) requestAnimationFrame(() => dispatchEvent(new Event("resize")));
  }

  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-room]");
    if (!b) return;
    const k = b.dataset.room,
      before = room();
    readings = k === "readings";
    pro.hidden = k !== "mix";
    exp.hidden = k !== "export";
    sync();
    if (k === "listen" || k === "readings")
      scrollTo({ top: 0, behavior: before === k && !RM.matches ? "smooth" : "auto" });
    if (k === "listen" || k === "readings") requestAnimationFrame(() => dispatchEvent(new Event("resize")));
  });
  rt.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rail]");
    if (!b) return;
    pro.hidden = b.dataset.rail !== "pro";
    exp.hidden = b.dataset.rail !== "exp";
    side.scrollTop = 0;
  });
  // arrow keys move along the rail tabs
  rt.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const bs = [...rt.querySelectorAll("[data-rail]")],
      i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
    n.focus();
    n.click();
    e.preventDefault();
  });
  // a panel opened from anywhere else (top bar, share link, Home) picks its room or rail tab
  const mo = new MutationObserver(() => {
    if (!pro.hidden || !exp.hidden) readings = false;
    if (mode === "rail") side.scrollTop = 0;
    sync();
  });
  [pro, exp].forEach((p) => mo.observe(p, { attributes: true, attributeFilter: ["hidden"] }));
  new MutationObserver(sync).observe(R, { attributes: true, attributeFilter: ["class"] });
  PHONE.addEventListener("change", sync);
  RAIL.addEventListener("change", sync);
  sync();
  return { mode: () => mode, room };
})();
