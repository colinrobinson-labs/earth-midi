/* Earth MIDI · Zones: limit any layer to part of the planet.
   Draw a circle, a latitude band or pick a region for a layer, and that layer only plays what is inside it.
   Still real data: events outside are skipped, sensor layers average only the sensors inside, and the sky
   layers follow physics (X-rays and solar wind reach the sunlit side, the magnetosphere sings where the aurora is).
   A soft edge fades things in across the border instead of cutting them. Off by default; stands down in Zeus Mode.
   Zones live in CFG.zones, so sessions, presets and share links carry them.
   MIDI: each zoned layer sends CC 102 size, 103 centre longitude, 104 centre latitude, 105 how much is inside,
   on that layer's own channel. Notes stay exactly what the sensors said. */
"use strict";
(()=>{
const KM=6371.0088;
const ZKEYS=["q","o","w","t","a","c","e","i","u","s","x","g"];// Pulse is the clock, not a place
const ZSHORT={q:"Quakes",o:"Ocean",w:"Jet stream",t:"Tides",a:"Air",c:"Chord",e:"Fires/storms",i:"Station",u:"Sunrise",s:"Solar wind",x:"X-rays",g:"Magnetosphere"};
const ZREG=[["ring","Pacific Ring of Fire"],["americas","Americas"],["asia","Asia-Pacific"],["japan","Japan"],["indo","Indonesia"],["andes","Andes"],["eurmed","Europe, Med & Middle East"],["alaska","Alaska"],["california","California"]];
const RNAME=Object.fromEntries(ZREG);
if(!CFG.zones||typeof CFG.zones!=="object")CFG.zones={};
const Z={sel:"q",armed:false,drawing:null,sky:{s:1,x:1,g:1},skyT:0};
const godOn_=()=>!!(window.GOD&&window.GOD.on);
const active=()=>!!CFG.zonesOn&&!godOn_();
const zOf=k=>{const z=CFG.zones&&CFG.zones[k];return z&&z.shape?z:null};
const save=()=>{try{localStorage.setItem("em5.cfg",JSON.stringify(CFG))}catch(_){}};

/* ---------- geometry ---------- */
function gcKm(la1,lo1,la2,lo2){const p1=la1*D2R,p2=la2*D2R,dp=p2-p1,dl=(lo2-lo1)*D2R,a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*KM*Math.asin(Math.min(1,Math.sqrt(a)))}
const sstep=e=>{e=clamp(e,0,1);return e*e*(3-2*e)};
const fall=(d,f)=>d<=0?1:f<=0?0:d>=f?0:1-sstep(d/f);
const wrapLon=d=>Math.abs(((d+540)%360)-180);
function rawW(z,lat,lon){let w=1;
  if(z.shape==="circle"){const d=gcKm(z.lat,z.lon,lat,lon);w=fall(d-z.r,z.r*z.soft)}
  else if(z.shape==="band"){const lo=Math.min(z.a,z.b),hi=Math.max(z.a,z.b),d=lat<lo?lo-lat:lat>hi?lat-hi:0;w=fall(d,Math.max(2,(hi-lo)*.6)*z.soft)}
  else if(z.shape==="region"){const R=REGIONS[z.id];if(!R)return 1;let best=1e9;
    for(const [a,b,c,d] of R){const dl=lat<a?a-lat:lat>b?lat-b:0,dn=(lon>=c&&lon<=d)?0:Math.min(wrapLon(lon-c),wrapLon(lon-d));best=Math.min(best,Math.hypot(dl,dn*Math.cos(lat*D2R)))}
    w=fall(best,20*z.soft)}
  return z.inv?1-w:w}
// rough centre + size, for MIDI and labels
function zMeta(z){if(z.shape==="circle")return {lat:z.lat,lon:z.lon,km:z.r};
  if(z.shape==="band"){const lo=Math.min(z.a,z.b),hi=Math.max(z.a,z.b);return {lat:(lo+hi)/2,lon:0,km:(hi-lo)*111.2/2}}
  const R=REGIONS[z.id]||[[-90,90,-180,180]],b=R[0];return {lat:(b[0]+b[1])/2,lon:(b[2]+b[3])/2,km:Math.max(b[1]-b[0],(b[3]-b[2])*Math.cos((b[0]+b[1])/2*D2R))*111.2/2}}
const kmTxt=km=>km>=995?`${(Math.round(km/100)/10).toLocaleString()}k km`:`${Math.round(km/10)*10} km`;
function zLabel(z){if(!z)return "Whole Earth";const inv=z.inv?"Outside ":"";
  if(z.shape==="circle")return inv+"Circle "+kmTxt(z.r);if(z.shape==="band"){const f=v=>`${Math.abs(Math.round(v))}°${v>=0?"N":"S"}`;return inv+`Band ${f(Math.min(z.a,z.b))}–${f(Math.max(z.a,z.b))}`}
  return inv+(RNAME[z.id]||"Region")}

/* ---------- the sky layers: physics decides which part of a zone they reach ---------- */
const GRID=[];for(let la=-87.5;la<90;la+=5)for(let lo=-177.5;lo<180;lo+=5)GRID.push([la,lo,Math.cos(la*D2R)]);
function skyUpdate(){const t=realNow(),sp=sunPos(t),kp=(S.cur&&Number.isFinite(S.cur.kp))?S.cur.kp:2,edge=67-2*kp;
  const day=(la,lo)=>clamp((sunElev(la,lo,sp)+6)/12,0,1);
  const aur=(la,lo)=>{const ml=Math.abs(90-gcKm(la,lo,la>=0?80.7:-80.7,la>=0?-72.7:107.3)/KM/D2R);return fall(Math.max(0,edge-3-ml,ml-(edge+9)),6)};
  for(const k of ["s","x","g"]){const z=zOf(k);if(!z){Z.sky[k]=1;continue}
    const pts=GRID.slice(),m=zMeta(z);pts.push([m.lat,m.lon,1]);if(z.shape==="circle")for(const [lo,la] of smallCircle(z.lat,z.lon,z.r/KM/D2R*.6,12))pts.push([la,lo,1]);
    if(k==="g"){let mx=0;for(const [la,lo] of pts){const w=rawW(z,la,lo);if(w>.01)mx=Math.max(mx,w*aur(la,lo))}Z.sky.g=mx}
    else{let s=0,wt=0;for(const [la,lo,c] of pts){const w=rawW(z,la,lo)*c;if(w<=.001)continue;s+=w*day(la,lo);wt+=w}Z.sky[k]=wt?s/wt:0}}
  Z.skyT=performance.now()}

/* ---------- what the engine asks ---------- */
const maxW=(k,z,pts)=>{let m=0;for(const o of pts)m=Math.max(m,rawW(z,o.lat,o.lon));return m};
ZN.has=k=>active()&&!!zOf(k);
ZN.w=(k,lat,lon)=>{if(!active())return 1;const z=zOf(k);return z?rawW(z,lat,lon):1};
ZN.bus=k=>{if(!active())return 1;const z=zOf(k);if(!z)return 1;
  switch(k){case"o":return maxW(k,z,S.ocean);case"w":return maxW(k,z,S.jet);case"a":return maxW(k,z,S.air);case"t":return maxW(k,z,S.tides);case"c":return maxW(k,z,S.temps);
    case"s":case"x":case"g":return Z.sky[k];default:return 1}};
ZN.label=k=>zLabel(zOf(k));

/* ---------- per-layer status line: says plainly what's inside ---------- */
function status(k){const z=zOf(k);if(!z)return `${LNAME[k]} plays the whole planet.`;const t=realNow();
  const cnt=(list,lat=o=>o.lat,lon=o=>o.lon)=>list.filter(o=>rawW(z,lat(o),lon(o))>.02).length;
  const none=" Nothing inside right now, so this layer is quiet.";
  switch(k){
    case"q":{const day=S.quakes.filter(q=>q.time>t-864e5&&q.time<=t),n=cnt(day);return `${n} of ${day.length} earthquakes in the last 24 h are inside.${n?"":none}`}
    case"o":{const n=cnt(S.ocean);return `${n} of ${S.ocean.length} ocean buoys/model points inside: the swell you hear is their average.${n?"":" Make it bigger to reach a sensor."}`}
    case"w":{const n=cnt(S.jet);return `${n} of ${S.jet.length} jet stream points inside.${n?"":" Make it bigger to reach a sensor."}`}
    case"t":{const n=cnt(S.tides);return `${n} of ${S.tides.length} tide gauges inside (La Jolla, New York, Honolulu).${n?"":" Make it bigger to reach a gauge."}`}
    case"a":{const n=cnt(S.air);return `${n} of ${S.air.length} cities' air quality inside.${n?"":none}`}
    case"c":{const n=cnt(S.temps);return `${n} of ${S.temps.length} chord cities sing.${n?"":none}`}
    case"u":{const n=SUN_CITIES.filter(c=>rawW(z,c[1],c[2])>.02).length;return `${n} of ${SUN_CITIES.length} cities ring at sunrise and sunset.${n?"":none}`}
    case"e":{const act=S.events.filter(e=>e.start<=t),n=cnt(act);return `${n} of ${act.length} active fires, storms and volcanoes inside.${n?"":none}`}
    case"i":{const p=S.iss&&issAt(t);return p?(rawW(z,p.lat,p.lon)>.02?"The space station is inside: you hear it.":"The space station is outside: quiet until its orbit brings it in."):"Space station position not loaded yet."}
    case"s":case"x":{const f=Math.round(Z.sky[k]*100);return `${f}% of this area is in daylight. ${k==="x"?"X-rays":"The solar wind"} only reach${k==="x"?"":"es"} the sunlit side, so it fades as night crosses the zone.`}
    case"g":return Z.sky.g>.05?"This area touches the aurora oval: the magnetosphere sings here.":"This area is away from the aurora oval, so the magnetosphere is quiet. Try the far north or south."}
  return ""}

/* ---------- MIDI: zone moves as CCs on each layer's own channel ---------- */
setInterval(()=>{if(!active()||!S.on)return;for(const k of ZKEYS){const z=zOf(k);if(!z)continue;const m=zMeta(z),ch=CH(k);
  midiCC(ch,102,map(Math.log10(Math.max(50,m.km)),Math.log10(50),Math.log10(20000),0,127));midiCC(ch,103,map(m.lon,-180,180,0,127));midiCC(ch,104,map(m.lat,-90,90,0,127));midiCC(ch,105,ZN.bus(k)*127)}},100);
setInterval(()=>{if(active())skyUpdate()},1000);

/* ---------- drawing on the map ---------- */
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
function fillPts(pts){const pp=[];for(const [lo,la] of pts){const p=proj(lo,la);if(!(p[2]>0))return false;pp.push(p)}
  if(CFG.mapView==="flat"){for(let i=1;i<pp.length;i++)if(Math.abs(pts[i][0]-pts[i-1][0])>180)return false}
  cx.beginPath();pp.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1]));cx.closePath();cx.fill();return true}
