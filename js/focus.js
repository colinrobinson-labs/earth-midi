/* Earth MIDI · camera focus + spin gestures.
   The globe is a microphone you point. What faces the camera is louder, clearer and panned where you see it;
   the far side of the planet sits quieter, darker and further back in the reverb. Spinning the globe plays the mix
   like a DJ: direction picks the filter, speed sets how far it sweeps, flicks throw the delay and push the tempo,
   and grabbing a fast-spinning globe brakes it.
   The data never changes. MIDI notes stay exactly what the sensors said; the camera is sent as its own CCs
   (channel 16) so a DAW can record the moves separately.
   Modes: off (unchanged), focus (mix follows the camera), full (focus + regional data + spin/zoom expression). */
"use strict";
const godOn=()=>!!(window.GOD&&window.GOD.on);
const VIEWMIX={
  off:{floor:1,peak:1,wet:0,lp:1},
  focus:{floor:.38,peak:1.12,wet:.35,lp:.55},
  full:{floor:.16,peak:1.25,wet:.55,lp:.3}};
const FOCUS={
  mode(){return CFG.mapView==="flat"||!VIEWMIX[CFG.viewMix]?"off":CFG.viewMix},
  on(){return this.mode()!=="off"},
  full(){return this.mode()==="full"},
  /* 0 = far side, 1 = dead centre of the view. Zooming in (full mode) narrows the cone. */
  near(lat,lon){if(!this.on())return 1;const l=(lon-VIEW.lon)*D2R,p=lat*D2R,p0=VIEW.lat*D2R;
    const c=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(l);let n=clamp((c+.25)/1.25,0,1);n=n*n*(3-2*n);
    return this.full()?Math.pow(n,1+Math.max(0,VIEW.zoom-1)*.9):n},
  gain(lat,lon){const m=VIEWMIX[this.mode()];return lerp(m.floor,m.peak,this.near(lat,lon))},
  /* stereo from where it sits on screen, not from its longitude */
  pan(lat,lon,fallback){if(!this.on())return fallback;const l=(lon-VIEW.lon)*D2R,p=lat*D2R;return clamp(Math.cos(p)*Math.sin(l)*.9,-.9,.9)},
  /* far things are darker and wetter */
  lpMul(lat,lon){const m=VIEWMIX[this.mode()];return lerp(m.lp,1,this.near(lat,lon))},
  wet(lat,lon){const m=VIEWMIX[this.mode()];return m.wet*(1-this.near(lat,lon))},
  /* a continuous layer made of many measuring points: as present as its two best-facing points */
  layerGain(pts){if(!this.on()||!pts.length)return 1;const n=pts.map(o=>this.near(o.lat,o.lon)).sort((a,b)=>b-a),top=(n[0]+(n[1]??n[0]))/2,m=VIEWMIX[this.mode()];return lerp(m.floor+.15,m.peak,top)},
  /* full mode: weight a per-point measurement by how much it faces you */
  weighted(pts,val){let s=0,w=0;for(const o of pts){const v=val(o);if(!Number.isFinite(v))continue;const k=Math.pow(this.near(o.lat,o.lon),2)+.02;s+=v*k;w+=k}return w?s/w:NaN},
  facing:null};

/* ---------- regional readings (full mode): you hear the weather you are looking at ----------
   A layer with a zone (js/zones.js) only averages the sensors inside its zone, in any view mode. */
function zAvg(k,pts,val){if(!ZN.has(k))return FOCUS.weighted(pts,val);const f=FOCUS.full();let s=0,w=0;
  for(const o of pts){const v=val(o);if(!Number.isFinite(v))continue;const zw=ZN.w(k,o.lat,o.lon);if(zw<=.001)continue;const q=zw*(f?Math.pow(FOCUS.near(o.lat,o.lon),2)+.02:1);s+=v*q;w+=q}return w?s/w:NaN}
