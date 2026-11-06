/* Earth MIDI · Reset: put any Producer setting back to its default, one control, one card or all at once.
   Stays out of sight until something differs from the default: a small ↺ appears next to a changed control,
   a "Reset" chip on a card with changes, a dot on tabs with changes, and "Reset tab" / "Reset all" in the panel
   header. Double-click a slider to reset it too. Defaults are DEF in core.js (the original sound). Console uses the
   same helpers for its section resets. View settings (globe/flat, spin, zones, simple view) are never touched. */
"use strict";
const RESET=(()=>{
const VIEW_KEYS=new Set(["mapView","spin","weather","viewMix","zonesOn","zones","loop"]);
const eq=(a,b)=>a===b||String(a)===String(b)||(a!==""&&b!==""&&a!=null&&b!=null&&!isNaN(+a)&&!isNaN(+b)&&Math.abs(+a-+b)<1e-9);
const def=k=>getP(DEF,k);
const changed=k=>!eq(getP(CFG,k),def(k));
// every producer key in DEF, flattened ("vol.q", "snd.oTone", ...), minus view settings
const ALL=Object.keys(DEF).filter(k=>!VIEW_KEYS.has(k)).flatMap(k=>DEF[k]&&typeof DEF[k]==="object"?Object.keys(DEF[k]).map(s=>k+"."+s):[k]);
const tabKeys=i=>{const [n,groups]=TABS[i]||[];if(n==="Mixer")return PAN_KEYS.flatMap(k=>["vol."+k,"send."+k]);
  return (groups||[]).flatMap(([,cs])=>cs.filter(([k,,t])=>t!=="info"&&k!=="note"&&k!=="_").map(([k])=>k))};
const anyChanged=keys=>keys.some(changed);

/* set keys back, then one refresh. Single sound settings get the usual audition preview. */
function keys(list,label,quiet){list=list.filter(changed);if(!list.length)return false;
  list.forEach(k=>setP(CFG,k,clone(def(k))));
  if(list.some(k=>k==="tempoSrc"||k==="tempoArea")){if(NEEDS_WX.has(CFG.tempoSrc)&&typeof loadWX==="function")loadWX();TEMPO.lt=0}
  if(list.includes("genre")||list.includes("pattern")||/^bpm/.test(list.join(" ")))TEMPO.bpm=0;
  if(typeof STUDIO!=="undefined"&&STUDIO.setLast)STUDIO.setLast(null);
  afterCFG();
  if(!quiet)xs(label?`${label}: back to default`:"Back to default");
  if(list.length===1&&typeof AUD!=="undefined"&&AUD.pick&&!/^(ch\.|clock|playAlong)/.test(list[0]))AUD.pick(list[0]);
  return true}
const all=()=>keys(ALL,"All producer settings");

/* ---------- Producer panel decoration (called at the end of buildPro) ---------- */
const ICO=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>`;
const nice=(el,v)=>{if(el.tagName==="SELECT"){const o=[...el.options].find(o=>eq(o.value,v));return o?o.text.replace(/ · .*$/,""):String(v)}
  if(el.type==="checkbox")return v?"on":"off";return String(v)};
const groupName=g=>{const h=g.querySelector(":scope>h5,:scope>b");return h?h.textContent.replace(/\s*(ch \d+|Reset)\s*$/g,"").trim():"Card"};
const pcKeys=g=>[...g.querySelectorAll("[data-t][data-k]")].map(e=>e.dataset.k);

function decorate(g){
  g.querySelectorAll(".pc").forEach(pc=>{const el=pc.querySelector(":scope>[data-t][data-k]");if(!el||pc.querySelector(":scope>.rz"))return;const k=el.dataset.k;
    const b=document.createElement("button");b.type="button";b.className="rz";b.innerHTML=ICO;
    const lab=(pc.querySelector(":scope>label")||{}).textContent||k;b.setAttribute("aria-label",`Reset ${lab} to ${nice(el,def(k))}`);b.title=`Back to default: ${nice(el,def(k))}`;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();keys([k],lab)};
    const l=pc.querySelector(":scope>label");l?l.after(b):pc.appendChild(b);
    if(el.type==="range")el.addEventListener("dblclick",()=>keys([k],lab))});
  g.querySelectorAll(".pgrp,.strip").forEach(grp=>{const h=grp.querySelector(":scope>h5,:scope>b");if(!h||h.querySelector(".rzg")||!pcKeys(grp).length)return;
    const b=document.createElement("button");b.type="button";b.className="rzg";b.innerHTML=`${ICO}<span>Reset</span>`;const nm=groupName(grp);b.setAttribute("aria-label",`Reset every ${nm} setting`);b.title=`Put every ${nm} setting back to default`;
    b.onclick=e=>{e.preventDefault();e.stopPropagation();keys(pcKeys(grp),nm)};h.appendChild(b)});
  // capture + next tick: chips and steppers fire non-bubbling events, and the control's own handler must write CFG first
  if(!g._rz){g._rz=1;const later=()=>setTimeout(sync,0);g.addEventListener("input",later,true);g.addEventListener("change",later,true)}
  sync()}

/* header buttons: Reset tab + Reset all, only while something differs */
let hdr=null;
function header(){if(hdr&&document.contains(hdr)){const cg=document.querySelector("#pro h2>.cns-go");if(cg)hdr.prepend(cg);return hdr}const h=document.querySelector("#pro h2");if(!h)return null;
  hdr=document.createElement("span");hdr.className="przh";
  hdr.innerHTML=`<button type="button" class="rzg" data-rz="tab" hidden>${ICO}<span>Reset tab</span></button><button type="button" class="rzg" data-rz="all" hidden>${ICO}<span>Reset all</span></button>`;
  hdr.onclick=e=>{const b=e.target.closest("[data-rz]");if(!b)return;if(b.dataset.rz==="all")all();else keys(tabKeys(TAB),TABS[TAB][0]+" tab")};
  const st=$("pstat");st?h.insertBefore(hdr,st):h.appendChild(hdr);return hdr}

function sync(){const g=$("pgrid");if(!g)return;
  g.querySelectorAll(".pc").forEach(pc=>{const el=pc.querySelector(":scope>[data-t][data-k]");if(el)pc.classList.toggle("chg",changed(el.dataset.k))});
  g.querySelectorAll(".pgrp,.strip").forEach(grp=>grp.classList.toggle("chg",anyChanged(pcKeys(grp))));
  document.querySelectorAll("#ptabs button[data-i]").forEach(b=>b.classList.toggle("chg",anyChanged(tabKeys(+b.dataset.i))));
  const h=header();if(h){const t=h.querySelector('[data-rz="tab"]'),a=h.querySelector('[data-rz="all"]'),n=TABS[TAB][0],tc=anyChanged(tabKeys(TAB)),ac=anyChanged(ALL);
    t.hidden=!tc;t.querySelector("span").textContent=`Reset ${n}`;t.title=`Put every ${n} setting back to default`;a.hidden=!ac;a.title="Put every producer setting back to default (view and layout stay as they are)"}}

// MIDI learn, the Console and shared links can change settings without touching the panel: catch up while it's open
setInterval(()=>{const p=$("pro");if(p&&!p.hidden&&!document.hidden)sync()},800);

const css=`
.pc{position:relative}
.pc>.rz{grid-row:1;grid-column:1;justify-self:end;align-self:center;display:none;width:22px;height:22px;padding:0;margin:0;border-radius:50%;border:0;background:transparent;color:var(--ac,var(--fg));opacity:.75;cursor:pointer;place-items:center;transition:opacity .15s,transform .3s}
.pc.ck>.rz{grid-column:2}
.pc:not(.ck)>label{grid-row:1;grid-column:1}.pc:not(.ck)>label+.rz+output,.pc:not(.ck)>label+.rz+span{grid-row:1;grid-column:2}
.pc.ck>input{grid-row:1;grid-column:1}.pc.ck>label{grid-row:1;grid-column:2}
.pc>.rz{position:relative}.pc>.rz::after{content:"";position:absolute;inset:-8px}
.pc.chg>.rz{display:grid;animation:rzIn .25s ease-out}
.pc.chg>label{padding-right:24px}
.pc>.rz:hover,.pc>.rz:focus-visible{opacity:1;background:color-mix(in srgb,var(--ac,var(--fg)) 14%,transparent)}
.pc>.rz:active{transform:rotate(-120deg)}
.rz svg,.rzg svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.rzg{display:none;align-items:center;gap:4px;margin-left:auto;height:22px;padding:0 8px 0 6px;border-radius:999px;border:1px solid color-mix(in srgb,var(--ac,var(--fg)) 30%,transparent);background:transparent;color:var(--ac,var(--fg));font:600 10px var(--mono);letter-spacing:.04em;text-transform:none;cursor:pointer;flex:none}
.rzg:hover,.rzg:focus-visible{background:color-mix(in srgb,var(--ac,var(--fg)) 14%,transparent)}
.chg>h5>.rzg,.chg>b>.rzg{display:inline-flex;animation:rzIn .25s ease-out}
.mixer .strip>b i{flex:none}.mixer .strip .rzg{width:22px;padding:0;justify-content:center;margin:-3px 0 -3px auto}.mixer .strip .rzg span{display:none}
.pgrp>h5>.rzg{margin-top:-3px;margin-bottom:-3px}
.przh{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.przh .rzg{display:inline-flex;--ac:var(--mute);height:26px;font-size:10.5px}
.przh .rzg[hidden]{display:none}
#ptabs button.chg{position:relative}
#ptabs button.chg::after{content:"";position:absolute;top:5px;right:5px;width:5px;height:5px;border-radius:50%;background:var(--tc,var(--fg));box-shadow:0 0 6px var(--tc,var(--fg))}
@keyframes rzIn{from{opacity:0;transform:scale(.6)}}
@media (prefers-reduced-motion:reduce){.pc>.rz,.rzg{animation:none!important;transition:none}}
`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

return {keys,all,changed,decorate,sync,tabKeys,ALL};
})();