function boxPts(a,b,c,d){const p=[];for(let x=c;x<=d;x+=2)p.push([x,a]);for(let y=a;y<=b;y+=2)p.push([d,y]);for(let x=d;x>=c;x-=2)p.push([x,b]);for(let y=b;y>=a;y-=2)p.push([c,y]);return p}
const latLine=la=>{const p=[];for(let lo=-180;lo<=180;lo+=3)p.push([lo,la]);return p};
window.drawZones=function(now){if(!CFG.zonesOn||godOn_())return;const W=cv.width;
  const keys=ZKEYS.filter(k=>zOf(k)).sort((a,b)=>(a===Z.sel)-(b===Z.sel));if(!keys.length&&!Z.armed)return;
  cx.save();cx.font=`600 ${10.5*DPR}px "IBM Plex Mono",monospace`;const placed=[];
  for(const k of keys){const z=zOf(k),col=COLS[k]||"#fff",sel=k===Z.sel,a=sel?.95:.5,march=-(now/(sel?45:90))%24;
    cx.lineWidth=(sel?2:1.2)*DPR;cx.strokeStyle=rgba(col,a);cx.fillStyle=rgba(col,z.inv?0:(sel?.10:.05));
    let shapes=[],soft=[];
    if(z.shape==="circle"){const ang=z.r/KM/D2R;shapes=[smallCircle(z.lat,z.lon,Math.min(179,ang),96)];if(z.soft>0)soft=[smallCircle(z.lat,z.lon,Math.min(179,ang+z.r*z.soft/KM/D2R),96)]}
    else if(z.shape==="band"){const lo=Math.min(z.a,z.b),hi=Math.max(z.a,z.b),f=Math.max(2,(hi-lo)*.6)*z.soft;shapes=[latLine(lo),latLine(hi)];if(z.soft>0)soft=[latLine(clamp(lo-f,-89,89)),latLine(clamp(hi+f,-89,89))];
      if(!z.inv){if(CFG.mapView==="flat"){const [,y1]=proj(0,hi),[,y2]=proj(0,lo);cx.fillRect(0,y1,W,y2-y1)}}}
    else{const R=REGIONS[z.id]||[];shapes=R.map(b=>boxPts(...b))}
    if(!z.inv&&z.shape!=="band")shapes.forEach(fillPts);
    cx.setLineDash([8*DPR,5*DPR]);cx.lineDashOffset=march*DPR;shapes.forEach(strokePath);
    if(soft.length){cx.setLineDash([2*DPR,6*DPR]);cx.lineWidth=1*DPR;cx.strokeStyle=rgba(col,a*.55);soft.forEach(strokePath)}
    cx.setLineDash([]);
    const m=zMeta(z),[x,y0,v]=z.shape==="band"?proj(CFG.mapView==="flat"?0:VIEW.lon,Math.max(z.a,z.b)):proj(m.lon,m.lat);let y=y0;
    if(v>0){if(z.shape==="circle"){cx.strokeStyle=rgba(col,a);cx.lineWidth=1.2*DPR;cx.beginPath();cx.moveTo(x-5*DPR,y);cx.lineTo(x+5*DPR,y);cx.moveTo(x,y-5*DPR);cx.lineTo(x,y+5*DPR);cx.stroke()}
      if(sel||keys.length<=4){const txt=`${ZSHORT[k]} · ${zLabel(z)}`,tw=cx.measureText(txt).width,h=18*DPR;for(let n=0;n<8&&placed.some(r=>Math.abs(r[0]-x)<(r[1]+tw)/2+6*DPR&&Math.abs(r[2]-y)<h);n++)y+=h;placed.push([x,tw,y]);cx.fillStyle="rgba(5,7,10,.72)";cx.fillRect(x-tw/2-5*DPR,y+8*DPR,tw+10*DPR,16*DPR);cx.fillStyle=rgba(col,sel?1:.75);cx.textAlign="center";cx.fillText(txt,x,y+20*DPR);cx.textAlign="start"}}}
  if(Z.armed){cx.fillStyle="rgba(230,237,243,.9)";cx.textAlign="center";cx.fillText(Z.drawing?"release to set":(zOf(Z.sel)||{}).shape==="band"?"drag up or down to set the band":"press the centre, drag out the size",W/2,cv.height-58*DPR);cx.textAlign="start"}
  cx.restore()};

