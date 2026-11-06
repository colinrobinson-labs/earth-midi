/* Earth MIDI · effects tiers, so the page stays smooth on phones and slower devices.
   Loaded first, before core.js. Three levels:
     0 full   everything as designed
     1 light  same layout and colours; canvases redraw at 30 fps and 1.5x pixel density, no canvas blur glows, no title glow filter,
              the title's colour drift steps instead of repainting every frame, no frosted-glass blur on bars
     2 lower  light + canvases drawn at 1x pixel density
   How a level is picked:
     ?fx=full | ?fx=light | ?fx=auto in the URL, or the Effects links in the footer, set it by hand (saved in this browser).
     Otherwise it starts at full (light with reduced motion, data saver, or a very small device), and a frame-rate
     watchdog steps down one level if the page can't keep up (under ~45 fps, then badly dropping frames at light).
     A step down is remembered for two weeks so the next visit starts smooth.
   Always on, at every level (no visual change): effects that are scrolled out of view stop drawing,
   and CSS variables are only written when their value actually changes. */
"use strict";
(()=>{
const LS=k=>{try{return localStorage.getItem(k)}catch(_){return null}},SS=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}};
const NAMES={full:0,light:1,lite:1,low:2,lower:2};
const q=new URLSearchParams(location.search).get("fx");
if(q==="auto"){SS("em.fx",null);SS("em.fxAuto",null)}else if(q&&q in NAMES)SS("em.fx",String(NAMES[q]));
let manual=LS("em.fx")!=null?+LS("em.fx"):null;
let lvl=0;
if(manual!=null)lvl=Math.max(0,Math.min(2,manual));
else{
  const a=(LS("em.fxAuto")||"").split(":");if(a.length===2&&Date.now()-(+a[1])<14*864e5)lvl=Math.max(0,Math.min(2,+a[0]||0));
  const rm=matchMedia("(prefers-reduced-motion: reduce)").matches,save=navigator.connection&&navigator.connection.saveData,
    weak=(navigator.deviceMemory&&navigator.deviceMemory<=2)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);
  if(rm||save||weak)lvl=Math.max(lvl,1);
}
const root=document.documentElement;
const paint=()=>{root.classList.toggle("fx-lite",lvl>=1);root.classList.toggle("fx-low",lvl>=2);root.dataset.fx=lvl};
paint();

/* ---------- what's on screen ---------- */
const seen=new WeakMap();let io=null;
try{io=new IntersectionObserver(es=>es.forEach(e=>{seen.set(e.target,e.isIntersecting);e.target.classList.toggle("offscr",!e.isIntersecting)}),{rootMargin:"80px"})}catch(_){}
/* ---------- change-only CSS variable writes ---------- */
const memo=new WeakMap();
function css(el,k,v){if(!el)return;let m=memo.get(el);if(!m){m={};memo.set(el,m)}if(m[k]===v)return;m[k]=v;el.style.setProperty(k,v)}

const FX={
  get lvl(){return lvl},get manual(){return manual!=null},
  dpr(){return Math.min(lvl>=2?1:lvl>=1?1.5:2,window.devicePixelRatio||1)},
  frameMs(){return lvl>=1?31:0}, // light: canvases redraw at ~30 fps
  watch(el){if(el&&io&&!seen.has(el)){seen.set(el,true);io.observe(el)}return el},
  on(el){if(!el)return false;if(!seen.has(el))FX.watch(el);return seen.get(el)!==false},
  css,
  set(n,save){n=Math.max(0,Math.min(2,n|0));if(save===true){SS("em.fx",String(n));manual=n}
    if(n===lvl)return;lvl=n;paint();dispatchEvent(new CustomEvent("fxchange",{detail:lvl}))},
  auto(){SS("em.fx",null);SS("em.fxAuto",null);location.reload()}
};
window.FX=FX;

/* ---------- canvas blur glows are the costliest thing on phone GPUs: at light, skip them ---------- */
try{const P=CanvasRenderingContext2D.prototype,d=Object.getOwnPropertyDescriptor(P,"shadowBlur");
  if(d&&d.set)Object.defineProperty(P,"shadowBlur",{configurable:true,enumerable:d.enumerable,get(){return d.get.call(this)},
    set(v){d.set.call(this,lvl>=1&&!(this.canvas&&this.canvas.keepFx)?0:v)}})}catch(_){}

/* ---------- watchdog: step down a level when the page can't keep up ---------- */
if(manual==null){
  let last=0,buf=[],bad=0,t0=performance.now(),hid=0,w0=0;
  document.addEventListener("visibilitychange",()=>{hid=performance.now();buf=[]});
  const tick=now=>{
    if(lvl>=2||manual!=null)return;requestAnimationFrame(tick);
    const dt=last?now-last:0;last=now;
    if(document.hidden||now-t0<2500||now-hid<1000||!dt||dt>500)return; // skip load, tab switches and stalls
    if(!buf.length)w0=now;buf.push(dt);if(now-w0<2000||buf.length<20)return; // judge 2-second windows
    const s=buf.slice().sort((a,b)=>a-b),med=s[s.length>>1],slow=buf.filter(x=>x>45).length/buf.length;buf=[];
    const struggling=lvl===0?med>22:slow>.3;
    bad=struggling?bad+1:0;
    if(bad>=2){bad=0;FX.set(lvl+1);SS("em.fxAuto",lvl+":"+Date.now());
      const say=()=>{if(typeof xs==="function")xs("Switched to lighter effects so it runs smoothly here · footer has Effects: Full to switch back")};
      document.readyState==="complete"?say():addEventListener("load",say)}};
  requestAnimationFrame(tick);
}

/* ---------- footer: Effects  Auto · Full · Light ---------- */
addEventListener("DOMContentLoaded",()=>{const k=document.querySelector("footer .keys");if(!k)return;
  const sp=document.createElement("span");sp.className="fxpick";
  const cur=manual==null?"auto":lvl>=1?"light":"full";
  sp.innerHTML=` · effects: ${["auto","full","light"].map(n=>`<a href="?fx=${n}" data-fx="${n}"${n===cur?' aria-current="true"':""}>${n}</a>`).join(" / ")}`;
  sp.addEventListener("click",e=>{const a=e.target.closest("[data-fx]");if(!a)return;e.preventDefault();const n=a.dataset.fx;
    if(n==="auto")return FX.auto();FX.set(NAMES[n],true);sp.querySelectorAll("[data-fx]").forEach(x=>x.toggleAttribute("aria-current",x===a))});
  k.appendChild(sp)});
})();
