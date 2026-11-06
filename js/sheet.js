/* Earth MIDI v0.6 · layers drawer on phones: drag between peek, half and full; glow rows with their layer's level */
"use strict";
(()=>{
  const side=$("side"),head=$("sheetHead"),mq=matchMedia("(max-width:700px)");
  const PEEK=64;let state=0,h=PEEK,drag=null;
  const full=()=>side.offsetHeight,snaps=()=>[PEEK,Math.round(Math.min(full(),innerHeight*.48)),full()];
  function setH(px,anim){h=px;side.classList.toggle("drag",!anim);side.style.setProperty("--sheetH",px+"px")}
  function go(i){state=clamp(i,0,2);setH(snaps()[state],true);side.dataset.state=state;head.setAttribute("aria-expanded",state>0);
    if(state===0)$("pads").scrollTop=0}
  head.addEventListener("pointerdown",e=>{if(!mq.matches)return;drag={y:e.clientY,h,t:performance.now(),moved:0};head.setPointerCapture(e.pointerId)});
  head.addEventListener("pointermove",e=>{if(!drag)return;const dy=drag.y-e.clientY;drag.moved=Math.max(drag.moved,Math.abs(dy));if(drag.moved<6)return;setH(clamp(drag.h+dy,PEEK,full()),false)});
  const end=e=>{if(!drag)return;const d=drag;drag=null;
    if(d.moved<6){go(state===0?1:0);return}
    const v=(d.y-e.clientY)/Math.max(1,performance.now()-d.t),sn=snaps();
    if(Math.abs(v)>.6)go(v>0?Math.min(2,sn.findIndex(x=>x>h-1)===-1?2:sn.findIndex(x=>x>h-1)):Math.max(0,sn.map(x=>x<h+1).lastIndexOf(true)));
    else go(sn.reduce((b,x,i)=>Math.abs(x-h)<Math.abs(sn[b]-h)?i:b,0))};
  head.addEventListener("pointerup",end);head.addEventListener("pointercancel",end);
  head.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go(state===0?1:0)}else if(e.key==="ArrowUp")go(state+1);else if(e.key==="ArrowDown"||e.key==="Escape")go(state-1)});
  const reset=()=>{if(mq.matches)go(state);else{side.style.removeProperty("--sheetH");side.classList.remove("drag")}};
  mq.addEventListener?mq.addEventListener("change",reset):mq.addListener(reset);addEventListener("resize",()=>mq.matches&&go(state));
  reset();
  // rows breathe with their layer
  const rows={},dots={},bars={},dw=$("ldots"),hm=$("hmeter");document.querySelectorAll(".lrow").forEach(r=>{const k=r.dataset.k;rows[k]=r;const d=document.createElement("i");d.style.setProperty("--c",COLS[k]);dw.appendChild(d);dots[k]=d;if(hm){const b=document.createElement("i");b.style.setProperty("--c",COLS[k]);hm.appendChild(b);bars[k]=b}});
  // ~30 fps (15 at the light effects level, js/fx.js), and only writes what changed and what's on screen
  let gT=0;(function glow(now){requestAnimationFrame(glow);if(document.hidden||now-gT<(FX.lvl?62:31))return;gT=now;
    const rOn=FX.on(side),hOn=FX.on(hm),dOn=mq.matches;
    for(const k in rows){const v=(S.hit[k]||0).toFixed(2),off=muted(k);if(rOn)FX.css(rows[k],"--hit",v);
      if(bars[k]&&hOn){FX.css(bars[k],"--hit",v);if(bars[k]._off!==off){bars[k]._off=off;bars[k].classList.toggle("off",off)}}
      if(dOn){FX.css(dots[k],"--hit",v);if(dots[k]._off!==off){dots[k]._off=off;dots[k].classList.toggle("off",off)}}}})(0);
  // first visit on a phone: a small lift so people see the drawer is there
  let seen=false;try{seen=!!localStorage.getItem("em5.sheetSeen")}catch(_){}
  if(mq.matches&&!seen){setTimeout(()=>{if(state===0){side.classList.add("nudge");side.addEventListener("animationend",()=>side.classList.remove("nudge"),{once:true})}},2200)}
  head.addEventListener("pointerdown",()=>{try{localStorage.setItem("em5.sheetSeen","1")}catch(_){}},{once:true});
})();
/* Full-screen globe: map fills the screen (phone: above the Layers bar and dock). Esc or the button exits. */
(()=>{const b=$("immBtn");if(!b)return;
  const set=on=>{document.body.classList.toggle("imm",on);b.setAttribute("aria-pressed",on);b.setAttribute("aria-label",on?"Exit full-screen globe":"Full-screen globe");
    requestAnimationFrame(()=>dispatchEvent(new Event("resize")))};
  b.addEventListener("click",e=>{e.stopPropagation();set(!document.body.classList.contains("imm"))});
  b.addEventListener("pointerdown",e=>e.stopPropagation());
  addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("imm"))set(false)})})();
/* Intro line: tap to expand on phones */
(()=>{const t=document.querySelector(".tag");if(t)t.addEventListener("click",()=>t.classList.toggle("open"))})();
