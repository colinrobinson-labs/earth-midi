/* Earth MIDI · Sleep timer, the way ambient and focus apps do it: pick 15, 30, 60 or 90 minutes in View options
   and the planet fades out over the last 30 seconds, then stops. Stopping by hand cancels it. A dot on
   View options and a countdown in its row show while it's set. Not saved: a timer is for tonight, not forever. */
"use strict";
(() => {
  const pop = $("vPop"),
    box = document.querySelector(".vopt");
  if (!pop || !box) return;
  const FADE = 30,
    MINS = [0, 15, 30, 60, 90];
  let end = 0,
    tick = 0,
    fading = false;

  const row = document.createElement("div");
  row.className = "vrow slrow";
  row.innerHTML =
    `<span>Sleep timer <small id="slLeft"></small></span><div class="seg slseg" role="group" aria-label="Sleep timer">` +
    MINS.map((m) => `<button type="button" data-slp="${m}" aria-pressed="${m === 0}">${m ? m : "Off"}</button>`).join(
      "",
    ) +
    `</div>`;
  pop.appendChild(row);
  const btn = box.querySelector("button");
  if (btn) btn.title = "Weather, Sound follows view, Zones, Sleep timer";
  const left = row.querySelector("#slLeft");

  function sync() {
    const m = end ? Math.max(0, Math.ceil((end - Date.now()) / 6e4)) : 0;
    left.textContent = end ? `· ${m} min left` : "";
    box.classList.toggle("slp", !!end);
  }
  function set(m) {
    row.querySelectorAll("[data-slp]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.slp === m)));
    clearInterval(tick);
    if (fading) restore();
    end = m ? Date.now() + m * 6e4 : 0;
    if (end) {
      tick = setInterval(step, 1000);
      xs(S.on ? `Stopping in ${m} min, with a slow fade` : `Sleep timer set: ${m} min. Press Play`);
    } else xs("Sleep timer off");
    sync();
  }
  function restore() {
    fading = false;
    if (A && S.on) A.out.gain.setTargetAtTime(+$("vol").value, A.ctx.currentTime, 0.3);
  }
  function step() {
    const r = (end - Date.now()) / 1000;
    if (r <= FADE && !fading && S.on && A) {
      fading = true;
      // reach silence just as the timer ends: three time constants is about 95% of the way down
      A.out.gain.setTargetAtTime(0, A.ctx.currentTime, Math.max(1, r) / 3);
    }
    if (r <= 0) {
      clearInterval(tick);
      end = 0;
      fading = false;
      row.querySelectorAll("[data-slp]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.slp === "0")));
      // Play sets the volume back when it starts again
      if (S.on) startStop();
      xs("Sleep timer: stopped");
    }
    sync();
  }
  row.addEventListener("click", (e) => {
    const b = e.target.closest("[data-slp]");
    if (b) set(+b.dataset.slp);
  });
  // stopping by hand ends the timer, so Play later starts fresh at full volume
  let was = S.on;
  new MutationObserver(() => {
    if (was && !S.on && end) set(0);
    was = S.on;
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  const css = document.createElement("style");
  css.textContent = `
.slrow small{font:11px var(--mono);color:var(--o)}
.slseg button{min-width:34px;height:32px;padding:0 8px;font:500 12px var(--body)}
@media (max-width:700px){.vpop .slrow{flex-wrap:wrap}.slseg{flex:1 1 100%;display:flex}.slseg button{flex:1;height:40px;font-size:14px}}
.vopt.slp>button .vdot{display:block}`;
  document.head.appendChild(css);
})();