const zOff=k=>!FOCUS.full()&&!ZN.has(k);
function viewOcean(t){if(zOff("o")||!S.ocean.length)return oceanAt(t);const h=zAvg("o",S.ocean,o=>at(o.ht,o.hist,t)),p=zAvg("o",S.ocean,o=>o.p);const g=oceanAt(t);return {h:Number.isFinite(h)?h:g.h,p:Number.isFinite(p)?p:g.p}}
function viewJet(t){if(zOff("w")||!S.jet.length)return jetAvg(t);const v=zAvg("w",S.jet,p=>tsAt(p,t));return Number.isFinite(v)?v:jetAvg(t)}
function viewAir(t){const g=airAt(t);if(zOff("a")||!S.air.length)return g;const pm=zAvg("a",S.air,o=>at(o.t,o.pm,t)),uv=zAvg("a",S.air,o=>at(o.t,o.uv,t));return Object.assign({},g,{pm:Number.isFinite(pm)?pm:g.pm,uv:Number.isFinite(uv)?uv:g.uv})}
function viewTide(){if(!S.tides.length)return null;let L=S.tides;if(ZN.has("t")){const inz=L.filter(o=>ZN.w("t",o.lat,o.lon)>.02);if(inz.length)L=inz;if(!FOCUS.full())return L.reduce((a,o)=>ZN.w("t",o.lat,o.lon)>ZN.w("t",a.lat,a.lon)?o:a)}
  if(!FOCUS.full())return L[0];return L.reduce((a,o)=>FOCUS.near(o.lat,o.lon)>FOCUS.near(a.lat,a.lon)?o:a)}
/* events: each active fire / volcano / storm counts by how much it faces you (and whether it is inside the zone) */
function viewCount(list){const z=ZN.has("e");if(!FOCUS.on()&&!z)return list.length;const m=VIEWMIX[FOCUS.mode()];return list.reduce((a,e)=>a+(z?ZN.w("e",e.lat,e.lon):1)*lerp(m.floor,1,FOCUS.near(e.lat,e.lon)),0)}

/* ---------- motion: angular velocity of the globe, whoever moves it ---------- */
const MOTION={vlon:0,vlat:0,speed:0,energy:0,dir:0,tilt:0,push:0,brake:0,throw:0,inertia:null,samples:[],last:null,label:"",labelT:0};
function motionStep(now){
  const m=MOTION,dt=m.last?clamp((now-m.last.t)/1000,.001,.1):0;if(godOn())m.inertia=null;
  if(m.inertia&&!VIEW.drag&&CFG.mapView!=="flat"&&!godOn()){const f=Math.exp(-dt*(m.inertia.fast?1.6:.9));m.inertia.vlon*=f;m.inertia.vlat*=f;
    VIEW.lon=((VIEW.lon+m.inertia.vlon*dt+540)%360)-180;VIEW.lat=clamp(VIEW.lat+m.inertia.vlat*dt,-80,80);if(Math.abs(VIEW.lat)>=80)m.inertia.vlat=0;VIEW.lastInteract=now;
    if(Math.hypot(m.inertia.vlon,m.inertia.vlat)<2.5)m.inertia=null}
  if(m.last&&dt>0){let dl=VIEW.lon-m.last.lon;if(dl>180)dl-=360;if(dl<-180)dl+=360;const vl=dl/dt,va=(VIEW.lat-m.last.lat)/dt,a=1-Math.exp(-dt/.06);
    m.vlon+=(vl-m.vlon)*a;m.vlat+=(va-m.vlat)*a;m.speed=Math.hypot(m.vlon*Math.cos(VIEW.lat*D2R),m.vlat);
    // energy: fast attack, slow release, ignores the idle auto-spin
    const target=clamp((m.speed-6)/380,0,1);m.energy+=(target-m.energy)*(1-Math.exp(-dt/(target>m.energy?.05:.7)));
    m.dir+=(clamp(-m.vlon/160,-1,1)*Math.min(1,m.speed/40)-m.dir)*(1-Math.exp(-dt/.25)); // +1 = spinning east (surface moves left→right)
    m.tilt+=(clamp(m.vlat/160,-1,1)-m.tilt)*(1-Math.exp(-dt/.25));
    m.push+=((m.energy>.5?(m.energy-.5)*.16:0)-m.push)*(1-Math.exp(-dt/(m.energy>.5?.15:1.6)));
    m.brake*=Math.exp(-dt/.35);m.throw*=Math.exp(-dt/1.4)}
  m.last={t:now,lon:VIEW.lon,lat:VIEW.lat};
}
function motionLabel(txt){MOTION.label=txt;MOTION.labelT=performance.now();const el=$("motionLbl");if(el){el.textContent=txt;el.classList.add("on");clearTimeout(motionLabel.t);motionLabel.t=setTimeout(()=>el.classList.remove("on"),2200)}}
// fling + catch, layered on the existing drag in visuals.js (these run after its handlers, so VIEW is already updated)
cv.addEventListener("pointermove",()=>{if(!VIEW.drag)return;const m=MOTION,now=performance.now();m.samples.push([now,VIEW.lon,VIEW.lat]);while(m.samples.length>2&&now-m.samples[0][0]>160)m.samples.shift()});
cv.addEventListener("pointerdown",()=>{const m=MOTION;if(ptr.size>1){m.inertia=null;return}
  if(m.inertia&&FOCUS.full()&&Math.hypot(m.inertia.vlon,m.inertia.vlat)>140&&!godOn()){m.brake=1;motionLabel("caught · brake");midiCC(16,90,127)}
  m.inertia=null;m.samples=[]});
