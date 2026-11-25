/* Earth MIDI · keyboard shortcuts: "?" shows every shortcut on one card (the way Ableton, Logic and Figma do),
   plus L to jump to live and C to open the Console. The other single keys live with what they control:
   space / g / f / p in ui.js, w in weather.js, z / h in god.js, Cmd+Z in history.js. */
"use strict";
(() => {
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    M = MAC ? "⌘" : "Ctrl+";
  const LIST = [
    [
      "Play",
      [
        ["Space", "Play / stop"],
        ["P", "Ambient / Pulse"],
        ["L", "Jump to live"],
      ],
    ],
    [
      "Sound",
      [
        [`${M}Z`, "Undo"],
        [MAC ? "⇧⌘Z" : "Ctrl+Y", "Redo"],
        ["Double-click a slider", "Back to default"],
      ],
    ],
    [
      "Layers",
      [
        ["Tap a layer name", "Mute"],
        ["Hold a layer name", "Solo"],
        ["Enter / S on a layer", "Mute / solo"],
      ],
    ],
    [
      "View",
      [
        ["G / F", "Globe / flat map"],
        ["W", "Live weather on / off"],
        ["Z", "Zeus Mode"],
        ["C", "Console"],
        ["Esc", "Close what's open"],
      ],
    ],
  ];
  const kbd = (s) =>
    /^(Tap|Hold|Double|Enter)/.test(s)
      ? `<span class="kx">${s}</span>`
      : s
          .split(" / ")
          .map((x) => `<kbd>${x}</kbd>`)
          .join(" / ");
  let d = null;
  function show() {
    if (d && d.open) return d.close();
    if (document.querySelector("dialog[open]")) return;
    const back = document.activeElement;
    d = document.createElement("dialog");
    d.className = "emd kbs";
    d.setAttribute("aria-labelledby", "kbsH");
    d.innerHTML =
      `<h3 id="kbsH">Keyboard shortcuts</h3>` +
      LIST.map(
        ([h, rows]) =>
          `<section><h4>${h}</h4><dl>${rows.map(([k, w]) => `<div><dt>${kbd(k)}</dt><dd>${w}</dd></div>`).join("")}</dl></section>`,
      ).join("") +
      `<div class="row"><button type="button" class="go2">Got it</button></div>`;
    const close = () => {
      try {
        d.close();
      } catch (_) {}
    };
    d.addEventListener("close", () => {
      d.remove();
      if (back && back.focus && document.contains(back)) back.focus();
    });
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest(".go2")) close();
    });
    d.addEventListener("keydown", (e) => {
      if (e.key === "?") {
        e.preventDefault();
        close();
      } else if (e.key !== "Escape") e.stopPropagation();
    });
    document.body.appendChild(d);
    d.showModal ? d.showModal() : d.setAttribute("open", "");
    d.querySelector(".go2").focus();
  }
  addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && t.matches && t.matches("input,select,textarea")) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "?") {
      e.preventDefault();
      show();
    } else if (e.key === "l" && typeof goLive === "function") goLive();
    else if (e.key === "c" && typeof CONSOLE !== "undefined" && !CONSOLE.isOpen) CONSOLE.open();
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-keys]");
    if (!a) return;
    e.preventDefault();
    show();
  });
  const css = document.createElement("style");
  css.textContent = `
.kbs{width:min(520px,calc(var(--pw,100vw) - 32px))}
.kbs section{margin:0 0 12px}
.kbs h4{font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 4px}
.kbs dl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}
.kbs dl>div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--line)}
.kbs dt{order:2;white-space:nowrap;font:12px var(--mono);color:var(--mute)}
.kbs dd{margin:0;font:13px var(--body)}
.kbs kbd{display:inline-block;min-width:20px;padding:2px 6px;border:1px solid var(--line2);border-bottom-width:2px;border-radius:6px;background:var(--sf0);color:var(--fg);font:600 11.5px var(--mono);text-align:center}
.kbs .kx{font-size:11px}
.kbs dl>div:has(.kx){grid-column:1/-1}
@media (max-width:520px){.kbs dl{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
})();
