/* Earth MIDI · clean pass (Nov 6): progressive disclosure for the full view.
   - Globe HUD: Globe/Flat, a "View options" popover (Weather, Sound follows view, Zones) and Zeus Mode.
   - Inspector: Event log, MIDI monitor, Trace and Output as tabs in one panel. Tapping an event opens Trace.
   - Reference rows (DAW, How it works, Accuracy, License) open from in-page links.
   Nothing is removed: every control keeps its id and handlers, it just moves. */
"use strict";
(()=>{
const hud=document.querySelector(".hud2"),wrap=hud&&hud.closest(".mapwrap");
if(hud&&wrap){
  const box=document.createElement("div");box.className="seg vopt";
  box.innerHTML=`<button type="button" id="vOptBtn" aria-expanded="false" aria-controls="vPop" title="Weather, Sound follows view, Zones"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg><span class="vo-d">View options</span><span class="vo-m">Options</span><i class="vdot" aria-hidden="true"></i></button>`;
  const pop=document.createElement("div");pop.className="vpop";pop.id="vPop";pop.hidden=true;pop.setAttribute("role","dialog");pop.setAttribute("aria-label","View options");
  const row=(label,el)=>{if(!el)return;const r=document.createElement("div");r.className="vrow";const s=document.createElement("span");s.textContent=label;r.append(s,el);pop.appendChild(r)};
  const wxB=$("wxBtn"),znB=$("znBtn"),wx=wxB&&wxB.closest(".seg"),vm=$("vmixWrap"),zn=znB&&znB.closest(".seg");
  row("Live weather",wx);row("Sound follows view",vm);row("Zones",zn);
  if(wx){const b=wxB;b.textContent="";const sync=()=>{b.textContent=b.getAttribute("aria-pressed")==="true"?"On":"Off"};sync();new MutationObserver(sync).observe(b,{attributes:true,attributeFilter:["aria-pressed"]})}
  if(zn){const b=znB;const lab=document.createElement("span");lab.textContent="Edit zones";[...b.childNodes].forEach(n=>{if(n.nodeType===3)n.remove()});b.appendChild(lab);b.addEventListener("click",()=>close())}
  const god=$("godBtn");god?hud.insertBefore(box,god):hud.appendChild(box);
  wrap.appendChild(pop);
  const btn=box.firstChild;
  const place=()=>{const r=btn.getBoundingClientRect(),w=wrap.getBoundingClientRect();if(innerWidth>700){pop.style.left=Math.max(8,r.left-w.left)+"px";pop.style.top=(r.bottom-w.top+6)+"px"}else{pop.style.left="";pop.style.top=(r.bottom+6)+"px"}};
  function open(){place();pop.hidden=false;btn.setAttribute("aria-expanded","true")}
  function close(){pop.hidden=true;btn.setAttribute("aria-expanded","false")}
  btn.addEventListener("click",e=>{e.stopPropagation();pop.hidden?open():close()});
  document.addEventListener("pointerdown",e=>{if(!pop.hidden&&!pop.contains(e.target)&&!box.contains(e.target))close()});
  addEventListener("keydown",e=>{if(e.key==="Escape"&&!pop.hidden){close();btn.focus()}});
  addEventListener("resize",()=>{if(!pop.hidden)place()});
  hud.addEventListener("scroll",()=>{if(!pop.hidden)place()},{passive:true});
  if(god)god.addEventListener("click",close);
  // a small dot on View options while Zones are on or weather is off, so nothing changes silently
  const flag=()=>{const z=znB,w=wxB;box.classList.toggle("act",!!(z&&z.getAttribute("aria-pressed")==="true")||!!(w&&w.getAttribute("aria-pressed")==="false"))};
  [znB,wxB].forEach(b=>b&&new MutationObserver(flag).observe(b,{attributes:true,attributeFilter:["aria-pressed"]}));flag();
  if(typeof measureHud==="function")measureHud();
}
// inspector tabs
const ins=$("insp");
if(ins){const tabs=[...ins.querySelectorAll("[data-it]")],panes=[...ins.querySelectorAll("[data-ip]")],hint=$("ihint");
  const HINT={log:"Real events only. Tap one to trace how it became sound.",roll:"Every note, as it's sent.",trace:"Sensor, rule, sound. No AI running.",scope:"Spectrum, waveform and stereo field."};
  const show=k=>{tabs.forEach(t=>t.setAttribute("aria-selected",String(t.dataset.it===k)));panes.forEach(p=>p.hidden=p.dataset.ip!==k);if(hint)hint.textContent=HINT[k]||""};
  tabs.forEach(t=>t.onclick=()=>show(t.dataset.it));
  const log=$("log");if(log)log.addEventListener("click",e=>{if(e.target.closest("li"))setTimeout(()=>show("trace"),0)});
  window.INSPECT={show}}
// in-page links open their section
const openRef=id=>{const d=document.getElementById(id);if(d&&d.tagName==="DETAILS"){d.open=true;return d}};
document.addEventListener("click",e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const id=a.getAttribute("href").slice(1);if(["daw","accuracy","license"].includes(id)){const d=openRef(id);if(d){e.preventDefault();d.scrollIntoView({behavior:"smooth",block:"start"})}}});
const fromHash=()=>{if(["#daw","#accuracy","#license"].includes(location.hash)){const d=openRef(location.hash.slice(1));if(d)setTimeout(()=>d.scrollIntoView({block:"start"}),60)}};fromHash();addEventListener("hashchange",fromHash);
})();
