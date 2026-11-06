/* Earth MIDI · first-visit welcome: what this is, and how to start (Ambient, Pulse, or silent).
   Shows on every fresh visit, last choice pre-selected. Never shows over a shared link (#s=…, #zeus, #how …). Reopen with #welcome or the footer link. */
"use strict";
(()=>{
  const KEY="em.welcome",CHOICES=["ambient","pulse","silent"];
  let saved=null;try{saved=localStorage.getItem(KEY)}catch(_){}
  const hash=location.hash.replace(/^#/,"");
  // returning visitor: keep the style they started with last time (a shared session link sets its own)
  if((saved==="pulse"||saved==="ambient")&&!/^s=/.test(hash)&&S.style!==saved)setStyle(saved);

  const css=`
#wlc{border:0;padding:0;margin:auto;background:transparent;color:var(--fg);max-width:min(520px,calc(100vw - 32px));width:100%;max-height:calc(100dvh - 32px);overflow:visible}
#wlc::backdrop{background:rgba(5,7,10,.66);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
#wlc[open]{animation:wlcIn .55s cubic-bezier(.2,.8,.2,1) both}#wlc[open]::backdrop{animation:wlcFade .5s ease both}
#wlc.out{animation:wlcOut .32s ease both}#wlc.out::backdrop{animation:wlcFade .32s ease reverse both}
@keyframes wlcIn{from{opacity:0;transform:translateY(14px)}}@keyframes wlcOut{to{opacity:0;transform:translateY(8px)}}@keyframes wlcFade{from{opacity:0}}
.wlc-card{position:relative;background:var(--panel);border:1px solid var(--line2);border-radius:var(--r3);padding:26px 24px 18px;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:auto;max-height:calc(100dvh - 32px)}
.wlc-card::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--spectrum);opacity:.85}
.wlc-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:10px;border:1px solid transparent;background:none;color:var(--mute);font:20px/1 var(--body);cursor:pointer}
.wlc-x:hover{color:var(--fg);border-color:var(--line2)}
.wlc-h{font:800 30px/1 var(--disp);letter-spacing:.01em;margin:0 0 12px}
.wlc-h span{color:var(--c_)}
.wlc-p{font:15px/1.5 var(--body);color:var(--fg);margin:0 0 10px;max-width:44ch}
.wlc-fine{font:12.5px/1.5 var(--body);color:var(--mute);margin:0 0 6px}
.wlc-why{margin:0 0 8px;font:12.5px/1.5 var(--body);color:var(--mute)}
.wlc-why summary{cursor:pointer;color:var(--fg);list-style:none;display:inline-block;border-bottom:1px dashed var(--line2)}.wlc-why summary::-webkit-details-marker{display:none}
.wlc-why summary::after{content:" +";color:var(--mute)}.wlc-why[open] summary::after{content:" −"}
.wlc-why p{margin:6px 0 0;padding:8px 10px;border-left:2px solid var(--s);background:var(--sf1);border-radius:0 8px 8px 0}.wlc-why a{color:var(--fg)}
.wlc-live{font:11px/1.55 var(--mono);color:var(--mute);margin:0 0 18px;min-height:1.55em}
.wlc-live b{color:var(--fg);font-weight:500}.wlc-live i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--k);margin-right:7px;vertical-align:1px;animation:wlcBlink 2s ease-in-out infinite}
@keyframes wlcBlink{50%{opacity:.25}}
.wlc-opts{display:grid;gap:8px}
.wlc-o{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:14px;width:100%;text-align:left;padding:13px 14px;border-radius:var(--r2);border:1px solid var(--line2);background:var(--panel2);color:var(--fg);cursor:pointer;font:inherit;transition:border-color .15s,background .15s,transform .15s}
.wlc-o:hover,.wlc-o:focus-visible{border-color:var(--oc);background:var(--sf3);outline:none}.wlc-o:active{transform:scale(.99)}
.wlc-o b{display:block;font:700 15px var(--disp);letter-spacing:0}
.wlc-o small{display:block;font:13px/1.4 var(--body);color:var(--mute);margin-top:2px}
.wlc-o .go-ar{font:16px var(--mono);color:var(--mute);transition:transform .15s,color .15s}.wlc-o:hover .go-ar{transform:translateX(3px);color:var(--oc)}
.wlc-g{position:relative;width:44px;height:44px;border-radius:8px;background:var(--sf1);border:1px solid var(--line);overflow:hidden}
.g-amb i{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:1.5px solid var(--o);opacity:0;animation:wlcRing 4.2s ease-out infinite}
.g-amb i:nth-child(2){animation-delay:1.4s}.g-amb i:nth-child(3){animation-delay:2.8s}
.g-amb::after{content:"";position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;background:var(--o)}
@keyframes wlcRing{0%{transform:scale(.15);opacity:.9}100%{transform:scale(1.25);opacity:0}}
.g-pul{display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:10px 0}
.g-pul i{width:5px;height:24px;border-radius:2px;background:var(--line2);animation:wlcStep 2s steps(1) infinite}
.g-pul i:nth-child(1){animation-name:wlcStepK}.g-pul i:nth-child(2){animation-delay:.25s}.g-pul i:nth-child(3){animation-delay:.5s;animation-name:wlcStepK}.g-pul i:nth-child(4){animation-delay:.75s}
.g-pul i:nth-child(5){animation-delay:1s;animation-name:wlcStepK}.g-pul i:nth-child(6){animation-delay:1.25s}
@keyframes wlcStep{0%{background:var(--s);height:14px}12.5%,100%{background:var(--line2);height:10px}}
@keyframes wlcStepK{0%{background:var(--q);height:24px}12.5%,100%{background:var(--line2);height:16px}}
.g-sil svg{position:absolute;inset:0;margin:auto;width:22px;height:22px;fill:none;stroke:var(--mute);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.wlc-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;font:11px/1.5 var(--mono);color:var(--mute)}
.wlc-foot a{color:var(--mute)}.wlc-foot a:hover{color:var(--fg)}
@media (max-width:700px){
 #wlc{margin:auto auto max(16px,env(safe-area-inset-bottom,0px))}
 .wlc-card{padding:22px 16px 14px;border-radius:16px}.wlc-h{font-size:26px}.wlc-p{font-size:14px}
 .wlc-o{grid-template-columns:40px 1fr auto;gap:12px;padding:11px 12px}.wlc-g{width:40px;height:40px}.wlc-live{margin-bottom:14px}}
@media (prefers-reduced-motion:reduce){#wlc[open],#wlc.out,#wlc::backdrop{animation:none!important}.g-amb i,.g-pul i,.wlc-live i{animation:none}.g-amb i:first-child{opacity:.6;transform:scale(.8)}}`;
  const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

  const title="EARTH MIDI".split("").map((ch,i)=>ch===" "?" ":`<span style="--c_:${COLS[TL_LAYERS[(i>5?i-1:i)%TL_LAYERS.length]]}">${ch}</span>`).join("");
  const d=document.createElement("dialog");d.id="wlc";d.setAttribute("aria-labelledby","wlcH");
  d.innerHTML=`<div class="wlc-card">
  <button class="wlc-x" data-c="silent" aria-label="Close and enter silently">×</button>
  <h2 class="wlc-h" id="wlcH" aria-label="Earth MIDI">${title}</h2>
  <p class="wlc-p">The planet, played live. Earthquakes, solar wind, ocean swell, tides, the ISS and more, turned into sound and MIDI as they happen.</p>
  <p class="wlc-fine">AI helped design and build this site, including the rules that turn data into sound. But no AI runs while you listen: every note comes from a live sensor reading through the same rule every time.</p>
  <details class="wlc-why"><summary>What turns a reading into sound?</summary><p>Plain code, like a synth patch, written once. An M5.1 quake becomes a bell at velocity 93, pitched by its depth, panned by its longitude. Nothing listens, learns or improvises. <a href="#how" data-c="how">See the rules</a></p></details>
  <p class="wlc-live" id="wlcLive" aria-live="polite"></p>
  <div class="wlc-opts">
    <button class="wlc-o" data-c="ambient" style="--oc:var(--o)"><span class="wlc-g g-amb" aria-hidden="true"><i></i><i></i><i></i></span><span><b>Ambient</b><small>Slow and spacious. Every event rings out on its own.</small></span><span class="go-ar" aria-hidden="true">→</span></button>
    <button class="wlc-o" data-c="pulse" style="--oc:var(--q)"><span class="wlc-g g-pul" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span><b>Pulse</b><small>A beat clocked by the planet. Solar wind sets the tempo, or pick a genre and let rain, wind or storms drive it.</small></span><span class="go-ar" aria-hidden="true">→</span></button>
    <button class="wlc-o" data-c="silent" style="--oc:var(--fg)"><span class="wlc-g g-sil" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg></span><span><b>Enter silently</b><small>Look around first, press Play when you're ready.</small></span><span class="go-ar" aria-hidden="true">→</span></button>
  </div>
  <div class="wlc-foot"><span>Switch Ambient / Pulse anytime.</span><span>By Colin Robinson · <a href="#how" data-c="how">How it works</a></span></div>
</div>`;
  document.body.appendChild(d);

  // the live line: actual readings, so the first thing people see is the data itself
  let liveT=null;
  const fmt=n=>Math.round(n).toLocaleString("en-US");
  function live(){const el=$("wlcLive");if(!el)return;
    const sp=S.sun.speed.filter(Number.isFinite),sun=!S.demo.s&&sp.length?sp[sp.length-1]:null,q=!S.demo.q?S.quakes.filter(x=>x.time>Date.now()-864e5).length:0;
    const parts=[];if(sun)parts.push(`solar wind <b>${fmt(sun)} km/s</b>`);if(q)parts.push(`<b>${fmt(q)}</b> earthquakes in the last 24 h`);
    el.innerHTML=parts.length?`<i></i>Right now: ${parts.join(" · ")}`:(S.demo.s&&S.demo.q?"":"Reading the sensors…")}

  function close(choice){if(!d.open)return;clearInterval(liveT);
    if(CHOICES.includes(choice))try{localStorage.setItem(KEY,choice)}catch(_){}
    const done=()=>{d.classList.remove("out");try{d.close()}catch(_){d.removeAttribute("open")}};
    if(matchMedia("(prefers-reduced-motion:reduce)").matches)done();else{d.classList.add("out");setTimeout(done,300)}
    if(location.hash==="#welcome")try{history.replaceState(null,"",location.pathname+location.search)}catch(_){}
    if(choice==="ambient"||choice==="pulse"){setStyle(choice);if(!S.on)startStop().catch(e=>console.error(e))}
    if(choice==="how"){const h=$("how");if(h){h.open=true;setTimeout(()=>h.scrollIntoView({behavior:"smooth",block:"start"}),320)}}}

  function open(){if(d.open)return;live();liveT=setInterval(live,1000);
    try{d.showModal()}catch(_){d.setAttribute("open","")}
    // focus the choice they made last time, otherwise Ambient
    const pick=d.querySelector(`.wlc-o[data-c="${saved||"ambient"}"]`);pick&&pick.focus({preventScroll:true})}

  d.addEventListener("click",e=>{const b=e.target.closest("[data-c]");if(b){e.preventDefault();close(b.dataset.c);return}
    if(e.target===d)close("silent")}); // tap outside the card = enter silently
  d.addEventListener("cancel",e=>{e.preventDefault();close("silent")}); // Esc
  // keep the page's own shortcuts (space = play, g/f/p) from firing underneath
  d.addEventListener("keydown",e=>{if(e.key!=="Escape")e.stopPropagation()});

  window.EMWelcome={open};
  addEventListener("hashchange",()=>{if(location.hash==="#welcome")open()});
  document.querySelectorAll("[data-welcome]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();open()}));

  // every fresh visit (one tap = sound on, since browsers only allow audio after a tap); never on top of a shared link
  if(hash==="welcome"||!hash)setTimeout(open,350);
})();
