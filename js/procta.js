/* Earth MIDI · Producer button, played by the planet.
   The three faders in the icon ride the live music: left is impacts and the beat (quakes, fires and storms, Pulse drums),
   middle is the sky (solar wind, X-rays, magnetosphere, jet stream, air), right is water and harmony (ocean, tides,
   chord, space station, sunrise). Each knob takes the colour of whichever layer is loudest in its group.
   The ring around the button slowly turns through the layer colours and glows with the mix.
   Stopped: the faders breathe gently. Reduced motion: everything holds still, the button just stays bold. */
"use strict";
(()=>{
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const btns=[document.getElementById("bPro"),document.querySelector('.dock .db[data-jump="pro"]')].filter(Boolean);
if(!btns.length)return;
const css=document.createElement("style");
css.textContent=`
@property --pa{syntax:"<angle>";inherits:false;initial-value:0deg}
.procta{--pl:0;--pc:#7cff9e;position:relative;font-weight:700!important;color:#fff;
 border:1.5px solid transparent!important;
 background:radial-gradient(120% 140% at 50% 120%,color-mix(in srgb,var(--pc) calc(var(--pl)*30%),transparent),transparent 70%) padding-box,linear-gradient(var(--sf2),var(--sf2)) padding-box,
  conic-gradient(from var(--pa),var(--q),var(--s),var(--k),var(--o),var(--x),var(--c),var(--q)) border-box!important;
 box-shadow:0 0 calc(6px + var(--pl)*22px) color-mix(in srgb,var(--pc) calc(25% + var(--pl)*45%),transparent),inset 0 1px 0 rgba(255,255,255,.06);
 animation:pspin 7s linear infinite;transition:box-shadow .12s,transform .1s}
.procta:hover{box-shadow:0 0 calc(12px + var(--pl)*22px) color-mix(in srgb,var(--pc) 60%,transparent),inset 0 1px 0 rgba(255,255,255,.08)}
.procta .ic{stroke-width:2.2}
.procta .ic circle{fill:var(--sf2);stroke:currentColor;transition:fill .15s}
.procta[aria-expanded="true"]{color:var(--bg)!important;
 background:linear-gradient(var(--fg),var(--fg)) padding-box,conic-gradient(from var(--pa),var(--q),var(--s),var(--k),var(--o),var(--x),var(--c),var(--q)) border-box!important}
.procta[aria-expanded="true"] .ic circle{fill:var(--fg)}
@keyframes pspin{to{--pa:360deg}}
@media (max-width:760px){.dock .procta{flex-basis:56px;font-size:9px;color:#fff}.dock .procta .ic{width:20px;height:20px}}
@media (max-width:370px){.dock .procta{flex-basis:46px;font-size:8px}}
@media (prefers-reduced-motion:reduce){.procta{animation:none;--pa:200deg}}`;
document.head.appendChild(css);
btns.forEach(b=>b.classList.add("procta"));
const knobs=btns.map(b=>[...b.querySelectorAll(".ic circle")]);
const BASE=[14,8,16],G=[["q","e","r"],["s","x","g","w","a"],["o","t","c","i","u"]];
const lvl=[0,0,0];let last=0,still=false;
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden||now-last<(window.FX&&FX.lvl?66:33))return;last=now;
  if(RM.matches){if(!still){still=true;knobs.forEach(ks=>ks.forEach((c,i)=>{c.setAttribute("cy",BASE[i]);c.style.fill=""}));btns.forEach(b=>b.style.setProperty("--pl",0))}return}
  still=false;
  const on=typeof S!=="undefined"&&S.on,hit=on?S.hit:{};let top=0,topC=null;
  for(let i=0;i<3;i++){
    let v=0,k=null;for(const key of G[i]){const h=hit[key]||0;if(h>v){v=h;k=key}}
    v=Math.min(1,v);lvl[i]+=(v-lvl[i])*(v>lvl[i]?.55:.12);
    const cy=on?18.4-lvl[i]*12.8:BASE[i]+Math.sin(now/1400+i*2.1)*2.2;
    const col=on&&lvl[i]>.06&&k?COLS[k]:"";
    knobs.forEach(ks=>{const c=ks[i];if(!c)return;c.setAttribute("cy",cy.toFixed(2));c.style.fill=col});
    if(lvl[i]>top){top=lvl[i];topC=COLS[k]||null}}
  btns.forEach(b=>{b.style.setProperty("--pl",(on?top:0).toFixed(3));if(on&&topC&&top>.06)b.style.setProperty("--pc",topC)});
}
requestAnimationFrame(frame);
})();