cv.addEventListener("pointerup",e=>{const m=MOTION;if(godOn()||CFG.mapView==="flat"||ptr.size>0)return;const s=m.samples;m.samples=[];if(s.length<2)return;
  const a=s[0],b=s[s.length-1],dt=(b[0]-a[0])/1000;if(dt<.012||performance.now()-b[0]>160)return;let dl=b[1]-a[1];if(dl>180)dl-=360;if(dl<-180)dl+=360;
  const vlon=dl/dt,vlat=(b[2]-a[2])/dt,sp=Math.hypot(vlon,vlat);if(sp<25)return;
  const fast=sp>320;m.inertia={vlon:clamp(vlon,-1400,1400),vlat:clamp(vlat,-400,400),fast};
  if(!FOCUS.full())return;
  if(fast){m.throw=1;motionLabel(`hard flick ${vlon<0?"east":"west"} · delay throw + tempo push`);midiCC(16,91,127)}
  else motionLabel(sp<110?`gentle spin · ${vlon<0?"east opens the highs":"west warms the lows"}`:`spin ${vlon<0?"east":"west"} · ${vlon<0?"high-pass":"low-pass"} sweep`)});
const motionLoop=now=>{try{motionStep(now)}catch(err){console.error(err)}requestAnimationFrame(motionLoop)};requestAnimationFrame(motionLoop);

/* ---------- what the motion does to the master bus (full mode only) ---------- */
/* Direction picks the side of a DJ bi-filter (east = high-pass, west = low-pass), speed sets the depth.
   Overall speed adds reverb wash; tilting north/south leans the delay feedback; a hard flick throws the delay;
   a catch dives the low-pass and drags the tempo like a tape stop; flicks push the Pulse tempo up to +8 %. */
function motionFX(){const m=MOTION,on=FOCUS.full()&&!godOn(),e=on?m.energy:0,d=on?m.dir:0;
  const hp=d>0?lerp(0,900,Math.min(1,e*1.4)*d):0,lpk=d<0?Math.pow(1-Math.min(1,e*1.3)*(-d)*.93,2):1;
  return {hp,lpMul:Math.min(lpk,on?1-m.brake*.97:1),rev:e*.35,fb:on?clamp(m.throw*.32+m.tilt*.12*e,-.2,.4):0,dly:on?m.throw*.55+e*.2:0,
    pan:on?clamp(d*e*.35,-.35,.35):0,tempo:on?m.push-m.brake*.25:0,sky:FOCUS.full()?lerp(1,.72,clamp((VIEW.zoom-1)/2,0,1)):1}}

