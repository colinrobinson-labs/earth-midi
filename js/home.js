/* Earth MIDI · Home button.
   Shows up only when you've wandered off the main view: scrolled down the page, in Zeus Mode, or with Zones on.
   One press brings back the landing view: leaves Zeus Mode and Zones, closes the Producer, Export and
   How-it-works panels, folds the phone Layers drawer, resets the globe zoom, clears #zeus-style links and
   scrolls to the top. Playback, your sound settings, your drawn zones and any recording keep going untouched.
   If leaving would throw away something you made in Zeus Mode (storms you're steering, a take being recorded),
   it asks first. Not on the title, because tapping the title plays notes. */
"use strict";
(()=>{
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const css=document.createElement("style");
css.textContent=`
#homeBtn{position:fixed;z-index:35;left:max(16px,env(safe-area-inset-left,0px));bottom:16px;display:flex;align-items:center;gap:7px;height:38px;padding:0 14px 0 11px;
 border-radius:999px;border:1px solid var(--line2);background:rgba(11,16,22,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--fg);
 font:600 12.5px var(--mono);letter-spacing:.02em;box-shadow:0 8px 28px rgba(0,0,0,.45);cursor:pointer;
 opacity:0;visibility:hidden;transform:translateY(10px) scale(.96);transition:opacity .25s,transform .3s cubic-bezier(.2,1.3,.4,1),visibility 0s .3s,border-color .2s}
#homeBtn.show{opacity:1;visibility:visible;transform:none;transition:opacity .25s,transform .3s cubic-bezier(.2,1.3,.4,1),visibility 0s,border-color .2s}
#homeBtn:hover{border-color:var(--fg)}
#homeBtn svg{width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
body.imm #homeBtn{display:none}
@media (max-width:700px){
 #homeBtn{left:auto;right:max(12px,env(safe-area-inset-right,0px));bottom:auto;top:calc(10px + env(safe-area-inset-top,0px));width:40px;height:40px;padding:0;justify-content:center}
 #homeBtn span{display:none}
 body.god #homeBtn{top:calc(32px + env(safe-area-inset-top,0px))}}
@media (prefers-reduced-motion:reduce){#homeBtn,#homeBtn.show{transition:none;transform:none}}
#homeAsk{border:1px solid var(--line2);border-radius:16px;background:var(--sf2);color:var(--fg);padding:18px 18px 14px;max-width:min(380px,calc(100vw - 32px));box-shadow:0 24px 80px rgba(0,0,0,.6)}
#homeAsk::backdrop{background:rgba(3,5,8,.6);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#homeAsk h3{font:700 17px var(--disp);margin:0 0 6px}
#homeAsk p{font:13.5px/1.5 var(--body);color:var(--mute);margin:0 0 14px}
#homeAsk .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
#homeAsk button{min-height:40px;padding:0 14px;border-radius:10px;font:500 13px var(--body);cursor:pointer;border:1px solid var(--line2);background:transparent;color:var(--fg)}
#homeAsk button.go2{background:var(--fg);color:var(--bg);border-color:var(--fg)}`;
document.head.appendChild(css);

const b=document.createElement("button");b.id="homeBtn";b.type="button";
b.setAttribute("aria-label","Back to the main view");b.title="Back to the main view";
b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h4.5v-5.5h3V20H18V9.5"/></svg><span>Home</span>`;
document.body.appendChild(b);

const head=document.querySelector("header");
const god=()=>window.GOD&&window.GOD.on;
function away(){const y=head?head.getBoundingClientRect().bottom:0;return y<-40||god()||!!(typeof CFG!=="undefined"&&CFG.zonesOn)}
let shown=null;const sync=()=>{const a=away();if(a!==shown){shown=a;b.classList.toggle("show",a);b.tabIndex=a?0:-1}};
addEventListener("scroll",sync,{passive:true});setInterval(sync,400);sync();

// what would be thrown away by leaving right now
function losses(){const G=window.GOD,L=[];if(!G||!G.on)return L;
  if(G.rec)L.push("the Zeus take you're recording stops (you can still export it next time you open Zeus Mode)");
  if(G.storms&&G.storms.length)L.push(`your ${G.storms.length===1?"storm":G.storms.length+" storms"} and the sandbox weather disappear`);
  else if(G.last)L.push("the sandbox weather you made resets");
  if(G.replay)L.push("the take that's replaying stops");
  return L}

function ask(L,go){let d=$("homeAsk");if(!d){d=document.createElement("dialog");d.id="homeAsk";d.setAttribute("aria-labelledby","homeAskH");document.body.appendChild(d)}
  d.innerHTML=`<h3 id="homeAskH">You'll lose this. Leave anyway?</h3><p></p><div class="row"><button type="button" data-a="stay">Stay</button><button type="button" class="go2" data-a="go">Leave anyway</button></div>`;
  d.querySelector("p").textContent="Going home leaves Zeus Mode: "+L.join(", and ")+".";
  d.querySelector('[data-a="stay"]').onclick=()=>d.close();
  d.querySelector('[data-a="go"]').onclick=()=>{d.close();go()};
  if(d.showModal){d.showModal();d.querySelector('[data-a="stay"]').focus()}else if(confirm(d.querySelector("p").textContent))go()}

function home(){
  const G=window.GOD;if(G&&G.on&&G.set)G.set(false);
  if(typeof CFG!=="undefined"&&CFG.zonesOn){const z=$("znBtn");z&&z.click()}
  if(document.body.classList.contains("imm")){const i=$("immBtn");i&&i.click()}
  [["pro","bPro"],["exp","bExp"]].forEach(([p,bt])=>{const s=$(p),x=$(bt);if(s&&!s.hidden){s.hidden=true;x&&x.setAttribute("aria-expanded","false")}});
  const how=$("how");if(how)how.open=false;
  const sh=$("sheetHead");if(sh)for(let i=0;i<2;i++)sh.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}));
  if(typeof VIEW!=="undefined"){VIEW.zoom=1;VIEW.lastInteract=0}
  try{if(location.hash&&location.hash!=="#")history.replaceState(null,"",location.pathname+location.search)}catch(_){}
  scrollTo({top:0,behavior:RM.matches?"auto":"smooth"});
  if((window.EMRec&&EMRec.capturing)||(typeof REC!=="undefined"&&REC))xs("Back home. Still recording");
  b.blur()}

b.addEventListener("click",()=>{const L=losses();L.length?ask(L,home):home()});
window.EMHome=home;
})();
