/* Earth MIDI · Arrange: make the Producer panel your own desk.
   Press "Arrange" in the Producer header, then drag any card (Mixer strips, Sound / Rhythm / Master / MIDI cards)
   to a new spot, pin a card so it stays first in its tab, or pin single controls into a "Pinned" row that sits
   above the tabs on every tab. Mouse drags anywhere on a card, touch drags by the grip (or a long press on the card),
   and the grip takes arrow keys too. The layout is saved in this browser only (em.lay), never in presets or share
   links: it is how your desk is laid out, not how the planet sounds, so opening someone's link never moves your
   controls. "Reset layout" puts everything back. The sound settings themselves still live in CFG (core.js). */
"use strict";
const ARRANGE = (() => {
  const LS = "em.lay",
    MAXPIN = 12,
    MAXIDS = 60,
    okId = (x) => typeof x === "string" && x.length > 0 && x.length <= 48,
    okTab = (x) => /^[A-Za-z ]{1,16}$/.test(x);
  const blank = () => ({ o: {}, p: {}, c: [] });
  let L = load(),
    on = false,
    curTab = "",
    curGrid = null;

  function load() {
    const d = blank();
    try {
      const j = JSON.parse(localStorage.getItem(LS) || "null");
      if (!j || typeof j !== "object") return d;
      const list = (a, n) => (Array.isArray(a) ? [...new Set(a.filter(okId))].slice(0, n) : []);
      ["o", "p"].forEach((f) => {
        if (j[f] && typeof j[f] === "object" && !Array.isArray(j[f]))
          Object.keys(j[f])
            .filter(okTab)
            .slice(0, 12)
            .forEach((t) => {
              const a = list(j[f][t], MAXIDS);
              if (a.length) d[f][t] = a;
            });
      });
      d.c = list(j.c, MAXPIN);
    } catch (_) {}
    return d;
  }
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify(L));
    } catch (_) {}
  }
  const custom = () => L.c.length > 0 || Object.keys(L.o).length > 0 || Object.keys(L.p).length > 0;

  /* ---------- every control that can be pinned: key -> how to draw it and where it lives ---------- */
  const TABC = { Sound: "var(--c)", Mixer: "var(--o)", Rhythm: "var(--q)", Master: "var(--s)", MIDI: "var(--k)" };
  let reg = null;
  function REG() {
    if (reg) return reg;
    reg = new Map();
    TABS.forEach(([tab, groups]) => {
      if (tab === "Mixer")
        PAN_KEYS.forEach((k) => {
          const c = COLS[k];
          reg.set("vol." + k, { l: "Level", ty: "rng", o: [0, 1.5, 0.05], g: LNAME[k], c, tab });
          reg.set("send." + k, { l: "Reverb send", ty: "rng", o: [0, 1, 0.05], g: LNAME[k], c, tab });
        });
      else
        (groups || []).forEach(([t, cs, lk]) =>
          cs.forEach(([k, l, ty, ...o]) => {
            if (ty === "info" || k === "note" || k === "_" || reg.has(k)) return;
            reg.set(k, { l, ty, o, g: t, c: lk ? COLS[lk] : TABC[tab] || "var(--fg)", tab });
          }),
        );
    });
    return reg;
  }
  const pinned = () => L.c.filter((k) => REG().has(k));

  /* ---------- icons ---------- */
  const sv = (b) => `<svg class="sic" viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
  const IC = {
    pin: sv('<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>'),
    grip: sv(
      '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    ),
    arr: sv(
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 13.5v7M13.5 17h7"/>',
    ),
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    rz: sv('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/>'),
  };

  /* a screen-reader line for keyboard moves */
  let live = null;
  function say(m) {
    if (!live) {
      live = document.createElement("p");
      live.className = "sr-only arlive";
      live.setAttribute("aria-live", "polite");
      document.body.appendChild(live);
    }
    live.textContent = "";
    setTimeout(() => (live.textContent = m), 30);
  }
  const reduce = () => matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* move nodes with a short glide: measure, change the DOM, then animate each node from where it was */
  function flip(nodes, change) {
    const before = new Map(nodes.map((n) => [n, n.getBoundingClientRect()]));
    change();
    if (reduce()) return;
    nodes.forEach((n) => {
      if (n.classList.contains("drg")) return;
      const a = before.get(n),
        b = n.getBoundingClientRect(),
        dx = a.left - b.left,
        dy = a.top - b.top;
      if ((dx || dy) && n.animate)
        n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], {
          duration: 220,
          easing: "cubic-bezier(.2,.8,.2,1)",
        });
    });
  }

  /* ---------- the cards in a tab: saved order, pinned first ---------- */
  const boxes = (g) => [...g.children].filter((e) => e.dataset.box);
  const boxName = (b) =>
    ((b.querySelector(":scope>h5,:scope>b") || {}).textContent || b.dataset.box)
      .replace(/\s*(ch \d+|Reset)\s*$/g, "")
      .trim();
  function order(g, tab, glide) {
    const bs = boxes(g),
      def = new Map(bs.map((b, i) => [b, +(b.dataset.def ?? i)])),
      saved = L.o[tab] || [],
      pins = L.p[tab] || [],
      rank = (b) => {
        const s = saved.indexOf(b.dataset.box);
        return s < 0 ? 1000 + def.get(b) : s;
      };
    bs.forEach((b, i) => b.dataset.def ?? (b.dataset.def = i));
    const sorted = [...bs].sort((a, b) => {
      const pa = pins.includes(a.dataset.box) ? 0 : 1,
        pb = pins.includes(b.dataset.box) ? 0 : 1;
      return pa - pb || rank(a) - rank(b);
    });
    const go = () => {
      sorted.forEach((b) => g.appendChild(b));
      bs.forEach((b) => {
        const p = pins.includes(b.dataset.box);
        b.classList.toggle("pinb", p);
        const pb = b.querySelector(".arp");
        if (pb) {
          pb.setAttribute("aria-pressed", String(p));
          pb.title = p ? `Unpin ${boxName(b)}` : `Pin ${boxName(b)} first in this tab`;
          pb.setAttribute("aria-label", pb.title);
        }
      });
    };
    glide ? flip(bs, go) : go();
  }
  function storeOrder(g, tab) {
    L.o[tab] = boxes(g).map((b) => b.dataset.box);
    save();
    syncHead();
  }

  /* ---------- card toolbar + control pins ---------- */
  function decorate(g, tab) {
    boxes(g).forEach((b) => {
      const h = b.querySelector(":scope>h5,:scope>b");
      if (!h || h.querySelector(".arb")) return;
      const nm = boxName(b),
        t = document.createElement("span");
      t.className = "arb";
      t.innerHTML = `<button type="button" class="arp" aria-pressed="false">${IC.pin}</button><button type="button" class="arg" aria-label="Move ${esc(nm)}: drag, or use the arrow keys" title="Drag to move · arrow keys work too">${IC.grip}</button>`;
      h.appendChild(t);
      const mark = document.createElement("span");
      mark.className = "arpm";
      mark.title = "Pinned";
      mark.innerHTML = IC.pin;
      h.insertBefore(mark, h.querySelector(":scope>.lch,:scope>.rzg,:scope>.arb"));
      t.querySelector(".arp").onclick = (e) => {
        e.stopPropagation();
        const pins = (L.p[tab] = L.p[tab] || []),
          i = pins.indexOf(b.dataset.box);
        i < 0 ? pins.push(b.dataset.box) : pins.splice(i, 1);
        if (!pins.length) delete L.p[tab];
        save();
        order(g, tab, true);
        storeOrder(g, tab);
        say(i < 0 ? `${nm} pinned first` : `${nm} unpinned`);
      };
      t.querySelector(".arg").onkeydown = (e) => {
        const d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const all = boxes(g).filter((x) => x.classList.contains("pinb") === b.classList.contains("pinb")),
          i = all.indexOf(b),
          to = all[i + d];
        if (!to) return say(d < 0 ? `${nm} is already first` : `${nm} is already last`);
        flip(boxes(g), () => (d < 0 ? to.before(b) : to.after(b)));
        storeOrder(g, tab);
        e.target.focus();
        say(`${nm} moved to ${all.indexOf(to) + 1} of ${all.length}`);
      };
    });
    g.querySelectorAll(".pc").forEach((pc) => {
      const el = pc.querySelector(":scope>[data-t][data-k]");
      if (!el || pc.querySelector(":scope>.arc") || !REG().has(el.dataset.k)) return;
      const k = el.dataset.k,
        r = REG().get(k),
        b = document.createElement("button");
      b.type = "button";
      b.className = "arc";
      b.dataset.pk = k;
      b.innerHTML = IC.pin;
      pc.appendChild(b);
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        pinCtl(k);
      };
      const lab = `${r.g} ${r.l}`;
      b.dataset.lab = lab;
    });
    syncPins();
  }
  function syncPins() {
    const ps = pinned();
    document.querySelectorAll("#pgrid .arc").forEach((b) => {
      const p = ps.includes(b.dataset.pk);
      b.setAttribute("aria-pressed", String(p));
      b.title = p ? `Unpin ${b.dataset.lab}` : `Pin ${b.dataset.lab} to the top`;
      b.setAttribute("aria-label", b.title);
      b.closest(".pc").classList.toggle("pinc", p);
    });
  }
  function pinCtl(k) {
    const i = L.c.indexOf(k),
      r = REG().get(k);
    if (i < 0) {
      if (pinned().length >= MAXPIN) return xs(`Up to ${MAXPIN} pinned controls`);
      L.c.push(k);
    } else L.c.splice(i, 1);
    save();
    dock(i < 0 ? k : null);
    syncPins();
    syncHead();
    if (r) say(i < 0 ? `${r.g} ${r.l} pinned to the top` : `${r.g} ${r.l} unpinned`);
  }

  /* ---------- the Pinned row above the tabs ---------- */
  function dock(fresh) {
    const pro = $("pro"),
      tabs = $("ptabs");
    if (!pro || !tabs) return;
    let d = $("ppin");
    if (!d) {
      d = document.createElement("div");
      d.id = "ppin";
      d.className = "ppin";
      d.setAttribute("role", "region");
      d.setAttribute("aria-label", "Pinned controls");
      tabs.before(d);
      sortable(
        d,
        ".ppc",
        () => true,
        () => {
          L.c = [...d.querySelectorAll(".ppc")].map((x) => x.dataset.pk);
          save();
        },
      );
    }
    const ps = pinned();
    d.hidden = !ps.length && !on;
    d.classList.toggle("empty", !ps.length);
    d.innerHTML =
      `<div class="pph">${IC.pin}<b>Pinned</b><small>${ps.length ? `${ps.length} control${ps.length > 1 ? "s" : ""} · on every tab` : "Pin any control with its pin and it lives here, on every tab"}</small></div>` +
      (ps.length
        ? `<div class="ppl">${ps
            .map((k) => {
              const r = REG().get(k);
              return `<div class="ppc${fresh === k ? " new" : ""}" data-pk="${esc(k)}" style="--ac:${r.c}"><small><i></i>${esc(r.g)}</small>${ctl(k, r.l, r.ty, r.o, "pin_")}<button type="button" class="arx" aria-label="Unpin ${esc(r.g)} ${esc(r.l)}" title="Unpin">${IC.x}</button><button type="button" class="arg" aria-label="Move ${esc(r.g)} ${esc(r.l)}: drag, or use the arrow keys" title="Drag to move · arrow keys work too">${IC.grip}</button></div>`;
            })
            .join("")}</div>`
        : "");
    const ppl = d.querySelector(".ppl");
    if (ppl) {
      bindCtls(ppl);
      STUDIO.enhance(ppl);
      ppl.querySelectorAll(".arx").forEach((b) => (b.onclick = () => pinCtl(b.closest(".ppc").dataset.pk)));
      ppl.querySelectorAll(".arg").forEach(
        (b) =>
          (b.onkeydown = (e) => {
            const dd = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
            if (!dd) return;
            e.preventDefault();
            const c = b.closest(".ppc"),
              all = [...ppl.children],
              to = all[all.indexOf(c) + dd];
            if (!to) return;
            flip(all, () => (dd < 0 ? to.before(c) : to.after(c)));
            L.c = [...ppl.children].map((x) => x.dataset.pk);
            save();
            b.focus();
            say(`Moved to ${[...ppl.children].indexOf(c) + 1} of ${all.length}`);
          }),
      );
    }
  }

  /* ---------- dragging: mouse anywhere on a card, touch by the grip or a long press ---------- */
  let drag = null;
  function sortable(box, sel, same, done) {
    box.addEventListener("pointerdown", (e) => {
      if (!on || drag || e.button > 0) return;
      const it = e.target.closest(sel);
      if (!it || it.parentElement !== (box.querySelector(":scope>.ppl") || box) || !box.contains(it)) return;
      const grip = e.target.closest(".arg");
      if (!grip && e.target.closest("button,input,select,a,.segc,.piano,.stp")) return;
      if (e.pointerType === "touch" && !grip) {
        // a long press lifts the card, so a normal swipe still scrolls the panel
        const x0 = e.clientX,
          y0 = e.clientY,
          id = e.pointerId;
        let lx = x0,
          ly = y0;
        const mv = (m) => {
            if (m.pointerId !== id) return;
            lx = m.clientX;
            ly = m.clientY;
            if (Math.hypot(lx - x0, ly - y0) > 8) stop();
          },
          stop = () => {
            clearTimeout(t);
            removeEventListener("pointermove", mv);
            removeEventListener("pointerup", stop);
            removeEventListener("pointercancel", stop);
          },
          t = setTimeout(() => {
            stop();
            if (navigator.vibrate) navigator.vibrate(8);
            start(box, it, sel, same, done, lx, ly, id);
          }, 340);
        addEventListener("pointermove", mv);
        addEventListener("pointerup", stop);
        addEventListener("pointercancel", stop);
        return;
      }
      e.preventDefault();
      start(box, it, sel, same, done, e.clientX, e.clientY, e.pointerId);
    });
  }
  function scroller(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 4) return p;
    }
    return document.scrollingElement;
  }
  function start(box, it, sel, same, done, x, y, pid) {
    const r = it.getBoundingClientRect(),
      wrap = it.parentElement;
    drag = {
      box,
      wrap,
      it,
      sel,
      same,
      done,
      gx: x - r.left,
      gy: y - r.top,
      x,
      y,
      pid,
      sc: scroller(it),
      last: null,
      raf: 0,
    };
    it.classList.add("drg");
    box.classList.add("sorting");
    document.documentElement.classList.add("ar-dragging");
    place();
    addEventListener("pointermove", onMove, { passive: false });
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
    addEventListener("touchmove", noScroll, { passive: false });
    drag.raf = requestAnimationFrame(edge);
  }
  const noScroll = (e) => drag && e.cancelable && e.preventDefault();
  function place() {
    const d = drag,
      it = d.it;
    it.style.transform = "";
    const n = it.getBoundingClientRect();
    it.style.transform = `translate(${d.x - d.gx - n.left}px,${d.y - d.gy - n.top}px) scale(1.015)`;
  }
  function onMove(e) {
    const d = drag;
    if (!d || e.pointerId !== d.pid) return;
    e.preventDefault();
    d.x = e.clientX;
    d.y = e.clientY;
    // the edge scroll waits for a real move, so picking up a card near the bottom doesn't run the page away
    if (!d.moved && Math.hypot(d.x - d.x0, d.y - d.y0) > 6) d.moved = true;
    hover();
  }
  function hover() {
    const d = drag,
      under = document.elementFromPoint(d.x, d.y),
      to = under && under.closest(d.sel);
    if (!to || to === d.it || to.parentElement !== d.wrap || !d.same(to, d.it)) {
      if (to !== d.last) d.last = null;
      return place();
    }
    if (to === d.last) return place();
    d.last = to;
    const kids = [...d.wrap.children],
      after = kids.indexOf(d.it) < kids.indexOf(to);
    flip(
      kids.filter((k) => k.matches(d.sel)),
      () => (after ? to.after(d.it) : to.before(d.it)),
    );
    place();
  }
  function edge() {
    const d = drag;
    if (!d) return;
    const s = d.sc,
      top = s === document.scrollingElement ? 0 : s.getBoundingClientRect().top,
      bot = s === document.scrollingElement ? innerHeight : s.getBoundingClientRect().bottom,
      z = 56;
    let v = 0;
    if (d.moved && d.y < top + z) v = -Math.ceil((top + z - d.y) / 4);
    else if (d.moved && d.y > bot - z) v = Math.ceil((d.y - bot + z) / 4);
    if (v) {
      s.scrollTop += v;
      hover();
    }
    d.raf = requestAnimationFrame(edge);
  }
  function onUp(e) {
    const d = drag;
    if (!d || (e.pointerId !== undefined && e.pointerId !== d.pid)) return;
    drag = null;
    cancelAnimationFrame(d.raf);
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("pointercancel", onUp);
    removeEventListener("touchmove", noScroll);
    const it = d.it,
      from = it.style.transform;
    it.style.transform = "";
    it.classList.remove("drg");
    d.box.classList.remove("sorting");
    document.documentElement.classList.remove("ar-dragging");
    if (!reduce() && it.animate && from)
      it.animate([{ transform: from }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" });
    d.done();
  }

  /* ---------- header: Arrange / Done and Reset layout ---------- */
  let head = null;
  function syncHead() {
    const h = document.querySelector("#pro h2");
    if (!h) return;
    if (!head || !document.contains(head)) {
      head = document.createElement("span");
      head.className = "arh";
      head.innerHTML = `<button type="button" class="arbtn" aria-pressed="false">${IC.arr}<span>Arrange</span></button><button type="button" class="arrz" hidden>${IC.rz}<span>Reset layout</span></button>`;
      const st = $("pstat");
      st ? h.insertBefore(head, st) : h.appendChild(head);
      head.querySelector(".arbtn").onclick = () => set(!on);
      head.querySelector(".arrz").onclick = resetLayout;
    } else {
      // the Reset chips are added later; keep Arrange right after them
      const rz = h.querySelector(".przh");
      if (rz && rz.nextSibling !== head) rz.after(head);
    }
    const b = head.querySelector(".arbtn"),
      rz = head.querySelector(".arrz"),
      arrangeable = curTab && curTab !== "Presets";
    b.hidden = !arrangeable && !on;
    b.setAttribute("aria-pressed", String(on));
    b.querySelector("span").textContent = on ? "Done" : "Arrange";
    b.title = on ? "Finish arranging" : "Drag cards around and pin your favourite controls";
    rz.hidden = !(on && custom());
    rz.title = "Put every card and pin back where it started";
  }
  function set(v) {
    on = !!v;
    const pro = $("pro");
    if (pro) pro.classList.toggle("arr", on);
    dock();
    syncHead();
    if (on) xs("Arrange: drag cards to move them, tap a pin to keep it up top");
  }
  function resetLayout() {
    L = blank();
    save();
    if (curGrid) {
      order(curGrid, curTab, true);
      syncPins();
    }
    dock();
    syncHead();
    xs("Layout back to the original");
  }

  /* called at the end of buildPro() in ui.js */
  function after(g, tab) {
    curTab = tab;
    curGrid = g;
    if (tab !== "Presets") {
      decorate(g, tab);
      order(g, tab, false);
      if (!g._ar) {
        g._ar = 1;
        sortable(
          g,
          "[data-box]",
          (a, b) => a.classList.contains("pinb") === b.classList.contains("pinb"),
          () => storeOrder(g, curTab),
        );
      }
    } else if (on) set(false);
    dock();
    syncHead();
  }

  const css = `
