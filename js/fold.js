/* Earth MIDI · Fold: layouts for folding phones (iPhone Duo and others) when they're partly folded.
   Book pose (fold runs top to bottom): Instrument + Desk. The globe plays on the left page, the Console on the right.
   Tent / stand pose (fold runs side to side): Planet Clock. A full-bleed globe on top with the last thing the planet
   played in big type, and a one-row transport (play, Ambient/Pulse, volume) underneath. The screen stays awake while
   it plays and dims itself after a minute without a touch.
   Where the fold is comes from, in order:
     1. the Earth MIDI app, which reads it from the system and calls FOLD.set({axis:"v"|"h", a, w})
        (a = size of the first page in CSS px, w = width of the hinge), or FOLD.set(null) when flat or closed
     2. the browser's Viewport Segments API, where a browser has it
     3. ?fold=v or ?fold=h in the address, for testing on any screen
   Nothing changes on a flat screen. "Exit" leaves the layout until the pose changes; "Always off" remembers it. */
"use strict";
const FOLD=(()=>{
const R=document.documentElement,KEY="em.fold",MIN=280;
let nat,dev=(/[?&#]fold=(v|h)\b/.exec(location.search+location.hash)||[])[1]||null,cur=null,dismissed=null,openedCns=false,wake=null,dimT=0,last=null;
const off=()=>{try{return localStorage.getItem(KEY)==="off"}catch(_){return false}};
const css=`
html.fold-book,html.fold-tent{--fa:50vh;--fw:0px}
html.fold-book body,html.fold-tent body{overflow:hidden}
html.fold-book .mapwrap,html.fold-tent .mapwrap{position:fixed;z-index:79;background:var(--bg);margin:0}
html.fold-book .mapwrap{left:0;top:0;bottom:0;width:var(--fa)}
html.fold-tent .mapwrap{left:0;right:0;top:0;height:var(--fa)}
html.fold-book #map,html.fold-tent #map{height:100%;aspect-ratio:auto}
html.fold-book .immb,html.fold-tent .immb,html.fold-tent .hud2,html.fold-tent .hud .hint2{display:none}
html.fold-book .cns{left:calc(var(--fa) + var(--fw))}
.fold-hinge{position:fixed;z-index:80;background:#000;pointer-events:none}
html.fold-book .fold-hinge{top:0;bottom:0;left:var(--fa);width:var(--fw)}
html.fold-tent .fold-hinge{left:0;right:0;top:var(--fa);height:var(--fw)}
.fold-x{position:fixed;z-index:81;display:flex;gap:6px;font:600 10px var(--mono);letter-spacing:.06em;text-transform:uppercase}
.fold-x button{height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--line2);background:rgba(8,12,17,.85);color:var(--fg2);font:inherit;letter-spacing:inherit;cursor:pointer}
html.fold-book .fold-x{left:calc(var(--fa) - 12px);transform:translateX(-100%);bottom:calc(64px + env(safe-area-inset-bottom,0px))}
html.fold-tent .fold-x{right:max(12px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px))}
.pclock{position:fixed;left:0;right:0;bottom:0;top:calc(var(--fa) + var(--fw));z-index:79;display:flex;flex-direction:column;justify-content:center;gap:clamp(8px,3vh,22px);
  padding:12px max(18px,env(safe-area-inset-right,0px)) max(14px,env(safe-area-inset-bottom,0px)) max(18px,env(safe-area-inset-left,0px));
  background:radial-gradient(120% 90% at 50% 0%,#0b1420,var(--bg) 70%);transition:opacity 1.2s}
.pclock[hidden]{display:none}
.pclock.dim{opacity:.42}
.pc-ev{display:flex;align-items:baseline;gap:14px;min-width:0}
.pc-note{font:800 clamp(34px,9vh,72px)/1 var(--disp);letter-spacing:-.02em;color:var(--c,var(--fg));text-shadow:0 0 28px color-mix(in srgb,var(--c,var(--fg)) 45%,transparent);flex:none}
.pc-txt{min-width:0;font:500 clamp(14px,3.2vh,22px)/1.3 var(--body);color:var(--fg);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pc-meta{font:500 clamp(11px,2vh,14px) var(--mono);color:var(--mute);letter-spacing:.04em}
.pc-row{display:flex;align-items:center;gap:12px}
.pc-row .go{flex:none}
.pc-row .seg{flex:none}
.pc-row input[type=range]{flex:1;min-width:80px;height:44px}
@media (prefers-reduced-motion:reduce){.pclock{transition:none}}
`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
const hinge=document.createElement("div");hinge.className="fold-hinge";hinge.hidden=true;document.body.appendChild(hinge);
const bar=document.createElement("div");bar.className="fold-x";bar.hidden=true;
bar.innerHTML=`<button type="button" data-f="exit">Exit</button><button type="button" data-f="off">Always off</button>`;
document.body.appendChild(bar);
bar.onclick=e=>{const b=e.target.closest("[data-f]");if(!b)return;
  if(b.dataset.f==="off"){try{localStorage.setItem(KEY,"off")}catch(_){}if(typeof xs==="function")xs("Fold layouts off. Clear site data to turn them back on")}
  dismissed=cur&&cur.axis;apply()};

/* Planet Clock panel (tent pose) */
const pc=document.createElement("section");pc.className="pclock";pc.hidden=true;pc.setAttribute("aria-label","Planet Clock");
pc.innerHTML=`<div class="pc-ev"><span class="pc-note" id="pcNote">·</span><span class="pc-txt" id="pcTxt">Press play and the planet starts playing.</span></div>
<div class="pc-meta" id="pcMeta"></div>
<div class="pc-row"><button class="go" type="button" aria-label="Play or stop"><i></i><span>PLAY</span></button>
<div class="seg"><button data-style="ambient" aria-pressed="true">Ambient</button><button data-style="pulse" aria-pressed="false">Pulse</button></div>
<input type="range" min="0" max="1" step=".01" aria-label="Volume" id="pcVol"></div>`;
document.body.appendChild(pc);
const pv=pc.querySelector("#pcVol"),mv=$("vol");
const syncPC=()=>{const g=pc.querySelector(".go"),on=!!(typeof S!=="undefined"&&S.on);g.classList.toggle("on",on);g.querySelector("span").textContent=on?"STOP":"PLAY";
  pc.querySelectorAll("[data-style]").forEach(b=>b.setAttribute("aria-pressed",String(typeof S!=="undefined"&&S.style===b.dataset.style)));if(mv)pv.value=mv.value};
pc.querySelector(".go").onclick=()=>{if(typeof startStop==="function")Promise.resolve(startStop()).then(()=>{syncPC();awake()})};
pc.querySelectorAll("[data-style]").forEach(b=>b.onclick=()=>{if(typeof setStyle==="function")setStyle(b.dataset.style);syncPC()});
pv.oninput=()=>{if(!mv)return;mv.value=pv.value;mv.dispatchEvent(new Event("input",{bubbles:true}))};
const meta=()=>{try{const c=(S.cur||{}),kp=+c.kp||0;$("pcMeta").textContent=`${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} · Kp ${kp.toFixed(1)}${typeof kpScaleName==="function"?" · "+kpScaleName(kp||2):""}${S.on?"":" · stopped"}`}catch(_){}};
const hook=()=>{if(typeof window.logEv!=="function"||window.logEv.__fold)return;const orig=window.logEv;
  window.logEv=function(text,layer){const r=orig.apply(this,arguments);try{last={text:String(text||"").replace(/<[^>]+>/g,""),layer:layer||""};if(cur&&cur.axis==="h")showLast()}catch(_){}return r};
  Object.assign(window.logEv,orig);window.logEv.__fold=true};
const showLast=()=>{if(!last)return;const m=/→\s*([A-G]#?-?\d)/.exec(last.text);$("pcNote").textContent=m?m[1]:"♪";
  $("pcTxt").textContent=last.text.replace(/\s*→.*$/,"");pc.style.setProperty("--c",last.layer?`var(--${last.layer})`:"var(--fg)")};

/* stays awake while playing in the clock, dims after a minute without a touch */
async function awake(){const want=cur&&cur.axis==="h"&&typeof S!=="undefined"&&S.on;
  if(want&&!wake&&navigator.wakeLock){try{wake=await navigator.wakeLock.request("screen");wake.addEventListener("release",()=>{wake=null})}catch(_){}}
  else if(!want&&wake){try{await wake.release()}catch(_){}wake=null}}
const poke=()=>{pc.classList.remove("dim");clearTimeout(dimT);if(cur&&cur.axis==="h")dimT=setTimeout(()=>pc.classList.add("dim"),60000)};
addEventListener("pointerdown",poke,true);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){wake=null;awake()}});

function fromWeb(){const s=window.viewport&&window.viewport.segments;if(!s||s.length!==2)return null;const[a,b]=s;
  return Math.abs(a.top-b.top)<2?{axis:"v",a:a.width,w:Math.max(0,b.left-a.right)}:{axis:"h",a:a.height,w:Math.max(0,b.top-a.bottom)}}
function fromDev(){if(!dev)return null;const W=innerWidth,H=innerHeight,w=Math.round(Math.min(W,H)*.02);
  return dev==="v"?{axis:"v",a:Math.round((W-w)/2),w}:{axis:"h",a:Math.round((H-w)/2),w}}
function apply(){
  let f=nat!==undefined?nat:(fromWeb()||fromDev());
  if(f&&!(f.axis==="v"||f.axis==="h"))f=null;
  if(f){const span=f.axis==="v"?innerWidth:innerHeight;if(f.a<MIN||span-f.a-f.w<MIN)f=null}
  if(!f||f.axis!==dismissed)dismissed=null; // a new pose clears "Exit"
  if(f&&(off()||f.axis===dismissed||R.classList.contains("embed")))f=null;
  const was=cur&&cur.axis;cur=f;
  R.classList.toggle("fold-book",!!f&&f.axis==="v");R.classList.toggle("fold-tent",!!f&&f.axis==="h");
  if(f){R.style.setProperty("--fa",f.a+"px");R.style.setProperty("--fw",f.w+"px")}else{R.style.removeProperty("--fa");R.style.removeProperty("--fw")}
  hinge.hidden=bar.hidden=!f;
  pc.hidden=!(f&&f.axis==="h");
  const now=f&&f.axis;
  if(now!==was){
    if(now==="v"&&typeof CONSOLE!=="undefined"&&!CONSOLE.isOpen){openedCns=true;CONSOLE.open()}
    if(now!=="v"&&openedCns){openedCns=false;if(typeof CONSOLE!=="undefined"&&CONSOLE.isOpen)CONSOLE.close()}
    if(now==="h"){hook();syncPC();showLast();meta();poke()}
    awake();
    requestAnimationFrame(()=>dispatchEvent(new Event("resize")));
  }
}
/* closing the Console from its own Globe button in book pose leaves the book layout until the pose changes */
new MutationObserver(()=>{if(cur&&cur.axis==="v"&&!R.classList.contains("cns-on")){openedCns=false;dismissed="v";apply()}}).observe(R,{attributes:true,attributeFilter:["class"]});
let rt=0;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(apply,80)});
if(window.viewport&&window.viewport.addEventListener)try{window.viewport.addEventListener("segmentschange",apply)}catch(_){}
setInterval(()=>{if(cur&&cur.axis==="h"){meta();syncPC();awake()}},5000);
setTimeout(apply,400);
return {set(f){nat=f||null;apply()},get pose(){return cur?(cur.axis==="v"?"book":"tent"):"flat"}};
})();
