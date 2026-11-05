/* Earth MIDI · ZEUS MODE sandbox (internal name: god).
   A separate "what if" mode. Nothing in here is real data: you are the weather.
   Gestures on the globe drive their own synths and MIDI, recorded as takes you can replay and export.
   Self-contained: wraps initAudio + drawMap, injects its own UI and CSS. Sandbox audio enters the master
   chain at A.hp (after A.sum), so it is heard, metered and recorded; live layers fade via A.sum.gain. */
"use strict";
(()=>{
const GOLD="#ffc83d";
COLS.G=GOLD;
const G={on:false,tool:"auto",storms:[],aur:[0,0],moon:{x:.86,y:.82},tideF:0,tideStep:-1,flash:0,flashRGB:"255,236,180",cmes:[],shocks:[],shake:0,
  mix:0,rec:null,replay:null,last:"",nid:1,tEnter:-1e9,tExit:-1e9,amt:0,hintT:0,dust:[],sunC:0};
window.GOD=G;
const now_=()=>performance.now();
const godKp=()=>clamp(2+Math.max(G.aur[0],G.aur[1])*5,0,9);
const scl=()=>scaleFor(godKp());

/* ================= audio ================= */
let GA=null;
const _initAudio=initAudio;
initAudio=function(){_initAudio();setupAudio()};
function setupAudio(){if(!A||GA)return;const ctx=A.ctx;
  const bus=ctx.createGain();bus.gain.value=.85;
  const send=ctx.createGain();send.gain.value=.5;const rev=ctx.createConvolver();rev.buffer=genIR(ctx,"cathedral");const revG=ctx.createGain();revG.gain.value=.55;
  bus.connect(A.hp);bus.connect(send);send.connect(rev);rev.connect(revG);revG.connect(A.hp);
  GA={ctx,bus,send};
  // aurora: detuned shimmer pad, tremolo, bandpassed
  {const out=ctx.createGain();out.gain.value=0;const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=2200;bp.Q.value=.8;
   const am=ctx.createGain();am.gain.value=.75;const tr=ctx.createOscillator();tr.frequency.value=4.8;const tg=ctx.createGain();tg.gain.value=.25;tr.connect(tg);tg.connect(am.gain);tr.start();
   const vs=[0,1,2,3,4].map(i=>{const o=ctx.createOscillator();o.type=i%2?"triangle":"sine";o.frequency.value=440;const l=ctx.createOscillator();l.frequency.value=.09+i*.047;const lg=ctx.createGain();lg.gain.value=11;l.connect(lg);lg.connect(o.detune);l.start();
     const g=ctx.createGain();g.gain.value=.06;const p=ctx.createStereoPanner();p.pan.value=[-.85,-.4,0,.4,.85][i];o.connect(g);g.connect(p);p.connect(bp);o.start();return o});
   bp.connect(am);am.connect(out);out.connect(bus);out.connect(send);GA.aur={out,vs,bp}}
  // tides: saw + sub sine drone through a lowpass, pitch from the moon
  {const o=ctx.createOscillator(),o2=ctx.createOscillator(),o3=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o2.type="sine";o3.type="sawtooth";o3.detune.value=9;
   lp.type="lowpass";lp.frequency.value=300;lp.Q.value=3;g.gain.value=0;const g2=ctx.createGain();g2.gain.value=.8;const g3=ctx.createGain();g3.gain.value=.5;
   o.connect(lp);o3.connect(g3);g3.connect(lp);o2.connect(g2);g2.connect(g);lp.connect(g);g.connect(bus);[o,o2,o3].forEach(x=>{x.frequency.value=mtof(ROOT-12);x.start()});GA.tide={o,o2,o3,lp,g}}
}
function ensureAudio(){try{iosUnlock()}catch(_){}if(!A)initAudio();else setupAudio();A.ctx.resume();setMix()}
function setMix(){if(!A)return;const c=A.ctx.currentTime;A.sum.gain.setTargetAtTime(G.on?.72*G.mix:.72,c,.35)}
function nz(){const s=GA.ctx.createBufferSource();s.buffer=A.nb;return s}
function env(g,t,peak,att,dec){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(.0004,t+att+dec)}
function fadeOut(param,t,tc){try{const v=param.value;param.cancelScheduledValues(t);param.setValueAtTime(v,t)}catch(_){}param.setTargetAtTime(0,t,tc)}
const panOf=(lon,lat)=>{const[x,,v]=proj(lon,lat);return v>0?clamp(x/cv.width*2-1,-1,1)*.9:clamp(((lon-VIEW.lon+540)%360-180)/90,-1,1)*.9};
function boom(t,amp){const {ctx,bus}=GA,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(30,t+.6);env(g,t,amp,.006,1.8);o.connect(g);g.connect(bus);o.start(t);o.stop(t+2);
  const n=nz(),f=ctx.createBiquadFilter(),ng=ctx.createGain();f.type="lowpass";f.frequency.value=160;env(ng,t,amp*1.1,.02,1.6);n.connect(f);f.connect(ng);ng.connect(bus);n.start(t,Math.random()*3);n.stop(t+1.8)}
function enterSound(on){if(!GA)return;const {ctx,bus,send}=GA,c=ctx.currentTime+.02,sc=scl();
  const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.Q.value=5;const g=ctx.createGain();lp.connect(g);g.connect(bus);g.connect(send);
  if(on){lp.frequency.setValueAtTime(180,c);lp.frequency.exponentialRampToValueAtTime(5600,c+1.1);lp.frequency.exponentialRampToValueAtTime(800,c+4);env(g,c,.2,.9,3.6)}
  else{lp.frequency.setValueAtTime(4800,c);lp.frequency.exponentialRampToValueAtTime(160,c+1.6);env(g,c,.16,.03,1.8)}
  [0,2,4,7,9,11].forEach((d,i)=>{const o=ctx.createOscillator();o.type="sawtooth";const n=degree(sc,d,ROOT);o.frequency.setValueAtTime(mtof(n),c);if(!on)o.frequency.exponentialRampToValueAtTime(mtof(n-12),c+1.8);o.detune.value=(i-2.5)*8;const vg=ctx.createGain();vg.gain.value=.11;o.connect(vg);vg.connect(lp);o.start(c);o.stop(c+5)});
  const n=nz(),hp=ctx.createBiquadFilter(),ng=ctx.createGain();hp.type="highpass";hp.frequency.setValueAtTime(on?400:6000,c);hp.frequency.exponentialRampToValueAtTime(on?7000:300,c+1);ng.gain.setValueAtTime(0,c);ng.gain.linearRampToValueAtTime(on?.14:.08,c+(on?.85:.05));ng.gain.exponentialRampToValueAtTime(.0004,c+(on?1.4:1.2));n.connect(hp);hp.connect(ng);ng.connect(bus);ng.connect(send);n.start(c,Math.random()*2);n.stop(c+1.5);
  if(on)boom(c+.85,.85)}
function chargeSound(kind){if(!GA)return null;const {ctx,bus}=GA,c=ctx.currentTime,fl=kind==="flare";const o=ctx.createOscillator(),g=ctx.createGain(),n=nz(),nf=ctx.createBiquadFilter(),ng=ctx.createGain();n.loop=true;
  o.type=fl?"triangle":"sine";o.frequency.setValueAtTime(fl?330:42,c);o.frequency.exponentialRampToValueAtTime(fl?2600:150,c+1.8);g.gain.setValueAtTime(0,c);g.gain.linearRampToValueAtTime(fl?.05:.2,c+1.8);
  nf.type=fl?"bandpass":"lowpass";nf.Q.value=fl?3:1;nf.frequency.setValueAtTime(fl?1200:70,c);nf.frequency.exponentialRampToValueAtTime(fl?9000:520,c+1.8);ng.gain.setValueAtTime(0,c);ng.gain.linearRampToValueAtTime(fl?.07:.22,c+1.8);
  o.connect(g);g.connect(bus);n.connect(nf);nf.connect(ng);ng.connect(bus);o.start(c);n.start(c,Math.random()*3);
  return ()=>{const t=ctx.currentTime;fadeOut(g.gain,t,.03);fadeOut(ng.gain,t,.03);o.stop(t+.3);n.stop(t+.3)}}
function quakeSound(p){if(!GA)return {n:60,vel:100};const {ctx,bus,send}=GA,c=ctx.currentTime+.01,sc=scl(),n=degree(sc,Math.round(map(p.lat,-75,75,0,sc.length*3-1)),ROOT),f=mtof(n),vel=Math.round(map(p.mag,2,9,40,127)),amp=Math.pow(vel/127,1.4)*.55,dec=1.4+p.mag*.55,pan=ctx.createStereoPanner();
  pan.pan.value=panOf(p.lon,p.lat);pan.connect(bus);pan.connect(send);
  const car=ctx.createOscillator(),mod=ctx.createOscillator(),mg=ctx.createGain(),eg=ctx.createGain();car.frequency.value=f;mod.frequency.value=f*1.41;mg.gain.setValueAtTime(f*map(p.mag,2,9,2,9),c);mg.gain.exponentialRampToValueAtTime(f*.02,c+dec*.6);env(eg,c,amp,.004,dec);mod.connect(mg);mg.connect(car.frequency);car.connect(eg);eg.connect(pan);car.start(c);mod.start(c);car.stop(c+dec+.2);mod.stop(c+dec+.2);
  const cr=nz(),hf=ctx.createBiquadFilter(),cg=ctx.createGain();hf.type="highpass";hf.frequency.value=2200;env(cg,c,amp*.6,.001,.07);cr.connect(hf);hf.connect(cg);cg.connect(pan);cr.start(c,Math.random()*3);cr.stop(c+.12);
  const s=ctx.createOscillator(),sg=ctx.createGain();s.frequency.setValueAtTime(mtof(ROOT-12)*2,c);s.frequency.exponentialRampToValueAtTime(mtof(ROOT-24),c+.4);env(sg,c,map(p.mag,2,9,.15,.85),.008,1+p.mag*.45);s.connect(sg);sg.connect(bus);s.start(c);s.stop(c+5+p.mag*.5);
  if(p.mag>=4){const r=nz(),rf=ctx.createBiquadFilter(),rg=ctx.createGain();rf.type="lowpass";rf.frequency.value=150;rf.Q.value=2;rg.gain.setValueAtTime(0,c);rg.gain.linearRampToValueAtTime(map(p.mag,4,9,.3,1.3),c+.12);rg.gain.exponentialRampToValueAtTime(.0004,c+p.mag*.8);r.connect(rf);rf.connect(rg);rg.connect(bus);r.start(c,Math.random()*3);r.stop(c+p.mag*.8+.1)}
  return {n,vel,dec}}
function flareSound(k){if(!GA)return [];const {ctx,bus,send}=GA,c=ctx.currentTime+.01,sc=scl(),len=2+k*4;
  const n=nz(),bp=ctx.createBiquadFilter(),g=ctx.createGain();bp.type="bandpass";bp.Q.value=1.4;bp.frequency.setValueAtTime(9500,c);bp.frequency.exponentialRampToValueAtTime(600,c+len*.7);env(g,c,.18+k*.3,.02,len);n.connect(bp);bp.connect(g);g.connect(bus);g.connect(send);n.start(c,Math.random()*2);n.stop(c+len+.2);
  const notes=[];for(let i=0;i<8;i++){const nn=degree(sc,sc.length*2+i,ROOT+12),t=c+i*.05,o=ctx.createOscillator(),og=ctx.createGain(),p=ctx.createStereoPanner();o.frequency.value=mtof(nn);p.pan.value=i%2?.7:-.7;env(og,t,.045+k*.03,.004,1.6+k*2.8);o.connect(og);og.connect(p);p.connect(bus);p.connect(send);o.start(t);o.stop(t+5);notes.push(nn)}
  [0,7,12,19].forEach((d,i)=>{const o=ctx.createOscillator(),og=ctx.createGain(),t=c+.08+i*.1;o.type="triangle";o.frequency.value=mtof(ROOT+24+d);env(og,t,.07,.02,3+k*3);o.connect(og);og.connect(send);og.connect(bus);o.start(t);o.stop(t+7)});
  if(k>.6)boom(c,.6+k*.3);return notes}
let lastSpark=0;
function sparkle(e,h){if(!GA||now_()-lastSpark<70)return;lastSpark=now_();const {ctx,bus,send}=GA,c=ctx.currentTime+.005,sc=scl(),n=degree(sc,sc.length*2+Math.floor(Math.random()*sc.length*1.5),ROOT),o=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner();
  o.frequency.value=mtof(n);p.pan.value=Math.random()*1.6-.8;env(g,c,clamp(.02+e*.4,.02,.07),.003,.5);o.connect(g);g.connect(p);p.connect(bus);p.connect(send);o.start(c);o.stop(c+.6);gnote(4,n,Math.round(clamp(50+e*400,40,120)),160);pushNote(n,"G",80,.3)}
function stormVoice(s){if(!GA)return;const {ctx,bus,send}=GA,src=nz();src.loop=true;src.playbackRate.value=.75+Math.random()*.5;
  const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.Q.value=2.6;bp.frequency.value=300;const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=200;lp.Q.value=1.5;
  const g=ctx.createGain(),gl=ctx.createGain();g.gain.value=0;gl.gain.value=0;const p=ctx.createStereoPanner();
  src.connect(bp);bp.connect(g);src.connect(lp);lp.connect(gl);g.connect(p);gl.connect(p);p.connect(bus);g.connect(send);src.start(ctx.currentTime,Math.random()*3);s.v={src,bp,g,gl,p}}
function stormKill(s){if(!s.v)return;const t=GA.ctx.currentTime;fadeOut(s.v.g.gain,t,.5);fadeOut(s.v.gl.gain,t,.5);s.v.src.stop(t+3);s.v=null;gtx([0x80+1,s.note&127,0])}

/* ================= MIDI (live out + take recorder) ================= */
// ch1 quakes · ch2 hurricanes · ch3 flares · ch4 aurora · ch5 tides
const lastV={};
function gtx(b){try{if(typeof out!=="undefined"&&out)out.send(b)}catch(_){}if(G.rec&&G.rec.midi.length<200000)G.rec.midi.push([now_()-G.rec.t0,b])}
function gnote(ch,n,v,ms){n=clamp(Math.round(n),0,127);v=clamp(Math.round(v),1,127);gtx([0x90+ch-1,n,v]);setTimeout(()=>gtx([0x80+ch-1,n,0]),ms)}
function gcc(ch,cc,v){v=Math.round(clamp(v,0,127));const k=ch*128+cc;if(lastV[k]===v)return;lastV[k]=v;gtx([0xB0+ch-1,cc,v])}
function gpb(ch,x){const v=Math.round(8192+clamp(x,-1,1)*8191);if(lastV["pb"+ch]===v)return;lastV["pb"+ch]=v;gtx([0xE0+ch-1,v&127,v>>7])}

/* ================= actions (gestures and take replay both go through here) ================= */
function act(type,p,fromReplay){
  if(G.rec&&!fromReplay)G.rec.ev.push([Math.round(now_()-G.rec.t0),type,p]);
  if(fromReplay&&p.id!=null){const m=G.replay.ids;if(type==="s+")m[p.id]=G.nid++;p=Object.assign({},p,{id:m[p.id]})}
  if(type==="quake")doQuake(p);else if(type==="flare")doFlare(p);else if(type==="s+")stormNew(p);else if(type==="s~")stormMove(p);else if(type==="s-")stormRelease(p);else if(type==="aur")doAurora(p);else if(type==="moon"){G.moon.x=p.x;G.moon.y=p.y}}
function doQuake(p){const r=quakeSound(p);gnote(1,r.n,r.vel,Math.round((r.dec||2)*400));pushNote(r.n,"G",r.vel,r.dec||2);
  S.rings.push({lat:p.lat,lon:p.lon,mag:p.mag,t:now_()});G.shocks.push({lat:p.lat,lon:p.lon,mag:p.mag,t:now_()});G.flash=Math.max(G.flash,map(p.mag,2,9,.12,.7));G.flashRGB="255,214,140";G.shake=Math.max(G.shake,map(p.mag,2,9,2,22));
  if(navigator.vibrate&&p.mag>5)try{navigator.vibrate(Math.round(p.mag*25))}catch(_){}G.last=`M${p.mag.toFixed(1)} quake → ${noteName(r.n)}`}
function doFlare(p){const k=clamp(p.c,0,1),flux=Math.pow(10,-6+3.4*k),cls=flareClass(flux),notes=flareSound(k);[0,7,12].forEach((d,i)=>gnote(3,ROOT+24+d,Math.round(70+k*57),1200+i*200));pushNote(ROOT+24,"G",110,3);
  G.cmes.push({t:now_(),k});G.flash=Math.max(G.flash,.35+k*.6);G.flashRGB="255,248,225";G.sunC=0;
  // cause → effect: the flare's particles hit the magnetosphere a moment later
  setTimeout(()=>{if(!G.on)return;G.aur[0]=Math.min(1.5,G.aur[0]+.25+k*.7);G.aur[1]=Math.min(1.5,G.aur[1]+.2+k*.6);G.last=`${cls} flare hit the poles: aurora`},1700+(1-k)*900);
  G.last=`${cls} solar flare`;return notes}
function stormNew(p){const s={id:p.id,lat:p.lat,lon:p.lon,e:.18,held:true,vlat:0,vlon:0,rot:Math.random()*6,dir:p.lat>=0?-1:1,born:now_(),trail:[[p.lon,p.lat]]};
  const sc=scl();s.note=degree(sc,Math.round(map(p.lat,-60,60,0,sc.length*2)),ROOT-12);gtx([0x91,s.note&127,90]);pushNote(s.note,"G",90,4);
  G.storms.push(s);stormVoice(s);while(G.storms.filter(x=>x.v).length>5){const o=G.storms.find(x=>x.v);o.e=Math.min(o.e,.1);o.held=false;stormKill(o)}G.last="hurricane forming"}
function stormMove(p){const s=G.storms.find(x=>x.id===p.id);if(!s)return;s.lat=clamp(p.lat,-78,78);s.lon=p.lon;s.e=Math.min(1.5,s.e+(p.e||0));s.dir=s.lat>=0?-1:1;s.trail.push([s.lon,s.lat]);if(s.trail.length>60)s.trail.shift()}
function stormRelease(p){const s=G.storms.find(x=>x.id===p.id);if(!s)return;s.held=false;s.vlat=clamp(p.dlat||0,-6,6);s.vlon=clamp(p.dlon||0,-10,10);G.last=`Category ${cat(s.e)} hurricane`}
const cat=e=>clamp(1+Math.floor(e*3.4),1,5);
function doAurora(p){const h=p.h>0?0:1;G.aur[h]=Math.min(1.5,G.aur[h]+p.e);sparkle(p.e,h);G.last=`aurora · Kp ${godKp().toFixed(1)}`}
const moonHome=()=>cv.clientWidth<560?{x:.84,y:.68}:{x:.86,y:.82};
function calm(){G.storms.forEach(s=>{s.e=0;stormKill(s)});G.storms=[];G.aur=[0,0];G.cmes=[];G.moon=moonHome();msg("The planet is calm")}

/* ================= engine tick (audio params, decay, replay) ================= */
let lastTick=now_();
function tick(){const t=now_(),dt=Math.min(.2,(t-lastTick)/1000);lastTick=t;
  if(G.replay){const R=G.replay,el=t-R.t0;while(R.i<R.ev.length&&R.ev[R.i][0]<=el){const [,ty,p]=R.ev[R.i++];act(ty,p,true)}if(R.i>=R.ev.length&&el>R.dur+500){G.replay=null;syncBtns();msg("Take finished")}}
  if(!G.on&&G.amt<=0)return;
  G.aur=G.aur.map(a=>a*Math.exp(-dt/(G.on?11:1.2)));
  if(!A||!GA)return;const c=A.ctx.currentTime,sc=scl();
  if(G.on&&!S.on){const v=+($("vol")?.value||.8);A.out.gain.setTargetAtTime(v,c,.25)}
  // storms
  let maxE=0;G.storms.forEach(s=>{if(!s.held)s.e-=dt*(G.on?.035:.5);maxE=Math.max(maxE,s.e);if(!s.v)return;const e=Math.max(0,s.e),wob=Math.sin(s.rot*1.3)*e*350;
    s.v.bp.frequency.setTargetAtTime(240+e*2400+wob,c,.12);s.v.bp.Q.setTargetAtTime(2+e*3,c,.3);s.v.g.gain.setTargetAtTime(Math.min(.42,e*.34),c,.15);s.v.gl.gain.setTargetAtTime(Math.min(.55,e*.5),c,.2);s.v.p.pan.setTargetAtTime(panOf(s.lon,s.lat),c,.1)});
  G.storms.filter(s=>s.e<=0.015).forEach(stormKill);G.storms=G.storms.filter(s=>s.e>0.015);
  gcc(2,1,maxE/1.5*127);gcc(2,74,map(maxE,0,1.5,0,127));
  // aurora pad
  const ae=Math.max(G.aur[0],G.aur[1]);GA.aur.out.gain.setTargetAtTime(G.on?Math.min(.5,ae*.42):0,c,.25);GA.aur.bp.frequency.setTargetAtTime(1400+ae*2600,c,.4);
  GA.aur.vs.forEach((o,i)=>o.frequency.setTargetAtTime(mtof(degree(sc,[0,2,4,6,8][i],ROOT+12)),c,.6));gcc(4,11,ae/1.5*127);
  // tides from the moon: tidal force falls with distance cubed
  const W=cv.width,H=cv.height,gx=W/2,gy=H/2,R=CFG.mapView==="flat"?H*.46:globeR(),mx=G.moon.x*W,my=G.moon.y*H,d=Math.max(.6,Math.hypot(mx-gx,my-gy)/R);
  G.tideF=clamp(Math.pow(1.15/d,3),0,1.6)/1.6;const ang=(Math.atan2(my-gy,mx-gx)/(2*Math.PI)+1)%1,step=Math.floor(ang*sc.length*1.5),n=degree(sc,step,ROOT-12);
  [GA.tide.o,GA.tide.o2,GA.tide.o3].forEach(o=>o.frequency.setTargetAtTime(mtof(n)*(o===GA.tide.o2?.5:1),c,.18));
  GA.tide.o.detune.setTargetAtTime(G.tideF*40,c,.3);GA.tide.lp.frequency.setTargetAtTime(160+G.tideF*1900,c,.2);GA.tide.g.gain.setTargetAtTime(G.on?.05+G.tideF*.17:0,c,.3);
  if(G.on&&step!==G.tideStep){if(G.tideNote!=null)gtx([0x84,G.tideNote,0]);G.tideNote=n&127;gtx([0x94,G.tideNote,Math.round(50+G.tideF*70)]);G.tideStep=step;pushNote(n,"G",70,1.2)}
  gcc(5,1,G.tideF*127);gpb(5,(G.tideF-.3)*.6);
}
setInterval(tick,50);

/* ================= projection helpers ================= */
function unproj(px,py){const W=cv.width,H=cv.height;if(CFG.mapView==="flat")return [px/W*360-180,clamp(90-py/H*180,-89,89)];
  const R=globeR(),x=px-W/2,y=H/2-py,rho=Math.hypot(x,y);if(rho>R)return null;if(rho<1e-6)return [VIEW.lon,VIEW.lat];
  const c=Math.asin(clamp(rho/R,-1,1)),p0=VIEW.lat*D2R,lat=Math.asin(clamp(Math.cos(c)*Math.sin(p0)+y*Math.sin(c)*Math.cos(p0)/rho,-1,1))/D2R,lon=VIEW.lon+Math.atan2(x*Math.sin(c),rho*Math.cos(c)*Math.cos(p0)-y*Math.sin(c)*Math.sin(p0))/D2R;
  return [((lon+540)%360)-180,lat]}
let hudB=0;const sunPx=()=>{const W=cv.width,H=cv.height,m=Math.min(W,H),r=Math.max(20*DPR,m*.058);return {x:Math.max(W*.12,r*1.9),y:Math.max(H*.19,hudB*DPR+r*1.9),r}};
function measureHud(){const h=wrap.querySelector(".hud2");if(h)hudB=h.offsetTop+h.offsetHeight}addEventListener("resize",measureHud);
const moonPx=()=>{const W=cv.width,H=cv.height,m=Math.min(W,H);return {x:G.moon.x*W,y:G.moon.y*H,r:Math.max(15*DPR,m*.04)}};
const hit=(o,p,pad=1.5)=>Math.hypot(p.x-o.x,p.y-o.y)<o.r*pad+10*DPR;

/* ================= gestures ================= */
const wrap=cv.closest(".mapwrap");const P=new Map();let GS=null;
const toPx=e=>{const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*DPR,y:(e.clientY-r.top)*DPR}};
function startGesture(pt){const tool=G.tool,t=now_(),ll=unproj(pt.x,pt.y);
  if(tool==="flare"||(tool==="auto"&&hit(sunPx(),pt)))return {kind:"flare",t,pt,ll};
  if(tool==="tide"||(tool==="auto"&&hit(moonPx(),pt))){const m=moonPx();return {kind:"moon",dx:tool==="tide"&&!hit(m,pt)?0:m.x-pt.x,dy:tool==="tide"&&!hit(m,pt)?0:m.y-pt.y,lastA:0}}
  if(tool==="spin"||!ll)return {kind:"spin",x:pt.x,y:pt.y,lon:VIEW.lon,lat:VIEW.lat};
  if(tool==="aurora"||(tool==="auto"&&Math.abs(ll[1])>=58))return {kind:"aurora",last:pt,h:ll[1]>=0?1:-1,acc:0,lastA:0};
  if(tool==="storm"){const g={kind:"storm",t,pt,last:pt,hist:[[t,ll[1],ll[0]]],acc:0,lastA:0};g.id=G.nid++;act("s+",{id:g.id,lat:ll[1],lon:ll[0]});return g}
  return {kind:tool==="quake"?"quake":"pend",t,pt,ll}}
function moveGesture(g,pt){const t=now_();VIEW.lastInteract=t;
  if(g.kind==="spin"){const k=180/(globeR()/DPR*Math.PI)/DPR;VIEW.lon=((g.lon-(pt.x-g.x)*k+540)%360)-180;VIEW.lat=clamp(g.lat+(pt.y-g.y)*k,-80,80);return}
  if(g.kind==="moon"){const W=cv.width,H=cv.height;G.moonMoved=1;G.moon.x=clamp((pt.x+g.dx)/W,.04,.96);G.moon.y=clamp((pt.y+g.dy)/H,.05,.95);if(t-g.lastA>40){g.lastA=t;act("moon",{x:+G.moon.x.toFixed(4),y:+G.moon.y.toFixed(4)})}return}
  if(g.kind==="aurora"){const d=Math.hypot(pt.x-g.last.x,pt.y-g.last.y);g.last=pt;g.acc+=d/(globeR()*2)*.8;if(t-g.lastA>60&&g.acc>.004){g.lastA=t;act("aur",{h:g.h,e:+g.acc.toFixed(4)});g.acc=0}return}
  if(g.kind==="pend"&&Math.hypot(pt.x-g.pt.x,pt.y-g.pt.y)>12*DPR){if(g.stop)g.stop();g.stop=null;g.kind="storm";g.id=G.nid++;g.last=g.pt;g.hist=[[t,g.ll[1],g.ll[0]]];g.acc=0;g.lastA=0;act("s+",{id:g.id,lat:g.ll[1],lon:g.ll[0]})}
  if(g.kind==="storm"){const ll=unproj(pt.x,pt.y);if(!ll)return;g.acc+=Math.hypot(pt.x-g.last.x,pt.y-g.last.y)/globeR()*.32;g.last=pt;g.hist.push([t,ll[1],ll[0]]);while(g.hist.length>2&&t-g.hist[0][0]>350)g.hist.shift();
    if(t-g.lastA>40){g.lastA=t;act("s~",{id:g.id,lat:+ll[1].toFixed(3),lon:+ll[0].toFixed(3),e:+g.acc.toFixed(4)});g.acc=0}}}
function endGesture(g){const t=now_();if(g.stop)g.stop();
  if(g.kind==="pend"||g.kind==="quake"){if(!g.ll)return;const mag=+(2+7*clamp((t-g.t)/1800,0,1)).toFixed(1);act("quake",{lat:+g.ll[1].toFixed(3),lon:+g.ll[0].toFixed(3),mag})}
  else if(g.kind==="flare"){act("flare",{c:+chargeOf(g).toFixed(3)})}
  else if(g.kind==="storm"){if(g.acc>0)act("s~",{id:g.id,lat:g.hist.at(-1)[1],lon:g.hist.at(-1)[2],e:g.acc});const a=g.hist[0],b=g.hist.at(-1),dts=Math.max(.05,(b[0]-a[0])/1000);let dl=b[2]-a[2];if(dl>180)dl-=360;if(dl<-180)dl+=360;act("s-",{id:g.id,dlat:+((b[1]-a[1])/dts*.3).toFixed(3),dlon:+(dl/dts*.3).toFixed(3)})}
  else if(g.kind==="aurora"){act("aur",{h:g.h,e:+Math.max(.12,g.acc).toFixed(4)})}}
const chargeOf=g=>clamp(Math.max((now_()-g.t)/1800,g.pinch?(g.pd/g.pd0-1)/1.6:0),0,1);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
wrap.addEventListener("pointerdown",e=>{if(!G.on||e.target!==cv)return;e.stopPropagation();e.preventDefault();ensureAudio();G.hintT=Math.min(G.hintT,now_()+3000);
  try{cv.setPointerCapture(e.pointerId)}catch(_){}document.body.classList.add("god-drag");try{getSelection().removeAllRanges()}catch(_){}const pt=toPx(e);P.set(e.pointerId,pt);VIEW.lastInteract=now_();
  if(P.size===2){const [a,b]=[...P.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(GS&&GS.kind==="flare"){GS.pinch=true;GS.pd0=Math.max(1,dist(a,b));GS.pd=GS.pd0;return}
    if(GS&&GS.kind==="storm")endGesture(GS);else if(GS&&GS.stop)GS.stop();
    GS=(G.tool==="auto"||G.tool==="flare")&&hit(sunPx(),mid,2.4)?{kind:"flare",t:now_(),pinch:true,pd0:Math.max(1,dist(a,b)),pd:dist(a,b)}:{kind:"zoom",d0:Math.max(1,dist(a,b)),z0:VIEW.zoom,m0:mid,lon:VIEW.lon,lat:VIEW.lat};return}
  if(P.size>2)return;GS=(e.button===1||e.button===2||e.shiftKey)?{kind:"spin",x:pt.x,y:pt.y,lon:VIEW.lon,lat:VIEW.lat}:startGesture(pt)},{capture:true});
wrap.addEventListener("pointermove",e=>{if(!G.on||(e.target!==cv&&!P.has(e.pointerId)))return;e.stopPropagation();const pt=toPx(e);
  if(!P.has(e.pointerId)){if(e.pointerType==="mouse"){const ll=unproj(pt.x,pt.y);cv.style.cursor=hit(sunPx(),pt)?"pointer":hit(moonPx(),pt)?"grab":!ll?"move":Math.abs(ll[1])>=58?"cell":"crosshair"}return}
  P.set(e.pointerId,pt);if(!GS)return;
  if(P.size===2){const [a,b]=[...P.values()],d=dist(a,b);if(GS.kind==="zoom"&&CFG.mapView!=="flat"){VIEW.zoom=clamp(GS.z0*d/GS.d0,.7,3.2);const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},k=180/(globeR()/DPR*Math.PI)/DPR;VIEW.lon=((GS.lon-(mid.x-GS.m0.x)*k+540)%360)-180;VIEW.lat=clamp(GS.lat+(mid.y-GS.m0.y)*k,-80,80);VIEW.lastInteract=now_()}else if(GS.kind==="flare")GS.pd=d;return}
  moveGesture(GS,pt)},{capture:true});
const up=e=>{if(!P.has(e.pointerId))return;e.stopPropagation();P.delete(e.pointerId);if(!P.size)document.body.classList.remove("god-drag");if(!GS)return;
  if(e.type==="pointercancel"){if(GS.stop)GS.stop();if(GS.kind==="storm")endGesture(GS);GS=null;return}
  if(GS.kind==="zoom"){if(!P.size)GS=null;return}
  if(GS.pinch&&P.size)return;endGesture(GS);GS=null};
wrap.addEventListener("pointerup",up,{capture:true});wrap.addEventListener("mousedown",e=>{if(G.on&&e.target===cv)e.preventDefault()},{capture:true});wrap.addEventListener("contextmenu",e=>{if(G.on&&e.target===cv)e.preventDefault()},{capture:true});wrap.addEventListener("pointercancel",up,{capture:true});

/* ================= visuals (drawn on #map, after the live map, so video captures it) ================= */
let lastF=now_();
for(let i=0;i<70;i++)G.dust.push([Math.random(),Math.random(),Math.random()*.6+.2,Math.random()*6]);
const _draw=drawMap;
drawMap=function(now){_draw(now);const t=now_(),dt=Math.min(.1,(t-lastF)/1000);lastF=t;
  const target=G.on?1:0;G.amt=clamp(G.amt+(target-G.amt)*Math.min(1,dt*(G.on?2.2:3.2)),0,1);if(!G.on&&G.amt<.01)G.amt=0;
  if(G.amt<=0){if(cv.style.transform)cv.style.transform="";return}
  // charge timers
  if(GS&&(GS.kind==="pend"||GS.kind==="quake"||GS.kind==="flare")&&!GS.stop&&!GS.charged&&t-GS.t>140){GS.charged=1;GS.stop=chargeSound(GS.kind==="flare"?"flare":"quake")}
  try{overlay(now,t,dt)}catch(err){console.error(err)}};
function overlay(now,t,dt){const W=cv.width,H=cv.height,a=G.amt,globe=CFG.mapView!=="flat",R=globe?globeR():H*.46,gx=W/2,gy=H/2,m=Math.min(W,H);
  cx.save();
  // 1. make it unmistakably not real: everything goes gold
  cx.globalCompositeOperation="destination-over";const bg=cx.createRadialGradient(gx,gy*.8,0,gx,gy,Math.max(W,H)*.8);bg.addColorStop(0,`rgba(40,26,4,${a})`);bg.addColorStop(1,`rgba(6,4,0,${a})`);cx.fillStyle=bg;cx.fillRect(0,0,W,H);
  cx.globalCompositeOperation="color";cx.fillStyle=`rgba(255,184,28,${.96*a})`;cx.fillRect(0,0,W,H);
  cx.globalCompositeOperation="soft-light";const sl=cx.createRadialGradient(gx,gy,R*.2,gx,gy,R*1.2);sl.addColorStop(0,`rgba(255,240,190,${.5*a})`);sl.addColorStop(1,`rgba(0,0,0,${.3*a})`);cx.fillStyle=sl;cx.fillRect(0,0,W,H);
  cx.globalCompositeOperation="lighter";
  // divine light: slow rotating rays from above + gold halo
  const rx=W*.5,ry=-H*.25,rot=now/9000;for(let i=0;i<9;i++){const an=Math.PI/2+Math.sin(rot+i*1.7)*.55+(i-4)*.09,w=.025+.02*Math.sin(now/1300+i),L=H*1.6;cx.fillStyle=`rgba(255,215,120,${(.035+.02*Math.sin(now/900+i*2))*a})`;cx.beginPath();cx.moveTo(rx,ry);cx.lineTo(rx+Math.cos(an-w)*L,ry+Math.sin(an-w)*L);cx.lineTo(rx+Math.cos(an+w)*L,ry+Math.sin(an+w)*L);cx.fill()}
  if(globe){const hg=cx.createRadialGradient(gx,gy,R*.96,gx,gy,R*1.28);hg.addColorStop(0,`rgba(255,200,70,${.45*a})`);hg.addColorStop(.35,`rgba(255,170,40,${(.14+.06*Math.sin(now/700))*a})`);hg.addColorStop(1,"rgba(255,170,40,0)");cx.fillStyle=hg;cx.beginPath();cx.arc(gx,gy,R*1.3,0,7);cx.fill()}
  G.dust.forEach(d=>{d[1]-=dt*.012*d[2];if(d[1]<0){d[1]=1;d[0]=Math.random()}const x=(d[0]+Math.sin(now/3000+d[3])*.01)*W,y=d[1]*H,s=d[2]*2.2*DPR;cx.fillStyle=`rgba(255,220,140,${(.25+.25*Math.sin(now/400+d[3]))*a})`;cx.fillRect(x,y,s,s)});
  // 2. tides: tidal bulge toward the moon + gravity lines
  const mp=moonPx(),tf=G.tideF;
  if(globe){const ang=Math.atan2(mp.y-gy,mp.x-gx),b=.025+.09*tf;cx.save();cx.translate(gx,gy);cx.rotate(ang);for(let k=0;k<3;k++){cx.strokeStyle=`rgba(150,235,255,${(.5-k*.14)*a*(.4+tf)})`;cx.lineWidth=(3-k)*DPR;cx.beginPath();cx.ellipse(0,0,R*(1+b*(1+k*.35)+.004*Math.sin(now/400+k)),R*(1-b*.35),0,0,7);cx.stroke()}cx.restore();
    cx.setLineDash([2*DPR,7*DPR]);cx.lineDashOffset=-now/30;for(let i=-2;i<=2;i++){const ang=Math.atan2(mp.y-gy,mp.x-gx)+i*.18,ex=gx+Math.cos(ang)*R,ey=gy+Math.sin(ang)*R;cx.strokeStyle=`rgba(190,240,255,${(.12+.3*tf)*a})`;cx.lineWidth=1.2*DPR;cx.beginPath();cx.moveTo(mp.x,mp.y);cx.quadraticCurveTo((mp.x+ex)/2+i*14*DPR,(mp.y+ey)/2-i*10*DPR,ex,ey);cx.stroke()}cx.setLineDash([])}
  // 3. aurora curtains around the geomagnetic poles
  [[80.7,-72.7],[-80.7,107.3]].forEach(([pl,plo],h)=>{const e=G.aur[h];if(e<.02)return;const kp=2+e*5,rad=90-(67-2*kp),z=globe?VIEW.zoom:1;
    for(let k=0;k<5;k++){const wob=Math.sin(now/700+k*1.3)*1.4*e;cx.strokeStyle=k<3?`rgba(${90+k*30},255,${150+k*20},${clamp(e*.55,0,.8)*(1-k*.15)*a})`:`rgba(220,${110+k*10},255,${clamp(e*.45,0,.7)*a})`;cx.lineWidth=(9-k*1.4)*DPR*z*clamp(e,.35,1.4);strokePath(smallCircle(pl,plo,rad+k*1.7+wob,120))}
    const n=72,inner=smallCircle(pl,plo,rad,n),outer=smallCircle(pl,plo,rad+3+6*e,n);cx.lineWidth=2*DPR*z;
    for(let i=0;i<n;i+=1){const fl=.5+.5*Math.sin(now/180+i*1.9)*Math.sin(now/410+i*.7);if(fl<.35)continue;const [x1,y1,v1]=proj(inner[i][0],inner[i][1]),[x2,y2,v2]=proj(outer[i][0],outer[i][1]);if(globe&&(v1<=0||v2<=0))continue;
      cx.strokeStyle=`rgba(140,255,180,${fl*e*.45*a})`;cx.beginPath();cx.moveTo(x1,y1);cx.lineTo((x1+x2)/2,(y1+y2)/2);cx.stroke();cx.strokeStyle=`rgba(210,130,255,${fl*e*.25*a})`;cx.beginPath();cx.moveTo((x1+x2)/2,(y1+y2)/2);cx.lineTo(x2,y2);cx.stroke()}});
  // 4. hurricanes
  G.storms.forEach(s=>{if(!s.held){s.lat=clamp(s.lat+s.vlat*dt,-78,78);s.lon=((s.lon+s.vlon*dt+540)%360)-180;s.vlat*=Math.exp(-dt*.25);s.vlon*=Math.exp(-dt*.25)}s.rot+=dt*(1.2+s.e*5)*s.dir;
    const[x,y,v]=proj(s.lon,s.lat);if(globe&&v<=0)return;const e=Math.max(0,s.e),fade=clamp(e*3,0,1)*a,Rs=(20+e*80)*DPR*(globe?VIEW.zoom*(.55+.45*v):1);
    if(s.trail.length>1){cx.strokeStyle=`rgba(255,240,200,${.12*fade})`;cx.lineWidth=Rs*.5;cx.lineCap="round";strokePath(s.trail);cx.lineCap="butt"}
    const cg=cx.createRadialGradient(x,y,Rs*.1,x,y,Rs*1.1);cg.addColorStop(0,`rgba(255,250,230,${.35*fade})`);cg.addColorStop(.6,`rgba(255,220,150,${.16*fade})`);cg.addColorStop(1,"rgba(255,220,150,0)");cx.fillStyle=cg;cx.beginPath();cx.arc(x,y,Rs*1.1,0,7);cx.fill();
    for(let arm=0;arm<4;arm++){cx.beginPath();for(let i=0;i<=30;i++){const f=i/30,r=Rs*(.16+f*.95),th=s.rot+arm*Math.PI/2+f*2.8*-s.dir;const px=x+Math.cos(th)*r,py=y+Math.sin(th)*r*(globe?.75+.25*v:1);i?cx.lineTo(px,py):cx.moveTo(px,py)}
      cx.strokeStyle=`rgba(255,248,225,${(.7-arm*.05)*fade})`;cx.lineWidth=(2.6+e*2.4)*DPR;cx.stroke()}
    cx.strokeStyle=`rgba(255,255,255,${.95*fade})`;cx.lineWidth=2.2*DPR;cx.beginPath();cx.arc(x,y,Rs*.14,0,7);cx.stroke();
    if(e>.25){cx.font=`700 ${10*DPR}px "IBM Plex Mono",monospace`;cx.fillStyle=`rgba(255,240,200,${fade})`;cx.fillText(`CAT ${cat(e)}`,x+Rs*.9,y-Rs*.7)}});
  // 5. god-made quakes: hot shock rings
  G.shocks=G.shocks.filter(q=>t-q.t<3200+q.mag*500);G.shocks.forEach(q=>{const age=(t-q.t)/(3200+q.mag*500),[x,y,v]=proj(q.lon,q.lat);
    for(let k=0;k<4;k++){const aa=clamp(age-k*.08,0,1);if(aa<=0)continue;cx.strokeStyle=`rgba(255,${200-k*30},${120-k*20},${(1-aa)*.9*a})`;cx.lineWidth=(4-k*.7)*DPR;strokePath(smallCircle(q.lat,q.lon,Math.max(.4,aa*map(q.mag,2,9,8,70)),64))}
    if((!globe||v>0)&&age<.2){const r=map(q.mag,2,9,10,60)*DPR*(1+age*4),g=cx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,255,240,${(1-age/.2)*a})`);g.addColorStop(1,"rgba(255,160,60,0)");cx.fillStyle=g;cx.beginPath();cx.arc(x,y,r,0,7);cx.fill()}});
  // 6. the sun + coronal mass ejections
  const sp=sunPx();let sr=sp.r,charge=0;if(GS&&GS.kind==="flare"){charge=chargeOf(GS);sr*=1+charge*.7+Math.sin(now/40)*charge*.05}
  G.cmes=G.cmes.filter(c=>t-c.t<2800);G.cmes.forEach(c=>{const age=(t-c.t)/2800,r=sp.r+age*Math.hypot(W,H)*1.1;cx.strokeStyle=`rgba(255,250,220,${(1-age)*.8*a})`;cx.lineWidth=(6+c.k*16)*(1-age)*DPR;cx.beginPath();cx.arc(sp.x,sp.y,r,0,7);cx.stroke();
    cx.strokeStyle=`rgba(255,190,90,${(1-age)*.5*a})`;cx.lineWidth=2*DPR;cx.beginPath();cx.arc(sp.x,sp.y,r*.86,0,7);cx.stroke()});
  for(let i=0;i<18;i++){const an=i/18*Math.PI*2+now/5000,L=sr*(1.45+.35*Math.sin(now/260+i*2.1)+charge*.9);cx.strokeStyle=`rgba(255,226,140,${(.35+charge*.4)*a})`;cx.lineWidth=(2+charge*3)*DPR;cx.beginPath();cx.moveTo(sp.x+Math.cos(an)*sr*1.02,sp.y+Math.sin(an)*sr*1.02);cx.lineTo(sp.x+Math.cos(an)*L,sp.y+Math.sin(an)*L);cx.stroke()}
  const sg=cx.createRadialGradient(sp.x,sp.y,0,sp.x,sp.y,sr*2.6);sg.addColorStop(0,`rgba(255,255,245,${a})`);sg.addColorStop(.32,`rgba(255,220,110,${.9*a})`);sg.addColorStop(.4,`rgba(255,170,40,${.45*a})`);sg.addColorStop(1,"rgba(255,140,20,0)");cx.fillStyle=sg;cx.beginPath();cx.arc(sp.x,sp.y,sr*2.6,0,7);cx.fill();
  cx.globalCompositeOperation="source-over";
  // 7. the moon
  {const r=mp.r*(GS&&GS.kind==="moon"?1.15:1),mg=cx.createRadialGradient(mp.x-r*.35,mp.y-r*.35,r*.1,mp.x,mp.y,r);mg.addColorStop(0,`rgba(250,252,255,${a})`);mg.addColorStop(1,`rgba(150,165,190,${a})`);
    cx.shadowColor=`rgba(190,235,255,${.9*a})`;cx.shadowBlur=(14+tf*30)*DPR;cx.fillStyle=mg;cx.beginPath();cx.arc(mp.x,mp.y,r,0,7);cx.fill();cx.shadowBlur=0;
    cx.fillStyle=`rgba(110,120,140,${.45*a})`;[[.3,-.2,.22],[-.3,.25,.16],[.05,.4,.12],[-.2,-.35,.1]].forEach(([u,w,s])=>{cx.beginPath();cx.arc(mp.x+u*r,mp.y+w*r,s*r,0,7);cx.fill()})}
  // 8. charging a quake: crosshair ring + magnitude readout
  if(GS&&(GS.kind==="pend"||GS.kind==="quake")&&GS.ll&&t-GS.t>90){const c=clamp((t-GS.t)/1800,0,1),mag=2+7*c,j=c*4*DPR,x=GS.pt.x+(Math.random()-.5)*j,y=GS.pt.y+(Math.random()-.5)*j,r=(10+c*46)*DPR;
    cx.strokeStyle=`rgba(255,240,200,${a})`;cx.lineWidth=2*DPR;cx.beginPath();cx.arc(x,y,r,-Math.PI/2,-Math.PI/2+c*Math.PI*2);cx.stroke();cx.strokeStyle=`rgba(255,200,120,${.5*a})`;cx.beginPath();cx.arc(x,y,r*.55,0,7);cx.stroke();
    cx.beginPath();cx.moveTo(x-r*1.3,y);cx.lineTo(x-r*.7,y);cx.moveTo(x+r*.7,y);cx.lineTo(x+r*1.3,y);cx.moveTo(x,y-r*1.3);cx.lineTo(x,y-r*.7);cx.moveTo(x,y+r*.7);cx.lineTo(x,y+r*1.3);cx.stroke();
    label(`M${mag.toFixed(1)}`,x+r+8*DPR,y-r*.6,14,a);G.shake=Math.max(G.shake,c*3)}
  if(charge>0)label(flareClass(Math.pow(10,-6+3.4*charge)),sp.x+sr*1.6,sp.y+sr*1.9,14,a);
  // 9. flash, vignette, labels
  if(G.flash>.005){cx.fillStyle=`rgba(${G.flashRGB},${G.flash*a})`;cx.fillRect(0,0,W,H);G.flash*=Math.exp(-dt*3.2)}
  const vg=cx.createRadialGradient(gx,gy,m*.35,gx,gy,Math.hypot(W,H)*.62);vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,`rgba(20,10,0,${.6*a})`);cx.fillStyle=vg;cx.fillRect(0,0,W,H);
  if(t<G.hintT){const ha=clamp((G.hintT-t)/1500,0,1)*a;tag("☀ hold or pinch: flare",sp.x,sp.y+sp.r*2.6,ha);tag("☾ drag: tides",mp.x,mp.y-mp.r-12*DPR,ha)}
  // watermark (also lands in recorded video)
  {const s=`⚡ ZEUS MODE · SANDBOX · NOT REAL DATA`;cx.font=`800 ${10.5*DPR}px "IBM Plex Mono",monospace`;const tw=cx.measureText(s).width,px=W-tw-22*DPR,py=H-(S.recVideo?44:W/DPR<560?58:40)*DPR;cx.fillStyle=`rgba(20,12,0,${.75*a})`;rr(px-8*DPR,py-14*DPR,tw+16*DPR,22*DPR,11*DPR);cx.fill();cx.fillStyle=`rgba(255,200,61,${a})`;cx.fillText(s,px,py+1*DPR)}
  if(S.recVideo){cx.fillStyle="#1a1200";cx.fillRect(0,H-28*DPR,W,28*DPR);cx.fillStyle=GOLD;cx.font=`700 ${12*DPR}px "IBM Plex Mono",monospace`;cx.fillText("EARTH MIDI · ZEUS MODE SANDBOX · performed by hand, not real data · earthmidi.com",12*DPR,H-10*DPR)}
  // 10. entrance title
  const ea=(t-G.tEnter)/2600;if(G.on&&ea>=0&&ea<1){const k=ea<.15?ea/.15:ea>.7?(1-ea)/.3:1,sc=1.25-.25*Math.min(1,ea/.25),fs=Math.min(W/7.2,H/4.2);cx.save();cx.translate(gx,gy);cx.scale(sc,sc);cx.textAlign="center";cx.textBaseline="middle";
    cx.font=`800 ${fs}px Syne,system-ui,sans-serif`;cx.shadowColor="rgba(255,190,40,.95)";cx.shadowBlur=40*DPR;cx.fillStyle=`rgba(255,236,170,${k})`;cx.fillText("ZEUS MODE",0,-fs*.12);cx.shadowBlur=0;
    cx.font=`700 ${Math.max(11*DPR,fs*.16)}px "IBM Plex Mono",monospace`;cx.fillStyle=`rgba(255,210,100,${k})`;cx.fillText("SANDBOX · YOU ARE THE WEATHER · NOT REAL DATA",0,fs*.55);cx.restore()}
  const xa=(t-G.tExit)/1400;if(!G.on&&xa>=0&&xa<1){const fs=Math.min(W/12,H/7);cx.textAlign="center";cx.textBaseline="middle";cx.font=`800 ${fs}px Syne,system-ui,sans-serif`;cx.fillStyle=`rgba(230,240,255,${(1-xa)})`;cx.fillText("BACK TO REAL EARTH",gx,gy);cx.textAlign="left";cx.textBaseline="alphabetic"}
  cx.restore();
  // camera shake (CSS, so the page itself trembles)
  if(G.shake>.2){cv.style.transform=`translate(${((Math.random()-.5)*G.shake).toFixed(1)}px,${((Math.random()-.5)*G.shake).toFixed(1)}px)`;G.shake*=Math.exp(-dt*5)}else if(cv.style.transform){cv.style.transform="";G.shake=0}}
function rr(x,y,w,h,r){cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
function label(s,x,y,size,a){cx.font=`700 ${size*DPR}px "IBM Plex Mono",monospace`;cx.lineWidth=4*DPR;cx.strokeStyle=`rgba(20,12,0,${.8*a})`;cx.strokeText(s,x,y);cx.fillStyle=`rgba(255,240,200,${a})`;cx.fillText(s,x,y)}
function tag(s,x,y,a){if(a<=0)return;cx.font=`600 ${10.5*DPR}px "IBM Plex Mono",monospace`;const w=cx.measureText(s).width;const px=clamp(x-w/2,6*DPR,cv.width-w-6*DPR);cx.fillStyle=`rgba(20,12,0,${.7*a})`;rr(px-7*DPR,y-13*DPR,w+14*DPR,20*DPR,10*DPR);cx.fill();cx.fillStyle=`rgba(255,226,150,${a})`;cx.fillText(s,px,y+1*DPR)}

/* ================= takes: record, replay, export ================= */
function recToggle(){if(G.rec){const r=G.rec;G.rec=null;r.dur=now_()-r.t0;G.take={ev:r.ev,midi:r.midi,dur:r.dur,made:new Date().toISOString(),key:CFG.key,scale:CFG.scale};syncBtns();msg(r.ev.length?`Take saved: ${r.ev.length} gestures, ${(r.dur/1000).toFixed(1)} s. Replay it or export the MIDI`:"Take was empty");return}
  if(G.replay){G.replay=null}G.rec={t0:now_(),ev:[],midi:[]};syncBtns();msg("Recording your gestures… play the planet, then press ■")}
function replayTake(){if(!G.take||!G.take.ev.length){msg("Record a take first");return}if(G.rec)recToggle();ensureAudio();if(G.replay){G.replay=null;syncBtns();return}
  calm();G.replay={ev:G.take.ev,i:0,t0:now_(),dur:G.take.dur,ids:{}};syncBtns();msg("Replaying your take")}
function exportMid(){const tk=G.take;if(!tk||!tk.midi.length){msg("Record a take first: ● Record take, then play the globe");return}
  const bpm=120,tpq=480,k=tpq*bpm/60000,names={1:"Quakes · note = latitude, velocity = magnitude",2:"Hurricanes · note per storm, CC1 + CC74 = intensity",3:"Solar flares · chord, velocity = flare class",4:"Aurora · sparkle notes, CC11 = aurora strength",5:"Tides · drone note from the moon's angle, CC1 + pitch bend = tidal pull"},by={};
  tk.midi.forEach(([ms,b])=>{const ch=(b[0]&15)+1;(by[ch]=by[ch]||[]).push([ms*k,b])});
  const tracks=[{name:"Earth MIDI · Zeus Mode take",text:["ZEUS MODE SANDBOX TAKE: performed by hand on the globe. NOT real planetary data.",`Recorded ${tk.made} · ${(tk.dur/1000).toFixed(1)} s · key ${KEYS[CFG.key]}`],ev:[]}];
  Object.keys(by).sort((a,b)=>a-b).forEach(ch=>tracks.push({name:`ch ${ch} · ${names[ch]||"sandbox"}`,ev:by[ch]}));
  download(`earth-midi-zeus-mode_${stamp()}.mid`,smf(tracks,tpq,bpm));msg(`Saved take MIDI: ${tk.midi.length} events on ${tracks.length-1} tracks`)}
function exportTake(){const tk=G.take;if(!tk){msg("Record a take first");return}download(`earth-midi-zeus-mode_${stamp()}.json`,new Blob([JSON.stringify({app:"Earth MIDI",godTake:true,version:VERSION,note:"Zeus Mode sandbox take. Gestures performed by hand, not real data.",credit:CREDIT,made:tk.made,dur:tk.dur,ev:tk.ev,midi:tk.midi})],{type:"application/json"}));msg("Take file saved. Load it later to replay it")}
async function loadTake(f){try{const j=JSON.parse(await f.text());if(!j.godTake||!Array.isArray(j.ev))throw new Error("not a Zeus Mode take");G.take={ev:j.ev,midi:j.midi||[],dur:j.dur||((j.ev.at(-1)||[0])[0]+1000),made:j.made};if(!G.on)setGod(true);replayTake()}catch(e){msg("Couldn't load: "+e.message)}}

/* ================= UI ================= */
const css=`
.godbtn{position:relative;font:700 11.5px var(--mono);letter-spacing:.04em;padding:7px 12px;border-radius:10px;color:#1a1200;background:linear-gradient(135deg,#fff1b8,#ffc83d 45%,#d18a00);border:1px solid #ffd76a;box-shadow:0 0 16px rgba(255,190,40,.45);white-space:nowrap}
.godbtn::after{content:"";position:absolute;inset:-1px;border-radius:inherit;box-shadow:0 0 30px 4px rgba(255,200,60,.8);opacity:0;animation:gpulse 2.6s ease-in-out infinite;pointer-events:none}
.godbtn:hover{border-color:#fff1b8}
@keyframes gpulse{50%{opacity:1}}
body.god .godbtn{background:rgba(20,12,0,.85);color:#ffc83d}body.god .godbtn::after{animation:none}
#godTicker{position:absolute;left:0;right:0;top:0;height:24px;overflow:hidden;z-index:4;pointer-events:none;background:#1a1200;opacity:0;transform:translateY(-100%);transition:transform .5s cubic-bezier(.2,1.4,.4,1),opacity .4s;border-bottom:1px solid #ffc83d}
#godTicker div{display:flex;width:max-content;animation:gtick 22s linear infinite}
#godTicker span{font:800 11px/24px var(--mono);letter-spacing:.16em;color:#ffc83d;padding:0 18px;white-space:nowrap}
#godTicker span:nth-child(even){color:#1a1200;background:#ffc83d}
@keyframes gtick{to{transform:translateX(-50%)}}
body.god #godTicker{opacity:1;transform:none}
.hud2{transition:top .4s}
body.god .hud2{top:34px}
body.god .stage{border-color:#ffc83d;box-shadow:0 0 0 1px #ffc83d,0 0 50px rgba(255,190,40,.4)}
body.god-drag{-webkit-user-select:none;user-select:none}
body.god .mapwrap{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body.god #map{cursor:crosshair}
body.god .hud .hint2{display:none}
body.god #wxl,body.god #motionLbl{display:none}
body.god #tl,body.god .tlh{opacity:.3}
body.god .grid,body.god .row2,body.god #trace,body.god .zero{opacity:.4}
.grid,.row2,#trace,.zero{transition:opacity .6s}
body.god h1 .L{background-image:linear-gradient(100deg,#fff6cf,#ffc83d 25%,#a86a00 50%,#ffe28a 75%,#fff6cf);filter:drop-shadow(0 0 calc(10px + var(--glow)*30px) rgba(255,190,40,.75))}
body.god::before{background:radial-gradient(60% 40% at 50% 0%,rgba(255,190,40,.2),transparent 70%),radial-gradient(40% 40% at 50% 60%,rgba(255,170,30,.07),transparent 70%)!important}
#godFrame{position:fixed;inset:0;pointer-events:none;z-index:70;opacity:0;transition:opacity .7s;box-shadow:inset 0 0 0 3px #ffc83d,inset 0 0 140px rgba(255,170,20,.25);will-change:opacity}
#godFrame::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 3px #fff1c0,inset 0 0 200px rgba(255,170,20,.3);opacity:0;animation:gframe 2.8s ease-in-out infinite;will-change:opacity}
body.god #godFrame{opacity:1}
@keyframes gframe{50%{opacity:1}}
#godPanel{border-top:1px solid #ffc83d;padding:12px 14px 14px;background:linear-gradient(180deg,rgba(255,190,40,.13),rgba(255,190,40,.03) 70%),#0d0a03;animation:gpan .5s ease}
@keyframes gpan{from{opacity:0;transform:translateY(-8px)}}
.gp-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.gp-h b{font:800 17px var(--disp);letter-spacing:.02em;color:#ffc83d;text-shadow:0 0 18px rgba(255,190,40,.6)}
.gp-h span{font:600 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:#1a1200;background:#ffc83d;border-radius:999px;padding:3px 9px}
.gp-h button{margin-left:auto}
.gp-tools{display:flex;gap:6px;flex-wrap:wrap}
.gp-tools button{font:600 12px var(--mono);border-radius:999px;padding:8px 13px;border-color:rgba(255,200,61,.35);background:#140f04;color:#ffe6a6;min-height:38px}
.gp-tools button[aria-pressed="true"]{background:#ffc83d;color:#1a1200;border-color:#ffc83d;box-shadow:0 0 16px rgba(255,190,40,.5)}
.gp-hint{font:12px/1.55 var(--mono);color:#d9c38e;margin:10px 0}
.gp-hint b{color:#ffe6a6;font-weight:600}
.gp-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.gp-row button,.gp-row .btnlike{font:600 12px var(--mono);border-color:rgba(255,200,61,.35);background:#140f04;color:#ffe6a6;min-height:38px;display:inline-flex;align-items:center}
.gp-row button.on{animation:bl 1s infinite}
.gp-mix{display:flex;align-items:center;gap:8px;font:11px var(--mono);color:#d9c38e;margin-left:auto}
.gp-mix input{accent-color:#ffc83d;width:120px}
#gStat{font:11.5px var(--mono);color:#ffc83d;margin-top:8px;min-height:18px}
@media (max-width:700px){body.god .hud2{display:none}.gp-h span{display:none}.gp-h b{font-size:15px}.gp-h button{margin-left:auto;padding:7px 10px;font-size:12px}#godPanel{padding:10px}.gp-tools{display:grid;grid-template-columns:repeat(4,1fr)}.gp-tools button{padding:8px 4px;font-size:11.5px}.gp-row{display:grid;grid-template-columns:1fr 1fr}.gp-row button,.gp-row .btnlike{justify-content:center}.gp-mix{grid-column:1/-1;margin:4px 0 0}.gp-mix input{flex:1}.gp-h button{margin-left:0}}
@media (prefers-reduced-motion:reduce){.godbtn::after,#godTicker div,#godFrame::after{animation:none}}`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
const TOOLS=[["auto","⚡ Auto"],["quake","◉ Quake"],["storm","🌀 Storm"],["flare","☀ Flare"],["aurora","✦ Aurora"],["tide","☾ Tides"],["spin","↻ Spin"]];
const HINTS={auto:"<b>Tap the globe</b> to drop a quake (hold longer for a bigger one). <b>Drag across it</b> to spin up a hurricane. <b>Swipe near a pole</b> for aurora. <b>Hold or pinch the sun</b> for a flare. <b>Drag the moon</b> to pull the tides. <b>Turn the planet:</b> drag empty space, two fingers on a phone, or right-drag / Shift+drag with a mouse.",
  quake:"<b>Tap anywhere on the globe.</b> Hold to charge: up to M9 at 2 seconds. Pitch follows latitude, magnitude sets velocity.",storm:"<b>Drag across the globe.</b> Faster, longer strokes build a stronger storm. Let go and it drifts on its own.",
  flare:"<b>Hold anywhere</b> (or pinch the sun) to charge, release to fire. C, M or X class. A big flare lights up the aurora a moment later.",aurora:"<b>Swipe anywhere</b> to feed the aurora. Top half feeds the north, bottom half the south. A strong aurora turns the scale minor.",
  tide:"<b>Drag the moon</b> anywhere. Closer to the planet means stronger tides and a louder, brighter drone. Its angle sets the drone note.",spin:"<b>Drag anywhere to turn the planet</b>, pinch or scroll to zoom. Your storms ride along with it. In any tool, two fingers (phone) or right-drag / Shift+drag (mouse) also turns it."};
const ticker=document.createElement("div");ticker.id="godTicker";ticker.setAttribute("aria-hidden","true");ticker.innerHTML=`<div>${Array(12).fill("<span>⚡ ZEUS MODE</span><span>SANDBOX · NOT REAL DATA</span>").join("")}</div>`;wrap.appendChild(ticker);
const frameEl=document.createElement("div");frameEl.id="godFrame";frameEl.setAttribute("aria-hidden","true");document.body.appendChild(frameEl);
const btn=document.createElement("button");btn.className="godbtn";btn.id="godBtn";btn.setAttribute("aria-pressed","false");btn.title="Zeus Mode sandbox (z)";btn.textContent="⚡ Zeus Mode";(wrap.querySelector(".hud2")||wrap).appendChild(btn);
const panel=document.createElement("div");panel.id="godPanel";panel.hidden=true;
panel.innerHTML=`<div class="gp-h"><b>⚡ ZEUS MODE</b><span>Sandbox · not real data</span><button id="gExit">Back to real Earth</button></div>
<div class="gp-tools" role="toolbar" aria-label="Sandbox tools">${TOOLS.map(([k,l])=>`<button data-tool="${k}" aria-pressed="${k==="auto"}">${l}</button>`).join("")}</div>
<p class="gp-hint" id="gHint"></p>
<div class="gp-row"><button id="gRec">● Record take</button><button id="gPlay">▶ Replay take</button><button id="gMid">⬇ Take MIDI</button><button id="gJson">⬇ Take file</button><label class="btnlike">📂 Load take<input type="file" id="gLoad" accept=".json,application/json" hidden></label><button id="gCalm">✦ Calm the planet</button>
<label class="gp-mix">Real Earth underneath <input type="range" id="gMix" min="0" max="1" step=".05" value="0" aria-label="Real Earth level under the sandbox"></label></div>
<div id="gStat" role="status"></div>`;
wrap.parentNode.insertBefore(panel,wrap.nextSibling);
const g$=id=>panel.querySelector("#"+id);
function msg(t){const s=g$("gStat");if(s){s.textContent=t;s._msgUntil=now_()+4500}try{xs(t)}catch(_){}}
function setTool(k){G.tool=k;panel.querySelectorAll("[data-tool]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tool===k));g$("gHint").innerHTML=HINTS[k]}
function syncBtns(){const r=g$("gRec"),p=g$("gPlay");r.classList.toggle("on",!!G.rec);r.textContent=G.rec?"■ Stop take":"● Record take";p.textContent=G.replay?"■ Stop replay":"▶ Replay take";p.disabled=!G.take&&!G.replay;g$("gMid").disabled=g$("gJson").disabled=!G.take}
panel.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
g$("gExit").onclick=()=>setGod(false);g$("gRec").onclick=()=>{ensureAudio();recToggle()};g$("gPlay").onclick=replayTake;g$("gMid").onclick=exportMid;g$("gJson").onclick=exportTake;g$("gCalm").onclick=calm;
g$("gLoad").onchange=e=>{e.target.files[0]&&loadTake(e.target.files[0]);e.target.value=""};
g$("gMix").oninput=e=>{G.mix=+e.target.value;setMix()};
btn.addEventListener("click",e=>{e.stopPropagation();setGod(!G.on)});
setTool("auto");syncBtns();
setInterval(()=>{if(!G.on)return;const s=g$("gStat");if(s){const kp=godKp(),txt=`${G.storms.length} storm${G.storms.length===1?"":"s"} · aurora Kp ${kp.toFixed(1)} · tidal pull ${Math.round(G.tideF*100)}%${G.last?" · last: "+G.last:""}${G.rec?" · ● REC "+((now_()-G.rec.t0)/1000).toFixed(0)+" s":""}`;if(!s._msgUntil||now_()>s._msgUntil)s.textContent=txt}},250);

function setGod(on){if(on===G.on)return;G.on=on;document.body.classList.toggle("god",on);btn.setAttribute("aria-pressed",on);btn.textContent=on?"✕ Exit sandbox":"⚡ Zeus Mode";panel.hidden=!on;
  const tip=$("tip");if(tip)tip.style.display="none";
  if(on){G.tEnter=now_();setTimeout(measureHud,450);if(!G.moonMoved)G.moon=moonHome();G.hintT=now_()+12000;G.flash=1;G.flashRGB="255,236,180";G.shake=10;ensureAudio();enterSound(true);try{if(!location.hash||location.hash==="#")history.replaceState(null,"","#zeus")}catch(_){}
    if(window.matchMedia("(max-width:700px)").matches)setTimeout(()=>$("map").scrollIntoView({behavior:"smooth",block:"start"}),60)}
  else{G.tExit=now_();if(G.rec)recToggle();G.replay=null;syncBtns();G.storms.forEach(s=>{s.held=false;stormKill(s)});G.storms=[];if(G.tideNote!=null){gtx([0x84,G.tideNote,0]);G.tideNote=null;G.tideStep=-1}cv.style.cursor="";enterSound(false);
    if(A&&!S.on){const c=A.ctx.currentTime;A.out.gain.setTargetAtTime(0,c+1.4,.4)}try{if(location.hash==="#zeus"||location.hash==="#god")history.replaceState(null,"",location.pathname+location.search)}catch(_){}}
  setMix()}
G.set=setGod;
addEventListener("keydown",e=>{if(e.target.matches&&e.target.matches("input,select,textarea"))return;if((e.key==="z"||e.key==="h")&&!e.metaKey&&!e.ctrlKey)setGod(!G.on);else if(e.key==="Escape"&&G.on)setGod(false)});
if(location.hash==="#god")try{history.replaceState(null,"","#zeus")}catch(_){}
if(location.hash==="#zeus"||location.hash==="#god")setTimeout(()=>setGod(true),300);
})();
