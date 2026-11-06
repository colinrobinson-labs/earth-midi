/* Earth MIDI · Simple view: an opt-in, decluttered layout (globe, play, Ambient/Pulse, volume, live).
   The full view stays the default. Entry points: "Simple" in the Globe | Console switch, the Simple button on phones,
   and earthmidi.com/#simple. Remembered per browser; "Globe", "Show all" or "Show everything" bring the full view back.
   Nothing about the sound changes: hidden controls keep their settings. */
"use strict";
(()=>{
const KEY="em.simple",root=document.documentElement;
const isOn=()=>root.classList.contains("simple");
function sync(){const on=isOn(),cn=typeof CONSOLE!=="undefined"&&CONSOLE.isOpen;
  document.querySelectorAll("#viewSw button").forEach(b=>b.setAttribute("aria-pressed",String(cn?b.dataset.vw==="console":b.dataset.vw===(on?"simple":"globe"))));
  const p=$("bSimple");if(p)p.setAttribute("aria-pressed",String(on))}
function set(on,quiet){on=!!on;const was=isOn();root.classList.toggle("simple",on);
  try{on?localStorage.setItem(KEY,"1"):localStorage.removeItem(KEY)}catch(_){}
  if(on){
    // put away anything that would sit hidden but active
    [["pro","bPro"],["exp","bExp"]].forEach(([p,bt])=>{const s=$(p),x=$(bt);if(s&&!s.hidden){s.hidden=true;x&&x.setAttribute("aria-expanded","false")}});
    const G=window.GOD;if(G&&G.on&&G.set)G.set(false);
    const sh=$("sheetHead");if(sh)for(let i=0;i<2;i++)sh.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}));
  }
  sync();
  if(was!==on){dispatchEvent(new Event("resize"));if(!quiet&&typeof xs==="function")xs(on?"Simple view. Everything else is one tap away: Globe, or Show all":"Full view");
    if(!quiet&&!on)scrollTo({top:0,behavior:"auto"})}}
window.SIMPLE={set,get on(){return isOn()},sync};

if(location.hash==="#simple"){set(true,true);try{history.replaceState(null,"",location.pathname+location.search)}catch(_){}}
addEventListener("hashchange",()=>{if(location.hash==="#simple"){set(true);try{history.replaceState(null,"",location.pathname+location.search)}catch(_){}}});
const ps=$("bSimple");if(ps)ps.onclick=()=>set(!isOn());
[$("mFull"),$("bFull")].forEach(b=>b&&(b.onclick=()=>set(false)));
sync();

// light cleanup in every view: the "drag or flick to spin" hint retires once you've spun the globe
const HK="em.hinted";let hinted=false;try{hinted=!!localStorage.getItem(HK)}catch(_){}
if(hinted)document.body.classList.add("hinted");
else{const m=$("map");if(m)m.addEventListener("pointerdown",function f(){setTimeout(()=>{document.body.classList.add("hinted");try{localStorage.setItem(HK,"1")}catch(_){}},4000);m.removeEventListener("pointerdown",f)})}
})();