/* per-bus level: point layers follow the camera, sky layers (sun, flares, magnetosphere) step back as you zoom in */
function focusBus(k,FX){if(!FOCUS.on())return 1;switch(k){case"o":return FOCUS.layerGain(S.ocean);case"w":return FOCUS.layerGain(S.jet);case"a":return FOCUS.layerGain(S.air);
  case"t":{const s=viewTide();return s?lerp(.55,1.1,FOCUS.near(s.lat,s.lon)):1}case"s":case"x":case"g":return FX.sky;default:return 1}}

/* per-tick: camera → MIDI CCs on channel 16 (85 focus lon, 86 focus lat, 87 spin speed, 88 zoom, 89 spin direction) */
function focusTick(){if(CFG.mapView==="flat")return;midiCC(16,85,map(VIEW.lon,-180,180,0,127));midiCC(16,86,map(VIEW.lat,-80,80,0,127));midiCC(16,87,map(MOTION.speed,0,600,0,127));midiCC(16,88,map(VIEW.zoom,.7,3.2,0,127));midiCC(16,89,map(MOTION.dir,-1,1,0,127));
  // what you're looking at, for the HUD
  if(FOCUS.on()){let best=null,bn=0;for(const o of S.temps){const n=FOCUS.near(o.lat,o.lon);if(n>bn){bn=n;best=o}}for(const o of S.ocean){const n=FOCUS.near(o.lat,o.lon);if(n>bn){bn=n;best=o}}FOCUS.facing=bn>.6?best:null}else FOCUS.facing=null}

/* ---------- visual: soft focus cone + motion arc on the rim ---------- */
function drawFocus(now){if(!FOCUS.on())return;const W=cv.width,H=cv.height,R=globeR(),gx=W/2,gy=H/2,m=MOTION,act=clamp((performance.now()-VIEW.lastInteract<2500?.6:0)+m.energy,0,1);
  const r=R*(FOCUS.full()?lerp(.62,.42,clamp((VIEW.zoom-1)/2,0,1)):.7);
  if(act>.02){cx.save();cx.strokeStyle=`rgba(230,240,255,${.10*act})`;cx.setLineDash([2*DPR,6*DPR]);cx.lineWidth=1*DPR;cx.beginPath();cx.arc(gx,gy,r,0,7);cx.stroke();cx.restore()}
  if(m.energy>.03&&FOCUS.full()){const ang=Math.atan2(m.vlat,-m.vlon*Math.cos(VIEW.lat*D2R)),span=.25+m.energy*1.1,col=m.dir>=0?"255,210,122":"60,200,255";
    cx.save();cx.lineCap="round";for(let i=0;i<3;i++){cx.strokeStyle=`rgba(${col},${(.45-i*.13)*m.energy})`;cx.lineWidth=(3-i)*DPR;cx.beginPath();cx.arc(gx,gy,R+(5+i*5)*DPR,ang-span/2-i*.08,ang+span/2+i*.08);cx.stroke()}cx.restore()}
  if(m.brake>.05){cx.fillStyle=`rgba(255,90,60,${.08*m.brake})`;cx.beginPath();cx.arc(gx,gy,R,0,7);cx.fill()}}

/* ---------- HUD toggle ---------- */
function syncViewMix(){document.querySelectorAll("[data-vmix]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.vmix===(CFG.viewMix||"off")));const w=$("vmixWrap");if(w)w.classList.toggle("dim",CFG.mapView==="flat")}
const VMIX_HELP={off:"View doesn't change the sound",focus:"What faces you is louder and panned where you see it; the far side drifts back",full:"Focus + you hear the oceans, wind and air you're looking at · spin to play the mix (east = high-pass, west = low-pass, flick = delay throw, grab = brake, zoom in = closer)"};
document.querySelectorAll("[data-vmix]").forEach(b=>b.onclick=()=>{CFG.viewMix=b.dataset.vmix;try{localStorage.setItem("em5.cfg",JSON.stringify(CFG))}catch(_){}syncViewMix();if(CFG.mapView==="flat")xs("Sound follows view works on the Globe");else xs(VMIX_HELP[CFG.viewMix])});
syncViewMix();