.arh{display:inline-flex;align-items:center;gap:6px}
.arh button{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px 0 8px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--mute);font:600 10.5px var(--mono);letter-spacing:.04em;text-transform:none;cursor:pointer}
.arh button[hidden]{display:none}
.arh .sic{width:14px;height:14px}
.arh button:hover,.arh button:focus-visible{color:var(--fg);border-color:var(--line3)}
.arh .arbtn[aria-pressed="true"]{background:var(--fg);border-color:var(--fg);color:var(--bg)}
/* card toolbar: only while arranging */
.arb{display:none;align-items:center;gap:2px;margin:-4px -4px -4px 6px;flex:none}
.mixer .strip>b .arb{margin-left:auto}
.pgrp>h5 .arb{margin-left:auto}
.pro.arr .arb{display:inline-flex}
.pro.arr :is(.pgrp,.strip)>:is(h5,b)>.rzg{display:none}
.arb button,.ppc .arg,.ppc .arx{display:grid;place-items:center;width:28px;height:28px;padding:0;margin:0;border:0;border-radius:8px;background:transparent;color:var(--mute);cursor:pointer;flex:none}
.arb .sic,.ppc .arg .sic,.ppc .arx .sic{width:15px;height:15px}
.arb button:hover,.arb button:focus-visible,.ppc .arg:hover,.ppc .arx:hover{color:var(--fg);background:color-mix(in srgb,var(--ac,var(--fg)) 16%,transparent)}
.arb .arp[aria-pressed="true"]{color:var(--ac,var(--fg))}
.arb .arp[aria-pressed="true"] .sic,.arpm .sic,.arc[aria-pressed="true"] .sic,.pph .sic{fill:currentColor;fill-opacity:.35}
.arg{cursor:grab;touch-action:none}
.arg circle{fill:currentColor;stroke:none}
/* pinned cards keep a small pin by their name */
.arpm{display:none;color:var(--ac,var(--fg));flex:none}
.arpm .sic{width:12px;height:12px}
.pinb .arpm{display:inline-flex}
.pro.arr .pinb .arpm{display:none}
.pinb{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac,var(--fg)) 38%,transparent)}
/* arranging: cards lift, controls rest */
.pro.arr #pgrid [data-box]{cursor:grab;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;outline:1px dashed color-mix(in srgb,var(--ac,var(--fg)) 34%,transparent);outline-offset:-1px;animation:arIn .35s ease-out}
.pro.arr #pgrid [data-box] .pc>:is(input,select,output,.segc,.piano,.stp,span){pointer-events:none;opacity:.55}
.pro.arr #pgrid [data-box] .ms{pointer-events:none;opacity:.55}
.pro.arr #pgrid .pmore{pointer-events:none;opacity:.5}
.pro.arr #pgrid .pc{border-radius:8px;transition:background .2s}
.pro.arr #pgrid .pc.pinc{background:color-mix(in srgb,var(--ac,var(--fg)) 10%,transparent)}
.arc{display:none}
.pro.arr #pgrid .pc:has(>.arc){padding-right:32px}
.pro.arr .pc>.arc{display:grid;place-items:center;position:absolute;right:0;top:50%;margin-top:-13px;width:26px;height:26px;padding:0;margin:0;border:0;border-radius:50%;background:var(--sf2,var(--sf1));color:var(--mute);box-shadow:0 0 0 1px var(--line2);cursor:pointer;z-index:2}
.pro.arr .pc>.arc .sic{width:13px;height:13px}
.pro.arr .pc>.arc[aria-pressed="true"]{color:var(--ac,var(--fg));box-shadow:0 0 0 1px color-mix(in srgb,var(--ac,var(--fg)) 60%,transparent)}
.pro.arr .pc>.arc:hover,.pro.arr .pc>.arc:focus-visible{color:var(--fg)}
.pro.arr .pc>.rz{display:none!important}
.drg{position:relative;z-index:30;pointer-events:none;cursor:grabbing;box-shadow:0 18px 40px rgba(0,0,0,.55),0 0 0 1px color-mix(in srgb,var(--ac,var(--fg)) 60%,transparent)!important;opacity:.96;transition:box-shadow .2s}
html.ar-dragging,html.ar-dragging *{cursor:grabbing!important}
html.ar-dragging{-webkit-user-select:none;user-select:none}
@keyframes arIn{from{outline-color:transparent}}
/* the Pinned row */
.ppin{margin:0 0 12px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:var(--r2,14px);background:linear-gradient(180deg,color-mix(in srgb,var(--fg) 4%,var(--sf1)),var(--sf1))}
.ppin[hidden]{display:none}
.pph{display:flex;align-items:center;gap:8px;font:600 12px var(--body);color:var(--fg)}
.pph .sic{width:14px;height:14px;color:var(--fg)}
.pph small{font:500 10.5px var(--mono);color:var(--mute);letter-spacing:.02em}
.ppin.empty{border-style:dashed;background:transparent}
.ppl{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-top:9px}
.ppc{--ac:var(--fg);position:relative;padding:7px 10px 8px;border-radius:10px;border:1px solid color-mix(in srgb,var(--ac) 26%,var(--line));background:radial-gradient(120% 90% at 0% 0%,color-mix(in srgb,var(--ac) 10%,transparent),transparent 70%),var(--sf1);animation:ppIn .3s ease-out}
.ppc::before{content:"";position:absolute;left:10px;right:10px;top:0;height:2px;border-radius:2px;background:var(--ac);opacity:.8}
.ppc>small{display:flex;align-items:center;gap:6px;font:600 9.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin:1px 0 2px;padding-right:56px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ppc>small i{width:6px;height:6px;border-radius:50%;background:var(--ac);box-shadow:0 0 6px var(--ac);flex:none}
.ppc .pc{margin:0}
.ppc .arg,.ppc .arx{position:absolute;top:2px;width:26px;height:26px;display:none}
.ppc .arx{right:2px}.ppc .arg{right:28px}
.pro.arr .ppc .arg,.pro.arr .ppc .arx{display:grid}
.pro.arr .ppc{cursor:grab}
:is(html.desk,html.room-panel) .ppl{max-height:34vh;overflow:auto;overscroll-behavior:contain}
.ppc.new{animation:ppNew .6s ease-out}
@keyframes ppIn{from{opacity:0;transform:translateY(4px)}}
@keyframes ppNew{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ac) 70%,transparent)}100%{box-shadow:0 0 0 10px transparent}}
@media (max-width:700px){.ppl{grid-template-columns:1fr 1fr}.ppc>small{padding-right:0}.pro.arr .ppc>small{padding-right:56px}}
@media (prefers-reduced-motion:reduce){.ppc,.ppc.new,.pro.arr #pgrid [data-box]{animation:none}}
`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  return {
    after,
    set,
    reset: resetLayout,
    get on() {
      return on;
    },
    layout: () => clone(L),
  };
})();