/* ---------- UI ---------- */
const css=`
.znbtn[aria-pressed="true"]{background:var(--fg);color:var(--bg)}
#znPanel{border-top:1px solid var(--line2);padding:12px 14px 14px;background:linear-gradient(180deg,rgba(124,200,255,.07),transparent 70%),#070b10;animation:znin .45s ease}
@keyframes znin{from{opacity:0;transform:translateY(-6px)}}
.zn-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.zn-h b{font:800 16px var(--disp);letter-spacing:.02em}
.zn-h span{font:11px var(--mono);color:var(--mute)}
.zn-h button{margin-left:auto;font:600 11.5px var(--mono);padding:6px 11px}
.zn-lay{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.zn-lay button{display:inline-flex;align-items:center;gap:7px;font:600 11.5px var(--mono);padding:6px 10px 6px 8px;border-radius:999px;background:rgba(11,16,22,.75);min-height:34px;transition:background .2s,border-color .2s}
.zn-lay button i{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c);flex:none}
.zn-lay button small{font:10px var(--mono);color:var(--mute);font-weight:400}
.zn-lay button.has small{color:var(--c)}
.zn-lay button[aria-pressed="true"]{border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,#0b1016)}
.zn-ed{display:grid;gap:10px}
.zn-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.zn-row>span{font:600 10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);min-width:52px}
.zn-row .seg button{font:600 11.5px var(--mono);padding:7px 12px}
.zn-row .seg button[aria-pressed="true"]{background:var(--fg);color:var(--bg)}
.zn-row>button{font:600 11.5px var(--mono);padding:7px 12px;min-height:34px}
#znDraw.on{background:var(--fg);color:var(--bg);animation:bl 1s infinite}
.zn-rng{display:flex;align-items:center;gap:8px;font:11px var(--mono);color:var(--mute)}
.zn-rng input[type=range]{width:150px}
.zn-rng output{color:var(--fg);min-width:64px}
.zn-row select{font:12px var(--mono);padding:6px 8px;background:#0b1016;color:var(--fg);border:1px solid var(--line2);border-radius:8px}
.zn-chk{display:inline-flex;align-items:center;gap:6px;font:11.5px var(--mono);color:var(--fg)}
.zn-stat{font:12px/1.5 var(--mono);color:#c9d6e2;margin:2px 0 0;min-height:18px}
.zn-note{font:11px/1.5 var(--mono);color:var(--mute);margin:0}
.zn-more{margin-left:auto;display:flex;gap:6px}
body.god #znPanel{display:none}
.lrow.zoned .lname::after{content:"◎";color:var(--c);font-size:12px;margin-left:-2px;text-shadow:0 0 8px var(--c)}
@media (max-width:700px){#znPanel{padding:10px}.zn-h span{flex-basis:100%;order:3}.zn-lay{flex-wrap:nowrap;overflow-x:auto;margin:0 -10px 10px;padding:0 10px;scrollbar-width:none}.zn-lay::-webkit-scrollbar{display:none}.zn-lay button{flex:none}
  .zn-row .seg{display:grid;grid-template-columns:repeat(4,1fr);width:100%}.zn-row .seg button{padding:8px 2px}.zn-row>span{display:none}.zn-rng{width:100%}.zn-rng input[type=range]{flex:1;width:auto}.zn-more{margin-left:0;width:100%}.zn-more button{flex:1}
  body.imm #znPanel{position:fixed;left:0;right:0;bottom:calc(var(--dock) + var(--peek));z-index:41;max-height:46vh;overflow:auto}}
@media (prefers-reduced-motion:reduce){#znDraw.on{animation:none}}`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
const wrap=cv.closest(".mapwrap"),hud=wrap.querySelector(".hud2");
const seg=document.createElement("div");seg.className="seg";seg.innerHTML=`<button class="znbtn" id="znBtn" aria-pressed="false" title="Zones: limit layers to part of the planet">◎ Zones</button>`;
const godB=hud.querySelector("#godBtn");godB?hud.insertBefore(seg,godB):hud.appendChild(seg);
const btn=seg.firstChild;
const panel=document.createElement("div");panel.id="znPanel";panel.hidden=true;
panel.innerHTML=`<div class="zn-h"><b>◎ Zones</b><span>Pick a layer, then choose where on Earth it listens. Live data only.</span><button id="znOff">Turn off zones</button></div>
<div class="zn-lay" id="znLay" role="toolbar" aria-label="Layer to edit">${ZKEYS.map(k=>`<button data-zk="${k}" style="--c:${COLS[k]}" aria-pressed="false"><i></i>${ZSHORT[k]}<small></small></button>`).join("")}</div>
<div class="zn-ed">
 <div class="zn-row"><span>Area</span><div class="seg" id="znShape">${[["none","Whole Earth"],["circle","Circle"],["band","Band"],["region","Region"]].map(([v,l])=>`<button data-zs="${v}" aria-pressed="false">${l}</button>`).join("")}</div></div>
 <div class="zn-row" data-for="circle"><button id="znDraw">✎ Draw on the map</button><button id="znHere">⌖ Centre on view</button><label class="zn-rng">Radius <input type="range" id="znR" min="0" max="1" step=".005" aria-label="Radius"><output id="znRo"></output></label></div>
 <div class="zn-row" data-for="band"><button id="znDrawB">✎ Draw on the map</button><label class="zn-rng">From <input type="range" id="znA" min="-90" max="90" step="1" aria-label="Band from latitude"><output id="znAo"></output></label><label class="zn-rng">To <input type="range" id="znB" min="-90" max="90" step="1" aria-label="Band to latitude"><output id="znBo"></output></label></div>
 <div class="zn-row" data-for="region"><select id="znReg" aria-label="Region">${ZREG.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></div>
 <div class="zn-row" data-for="any"><label class="zn-rng">Soft edge <input type="range" id="znSoft" min="0" max="1" step=".05" aria-label="Soft edge"><output id="znSo"></output></label><label class="zn-chk"><input type="checkbox" id="znInv"> Everything outside instead</label>
  <div class="zn-more"><button id="znAll">Use on all layers</button><button id="znClr">Reset all</button></div></div>
 <p class="zn-stat" id="znStat" role="status"></p>
 <p class="zn-note">Each zoned layer also sends its zone as MIDI CC 102–105 (size, longitude, latitude, how much is inside) on its own channel. Notes stay exactly what the sensors said.</p>
</div>`;
const after=document.getElementById("godPanel")||wrap;after.parentNode.insertBefore(panel,after.nextSibling);
const q$=id=>panel.querySelector("#"+id);
const rToV=r=>Math.log10(r/100)/2,vToR=v=>Math.round(100*Math.pow(100,v)/10)*10;
const viewCentre=()=>CFG.mapView==="flat"?{lat:20,lon:0}:{lat:clamp(VIEW.lat,-85,85),lon:VIEW.lon};
function setZone(k,z){if(z)CFG.zones[k]=z;else delete CFG.zones[k];save();skyUpdate();sync()}
function setShape(s){const k=Z.sel,old=zOf(k),c=viewCentre(),soft=old?old.soft:.3,inv=old?!!old.inv:false;Z.armed=false;
  if(s==="none")return setZone(k,null);if(old&&old.shape===s)return;
  if(s==="circle")setZone(k,{shape:"circle",lat:+c.lat.toFixed(2),lon:+c.lon.toFixed(2),r:2000,soft,inv});
  else if(s==="band")setZone(k,{shape:"band",a:Math.round(clamp(c.lat-15,-90,90)),b:Math.round(clamp(c.lat+15,-90,90)),soft,inv});
  else setZone(k,{shape:"region",id:"ring",soft,inv});
  if(s==="circle"||s==="band")xs(s==="circle"?"Circle placed at the centre of the view. Tap Draw to place it by hand.":"Band placed around the view. Drag the sliders or Draw it.")}
