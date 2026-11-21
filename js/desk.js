/* Earth MIDI · Desk: Producer and Export open over the page instead of inside it.
   Before, opening Producer pushed it into the page above the globe and scrolled you there, so the globe left the
   screen and getting back meant scrolling or finding the same button again. Now:
     phone and tablet (up to 1023 px)  a sheet slides up from the bottom (above the phone dock, so Play, Ambient/Pulse
                                       and Record stay in reach). Title and tabs stay pinned, only the controls scroll.
                                       Close with ×, a tap on the dimmed page, a drag down on the handle, Escape,
                                       or the phone's Back gesture.
     desktop (1024 px and up)          a drawer on the right. The globe stays visible and playable beside it.
                                       Close with ×, Escape or the same button that opened it.
   One panel at a time. The page stays where you left it. Folded phones keep their own layout (js/fold.js),
   and so do the embed and Simple views. */
"use strict";
const DESK = (() => {
  const R = document.documentElement,
    panes = [$("pro"), $("exp")].filter(Boolean),
    SHEET = matchMedia("(max-width:1023px)"),
    RM = matchMedia("(prefers-reduced-motion: reduce)");
  if (!panes.length) return { wants: () => false };
  const css = document.createElement("style");
  css.textContent = `
html.desk .pro:not([hidden]){position:fixed;z-index:62;margin:0;display:flex;flex-direction:column;overflow:hidden;background:var(--panel);box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 0 1px var(--line2)}
html.desk .pro>h2,html.desk .pro>.exph{position:static;flex:none;margin:0 0 8px;padding-right:46px;flex-wrap:wrap;justify-content:flex-start}
html.desk .pro>h2 small,html.desk .pro>.exph small{flex-basis:100%}
html.desk #ptabs{flex:none;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -14px 8px;padding:2px 14px 6px}
html.desk #ptabs::-webkit-scrollbar{display:none}
html.desk #ptabs button{flex:none}
html.desk #pgrid,html.desk #exp>.exp{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;margin:0 -14px;padding:0 14px 16px;grid-auto-rows:max-content;align-content:start}
html.desk #pgrid.mas{columns:auto}
html.desk-side #pgrid.mas{columns:2 250px}
@media (min-width:761px){html.desk-sheet #pgrid.mas{columns:2 250px}}
html.desk .fold-close{display:inline-grid;place-items:center;position:absolute;right:max(14px,env(safe-area-inset-right,0px));top:12px;margin:0;width:38px;height:38px;border-radius:12px}
html.desk-sheet .fold-close{top:26px}
html.desk #homeBtn{display:none!important}
.desk-grip{display:none}
.dock .db[data-jump="exp"][aria-expanded="true"]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
html.desk-sheet .pro:not([hidden]){left:0;right:0;bottom:var(--ddock,0px);top:var(--dtop);border-radius:20px 20px 0 0;border:0;
  padding:0 max(14px,env(safe-area-inset-right,0px)) 0 max(14px,env(safe-area-inset-left,0px));animation:deskUp .38s cubic-bezier(.2,1,.3,1)}
html.desk-sheet .desk-grip{display:block;flex:none;height:22px;margin:0 -14px;cursor:grab;touch-action:none;position:relative}
html.desk-sheet .desk-grip::after{content:"";position:absolute;left:50%;top:9px;width:42px;height:5px;margin-left:-21px;border-radius:3px;background:var(--line2)}
html.desk-sheet body{overflow:hidden}
html.desk-sheet .dock{z-index:63}
html.desk-sheet{--dtop:calc(env(safe-area-inset-top,0px) + 9vh)}
@media (min-width:761px){html.desk-sheet{--dtop:34vh}html.desk-sheet .pro:not([hidden]){left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));border-radius:20px 20px 0 0}}
html.desk-side .pro:not([hidden]){top:12px;bottom:12px;right:max(12px,env(safe-area-inset-right,0px));width:min(600px,calc(100vw - 420px));border-radius:var(--r3);
  padding:14px 16px 0;animation:deskIn .34s cubic-bezier(.2,1,.3,1)}
@media (min-width:1500px){html.desk-side .pro:not([hidden]){width:min(680px,38vw)}}
/* desktop: the page moves over to make room, so the globe, the player bar and its buttons stay in view and usable */
html.desk-side body{padding-right:calc(var(--dw) + 12px);transition:padding .34s cubic-bezier(.2,1,.3,1)}
html.desk-side{--dw:min(600px,calc(100vw - 420px));--pw:calc(100vw - var(--dw) - 12px)}
@media (min-width:1500px){html.desk-side{--dw:min(680px,38vw)}}
html.desk-side .pro:not([hidden]){width:var(--dw)}
@media (max-width:1699px){html.desk-side .main{grid-template-columns:minmax(0,1fr)}html.desk-side .side{position:static;max-height:none}}
.desk-scrim{position:fixed;inset:0;z-index:61;background:rgba(3,5,8,.5);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .3s}
html.desk-sheet .desk-scrim{opacity:1;pointer-events:auto}
@keyframes deskUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes deskIn{from{transform:translateX(36px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){html.desk .pro:not([hidden]){animation:none}.desk-scrim{transition:none}}
`;
  document.head.appendChild(css);
  const scrim = document.createElement("div");
  scrim.className = "desk-scrim";
  scrim.setAttribute("aria-hidden", "true");
  document.body.appendChild(scrim);

  // folded phones, Simple and embed keep their own layouts
  const wants = () => !/\b(fold-book|fold-tent|simple|embed)\b/.test(R.className);
  const open = () => panes.find((p) => !p.hidden);
  let pushed = false;
  const close = () => panes.forEach((p) => (p.hidden = true));

  // the sheet ends where the phone dock begins
  const dock = document.querySelector(".dock");
  const dockH = () => {
    let h = 0;
    if (dock) {
      const r = dock.getBoundingClientRect();
      if (r.height) h = Math.max(0, Math.round(innerHeight - r.top));
    }
    R.style.setProperty("--ddock", h + "px");
  };
  if (dock && window.ResizeObserver) new ResizeObserver(dockH).observe(dock);

  function sync() {
    const p = wants() && open(),
      sheet = !!p && SHEET.matches;
    R.classList.toggle("desk", !!p);
    R.classList.toggle("desk-sheet", sheet);
    R.classList.toggle("desk-side", !!p && !sheet);
    if (sheet) dockH();
    // the phone's Back gesture closes the sheet instead of leaving the site
    if (sheet && !pushed) {
      try {
        history.pushState({ desk: 1 }, "");
        pushed = true;
      } catch (_) {}
    } else if (!sheet && pushed) {
      pushed = false;
      if (history.state && history.state.desk) history.back();
    }
  }
  addEventListener("popstate", () => {
    if (pushed) {
      pushed = false;
      close();
    }
  });

  // one at a time: opening Export closes Producer and the other way round
  const mo = new MutationObserver((recs) => {
    recs.forEach((r) => {
      if (!r.target.hidden && wants()) panes.forEach((p) => p !== r.target && !p.hidden && (p.hidden = true));
    });
    sync();
  });
  panes.forEach((p) => {
    mo.observe(p, { attributes: true, attributeFilter: ["hidden"] });
    const g = document.createElement("div");
    g.className = "desk-grip";
    g.setAttribute("aria-hidden", "true");
    p.prepend(g);
    // drag the handle down to put the sheet away
    let y0 = null,
      dy = 0;
    g.addEventListener("pointerdown", (e) => {
      y0 = e.clientY;
      dy = 0;
      g.setPointerCapture(e.pointerId);
      p.style.transition = "none";
    });
    g.addEventListener("pointermove", (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.clientY - y0);
      p.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      p.style.transition = RM.matches ? "none" : "transform .25s cubic-bezier(.2,1,.3,1)";
      if (dy > 90) {
        p.style.transform = "translateY(100%)";
        setTimeout(() => {
          p.hidden = true;
          p.style.transform = p.style.transition = "";
        }, 200);
      } else p.style.transform = "";
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
  });
  scrim.addEventListener("click", close);
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !R.classList.contains("desk") || document.querySelector("dialog[open]")) return;
    close();
  });
  SHEET.addEventListener("change", sync);
  new MutationObserver(sync).observe(R, { attributes: true, attributeFilter: ["class"] });
  sync();
  return { wants, close };
})();
