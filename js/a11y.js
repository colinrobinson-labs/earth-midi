/* Earth MIDI · keyboard and screen-reader pass. Loaded last; adds to what's on the page, removes nothing.
   - Skip link to the readings.
   - Tabs (Producer, inspector, Console): one tab stop per group, arrow keys / Home / End move between tabs.
   - Layer names: Enter or Space mutes, S solos (the pointer version is tap / hold).
   - Timeline: a slider. Left/Right jump 15 minutes (Shift: 1 hour), Home = 24 h ago, End = live.
   - Globe: focusable. Arrow keys spin it, + and - zoom, and a spoken summary of the current readings.
   - Event log lines open their trace with Enter. Decorative canvases are hidden from screen readers. */
"use strict";
(()=>{
const css=document.createElement("style");
css.textContent=`
.skip{position:fixed;left:12px;top:-60px;z-index:200;height:40px;display:inline-flex;align-items:center;padding:0 14px;border-radius:10px;background:var(--fg);color:var(--bg);font:600 13px var(--body);text-decoration:none}
.skip:focus{top:calc(10px + env(safe-area-inset-top,0px))}
#map:focus-visible,#tl:focus-visible{outline:2px solid var(--o);outline-offset:-2px}
#grid:focus{outline:none}`;
document.head.appendChild(css);

/* ---------- skip link ---------- */
const grid=$("grid");
if(grid&&!document.documentElement.classList.contains("embed")){
  const a=document.createElement("a");a.className="skip";a.href="#grid";a.textContent="Skip to the readings";
  grid.tabIndex=-1;grid.setAttribute("aria-label","Readings");grid.setAttribute("role","region");
  a.addEventListener("click",e=>{e.preventDefault();grid.focus({preventScroll:true});grid.scrollIntoView({block:"start"})});
  document.body.prepend(a)}

/* ---------- tabs ---------- */
const tabsOf=l=>[...l.querySelectorAll('[role="tab"]')].filter(t=>!t.disabled&&t.offsetParent);
const rove=l=>{const ts=tabsOf(l);if(!ts.length)return;const cur=ts.find(t=>t.getAttribute("aria-selected")==="true")||ts[0];ts.forEach(t=>{const v=t===cur?0:-1;if(t.tabIndex!==v)t.tabIndex=v})};
const watched=new WeakSet();
const watch=l=>{if(watched.has(l))return;watched.add(l);rove(l);new MutationObserver(()=>rove(l)).observe(l,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-selected"]})};
document.querySelectorAll('[role="tablist"]').forEach(watch);
document.addEventListener("focusin",e=>{const l=e.target.closest&&e.target.closest('[role="tablist"]');if(l){watch(l);rove(l)}});
document.addEventListener("keydown",e=>{const t=e.target.closest&&e.target.closest('[role="tab"]');if(!t||e.altKey||e.ctrlKey||e.metaKey)return;
  const l=t.closest('[role="tablist"]');if(!l)return;const ts=tabsOf(l),i=ts.indexOf(t);let n=-1;
  if(e.key==="ArrowRight"||e.key==="ArrowDown")n=(i+1)%ts.length;else if(e.key==="ArrowLeft"||e.key==="ArrowUp")n=(i-1+ts.length)%ts.length;else if(e.key==="Home")n=0;else if(e.key==="End")n=ts.length-1;
  if(n<0)return;e.preventDefault();ts[n].click();
  // the Producer redraws its tabs on every switch, so find the tab again before focusing it
  const again=tabsOf(l)[n];if(again){rove(l);again.focus()}});
// inspector: tie each tab to its pane
const insp=$("insp");
if(insp)insp.querySelectorAll("[data-it]").forEach(t=>{const p=insp.querySelector(`[data-ip="${t.dataset.it}"]`);if(!p)return;t.id=t.id||"itab-"+t.dataset.it;p.id=p.id||"ipane-"+t.dataset.it;t.setAttribute("aria-controls",p.id);p.setAttribute("aria-labelledby",t.id)});

/* ---------- layers: the name button mutes on tap and solos on hold; give keys the same ---------- */
const pads=$("pads");
if(pads){
  const sync=()=>pads.querySelectorAll(".lname").forEach(b=>{const r=b.closest(".lrow"),k=b.dataset.k,name=(b.textContent||"").trim();if(!r)return;
    const off=r.classList.contains("off"),solo=r.classList.contains("solo"),lab=`${name}: ${solo?"solo":off?"muted":"on"}`;
    if(b.getAttribute("aria-label")!==lab)b.setAttribute("aria-label",lab);
    if(b.title!=="Tap to mute, hold to solo. Keyboard: Enter mutes, S solos")b.title="Tap to mute, hold to solo. Keyboard: Enter mutes, S solos";});
  sync();new MutationObserver(sync).observe(pads,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
  pads.addEventListener("keydown",e=>{const b=e.target.closest(".lname");if(!b||e.altKey||e.ctrlKey||e.metaKey)return;const k=b.dataset.k;
    if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();toggleMute(k)}
    else if(e.key==="s"||e.key==="S"){e.preventDefault();e.stopPropagation();toggleSolo(k)}});
  pads.setAttribute("aria-label","Layers: Enter mutes a layer, S solos it, the slider sets its level")}

/* ---------- timeline as a slider ---------- */
const tl=$("tl");
if(tl){
  const frac=()=>{if(!S.on||S.mode===0||S.liveSince)return 1;const from=S.replayFrom||Date.now()-864e5,end=S.endT||Date.now();return clamp((realNow()-from)/((end-from)||1),0,1)};
  const say=()=>{const f=frac(),live=f>=.999&&S.on,h=(1-f)*24;
    tl.setAttribute("aria-valuenow",String(Math.round(f*1440)));
    tl.setAttribute("aria-valuetext",!S.on?"Stopped":live?"Live":h<1?`${Math.round(h*60)} minutes ago`:`${h.toFixed(1)} hours ago`)};
  tl.tabIndex=0;tl.setAttribute("role","slider");tl.setAttribute("aria-label","Timeline, last 24 hours");tl.setAttribute("aria-valuemin","0");tl.setAttribute("aria-valuemax","1440");
  tl.setAttribute("aria-keyshortcuts","ArrowLeft ArrowRight Home End");say();
  let tick=0;tl.addEventListener("focus",()=>{say();clearInterval(tick);tick=setInterval(say,2000)});tl.addEventListener("blur",()=>clearInterval(tick));
  tl.addEventListener("keydown",async e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const step=(e.shiftKey?60:15)/1440;let f=frac();
    if(e.key==="ArrowLeft"||e.key==="ArrowDown")f-=step;else if(e.key==="ArrowRight"||e.key==="ArrowUp")f+=step;else if(e.key==="Home")f=0;else if(e.key==="End")f=1;else return;
    e.preventDefault();
    if(f>=.999){if(S.on&&(S.mode===0||S.liveSince))return;goLive();say();return}
    if(!S.on)await startStop();seekTo(Math.max(0,f));say();
    xs(`Jumped to ${new Date(Date.now()-864e5*(1-Math.max(0,f))).toISOString().slice(11,16)} UTC`)})}

/* ---------- globe ---------- */
const map=$("map");
if(map){
  const sum=document.createElement("p");sum.id="mapSum";sum.className="sr";map.after(sum);
  const tell=()=>{const parts=[...document.querySelectorAll("#grid .ch")].map(c=>{const n=c.querySelector("h3 span"),v=c.querySelector(".big"),s=c.querySelector(".sub");
      const val=v?[...v.childNodes].map(x=>(x.textContent||"").trim()).filter(Boolean).join(" "):"";if(!n||!val||val==="–")return "";return `${n.textContent.trim()} ${val}${s&&s.textContent.trim()?", "+s.textContent.trim():""}`}).filter(Boolean);
    const t=(document.body.classList.contains("demo")?"Demo data, not live. ":"")+(parts.length?parts.join(". ")+".":"Readings are still loading.");
    if(sum.textContent!==t)sum.textContent=t};
  map.tabIndex=0;map.setAttribute("role","application");map.setAttribute("aria-roledescription","globe");
  map.setAttribute("aria-label","Live globe of quakes, storms, weather and the space station. Arrow keys spin it, plus and minus zoom.");
  map.setAttribute("aria-describedby","mapSum");
  setTimeout(tell,3000);setInterval(tell,30000);map.addEventListener("focus",tell);
  map.addEventListener("keydown",e=>{if(e.altKey||e.ctrlKey||e.metaKey||CFG.mapView==="flat")return;const d=e.shiftKey?30:10;let hit=true;
    if(e.key==="ArrowLeft")VIEW.lon=((VIEW.lon-d+540)%360)-180;else if(e.key==="ArrowRight")VIEW.lon=((VIEW.lon+d+540)%360)-180;
    else if(e.key==="ArrowUp")VIEW.lat=clamp(VIEW.lat+d,-80,80);else if(e.key==="ArrowDown")VIEW.lat=clamp(VIEW.lat-d,-80,80);
    else if(e.key==="+"||e.key==="=")VIEW.zoom=clamp(VIEW.zoom*1.2,.7,3.2);else if(e.key==="-"||e.key==="_")VIEW.zoom=clamp(VIEW.zoom/1.2,.7,3.2);else hit=false;
    if(hit){e.preventDefault();VIEW.lastInteract=performance.now()}})}

/* ---------- canvases: the numbers are already in text next to them ---------- */
const hideDecor=()=>document.querySelectorAll("canvas.spark,canvas.vu").forEach(c=>{if(!c.hasAttribute("aria-hidden"))c.setAttribute("aria-hidden","true")});
hideDecor();if(grid)new MutationObserver(hideDecor).observe(grid,{childList:true});
[["roll","MIDI monitor: every note as it is sent, drawn as a piano roll"],["scope","Output: spectrum, waveform and stereo field of the mix"]].forEach(([id,l])=>{const c=$(id);if(c){c.setAttribute("role","img");c.setAttribute("aria-label",l)}});

/* ---------- event log: lines that open a trace work from the keyboard ---------- */
const log=$("log");
if(log){log.setAttribute("role","log");log.setAttribute("aria-live","off");log.setAttribute("aria-label","Event log, newest first");
  const fit=()=>[...log.children].forEach(li=>{if(li.onclick&&!li.hasAttribute("tabindex")){li.tabIndex=0;li.setAttribute("role","button")}});
  fit();new MutationObserver(fit).observe(log,{childList:true});
  log.addEventListener("keydown",e=>{const li=e.target.closest("li");if(!li||(e.key!=="Enter"&&e.key!==" "))return;e.preventDefault();e.stopPropagation();li.click();
    const tr=$("trace");if(tr){tr.tabIndex=-1;setTimeout(()=>tr.focus(),30)}})}
})();