function sync(){const k=Z.sel,z=zOf(k),s=z?z.shape:"none";btn.setAttribute("aria-pressed",!!CFG.zonesOn);panel.hidden=!CFG.zonesOn;
  panel.querySelectorAll("[data-zk]").forEach(b=>{const kk=b.dataset.zk,zz=zOf(kk);b.setAttribute("aria-pressed",kk===k);b.classList.toggle("has",!!zz);b.querySelector("small").textContent=zz?zLabel(zz):"Earth"});
  panel.querySelectorAll("[data-zs]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.zs===s));
  panel.querySelectorAll("[data-for]").forEach(r=>r.hidden=r.dataset.for==="any"?!z:r.dataset.for!==s);
  if(z){q$("znSoft").value=z.soft;q$("znSo").textContent=z.soft?Math.round(z.soft*100)+"%":"hard";q$("znInv").checked=!!z.inv;
    if(s==="circle"){q$("znR").value=rToV(z.r);q$("znRo").textContent=kmTxt(z.r)}
    if(s==="band"){const f=v=>`${Math.abs(v)}°${v>=0?"N":"S"}`;q$("znA").value=z.a;q$("znB").value=z.b;q$("znAo").textContent=f(z.a);q$("znBo").textContent=f(z.b)}
    if(s==="region")q$("znReg").value=z.id}
  for(const id of ["znDraw","znDrawB"]){const b=q$(id);b.classList.toggle("on",Z.armed);b.textContent=Z.armed?"✕ Cancel drawing":"✎ Draw on the map"}
  wrap.style.touchAction=Z.armed?"none":"";cv.style.cursor=Z.armed?"crosshair":"";
  q$("znStat").textContent=status(k);
  document.querySelectorAll(".lrow").forEach(r=>{const zz=CFG.zonesOn&&zOf(r.dataset.k);r.classList.toggle("zoned",!!zz);r.title=zz?`Zone: ${zLabel(zz)}`:""})}
const edit=fn=>{const z=zOf(Z.sel);if(!z)return;fn(z);save();skyUpdate();sync()};
panel.querySelectorAll("[data-zk]").forEach(b=>b.onclick=()=>{Z.sel=b.dataset.zk;Z.armed=false;sync()});
panel.querySelectorAll("[data-zs]").forEach(b=>b.onclick=()=>setShape(b.dataset.zs));
q$("znR").oninput=e=>edit(z=>z.r=vToR(+e.target.value));
q$("znA").oninput=e=>edit(z=>z.a=+e.target.value);q$("znB").oninput=e=>edit(z=>z.b=+e.target.value);
q$("znReg").onchange=e=>edit(z=>z.id=e.target.value);
q$("znSoft").oninput=e=>edit(z=>z.soft=+e.target.value);
q$("znInv").onchange=e=>edit(z=>z.inv=e.target.checked);
q$("znHere").onclick=()=>edit(z=>{const c=viewCentre();z.lat=+c.lat.toFixed(2);z.lon=+c.lon.toFixed(2)});
q$("znDraw").onclick=q$("znDrawB").onclick=()=>{Z.armed=!Z.armed;Z.drawing=null;sync();if(Z.armed){xs(zOf(Z.sel).shape==="band"?"Drag up or down on the map to set the band":"Press where the centre goes and drag out the size");if(IS_MOBILE)cv.scrollIntoView({behavior:"smooth",block:"center"})}};
q$("znAll").onclick=()=>{const z=zOf(Z.sel);if(!z)return;ZKEYS.forEach(k=>CFG.zones[k]=clone(z));save();skyUpdate();sync();xs(`Every layer now listens to: ${zLabel(z)}`)};
q$("znClr").onclick=()=>{CFG.zones={};Z.armed=false;save();skyUpdate();sync();xs("All layers back to the whole Earth")};
q$("znOff").onclick=()=>setOn(false);
btn.addEventListener("click",e=>{e.stopPropagation();setOn(!CFG.zonesOn)});
function setOn(on){CFG.zonesOn=on;Z.armed=false;save();skyUpdate();sync();
  if(on){xs(Object.keys(CFG.zones).length?"Zones on":"Zones on: pick a layer, then Circle, Band or Region");if(IS_MOBILE)setTimeout(()=>panel.scrollIntoView({behavior:"smooth",block:"nearest"}),80)}else xs("Zones off: every layer hears the whole planet again")}

// draw: press the centre and drag out the radius (or drag a band). Captured before the globe's own drag.
const ptrPos=e=>{const r=cv.getBoundingClientRect();return invProj((e.clientX-r.left)*DPR,(e.clientY-r.top)*DPR)};
wrap.addEventListener("pointerdown",e=>{if(!Z.armed||!active()||e.target!==cv)return;const ll=ptrPos(e),z=zOf(Z.sel);if(!ll||!z)return;e.stopPropagation();e.preventDefault();
  Z.drawing={id:e.pointerId,ll,moved:false};try{cv.setPointerCapture(e.pointerId)}catch(_){}
  if(z.shape==="circle"){z.lat=+ll[1].toFixed(2);z.lon=+ll[0].toFixed(2)}else if(z.shape==="band"){z.a=z.b=Math.round(ll[1])}sync()},true);
wrap.addEventListener("pointermove",e=>{const d=Z.drawing;if(!d||e.pointerId!==d.id)return;e.stopPropagation();const ll=ptrPos(e),z=zOf(Z.sel);if(!ll||!z)return;
  if(z.shape==="circle"){const km=gcKm(d.ll[1],d.ll[0],ll[1],ll[0]);if(km>60){d.moved=true;z.r=clamp(Math.round(km/10)*10,100,10000)}}
  else if(z.shape==="band"){z.b=Math.round(ll[1]);d.moved=true}
  sync()},true);
const endDraw=e=>{const d=Z.drawing;if(!d||e.pointerId!==d.id)return;e.stopPropagation();Z.drawing=null;Z.armed=false;const z=zOf(Z.sel);
  if(z&&z.shape==="band"&&z.a===z.b){z.a=clamp(z.a-10,-90,90);z.b=clamp(z.b+10,-90,90)}
  save();skyUpdate();sync();if(z)xs(`${LNAME[Z.sel]}: ${zLabel(z)}`)};
wrap.addEventListener("pointerup",endDraw,true);wrap.addEventListener("pointercancel",endDraw,true);
addEventListener("keydown",e=>{if(e.key==="Escape"&&Z.armed){Z.armed=false;Z.drawing=null;sync()}});
setInterval(()=>{if(CFG.zonesOn&&!panel.hidden)q$("znStat").textContent=status(Z.sel)},1500);
// presets, sessions and share links replace CFG: pick zones back up from it
window.syncZones=()=>{if(!CFG.zones||typeof CFG.zones!=="object")CFG.zones={};skyUpdate();sync()};
const _after=window.afterCFG;if(typeof _after==="function")window.afterCFG=function(){const r=_after.apply(this,arguments);try{syncZones()}catch(_){}return r};
skyUpdate();sync();
})();
