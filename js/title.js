/* Earth MIDI · the title is an instrument.
   Each letter is a note in the current key. Where you touch a letter shapes the sound:
     top of a letter = bright and glassy, bottom = warm and round,
     edges ring metallic, the middle is pure.
   Hold to let it sustain (a slow vibrato blooms), drag up or down while holding to bend the pitch,
   sweep across the letters to strum (faster sweeps play harder). Several fingers = a chord.

   Recording rule (plainly worded in the Record sheet, saved in this browser):
     "mix"      the title goes into every recording with everything else
     "separate" recordings leave it out, and it's saved as its own WAV that starts at the same moment
     "off"      you hear it, but it is never recorded or sent as MIDI
   The title has its own little chain (filter → its own echo → compressor → limiter) and never touches
   the master saturator. In "mix" it joins the master after the saturator, at the final limiter,
   which is exactly what every recorder taps. Otherwise it goes straight to the speakers. */
"use strict";
{
const h=$("title");
const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const MODES={mix:"In the mix",separate:"Own file",off:"Not recorded"};
let MODE="off";try{const m=localStorage.getItem("em.titleRec");if(MODES[m])MODE=m}catch(_){}
const TCH=16; // MIDI channel for the title
let T=null,closeT=0,CAP=null,told=0;

/* ---------- the title's own signal chain ---------- */
function ensure(){
  if(!A)initAudio();if(T&&T.ctx===A.ctx)return T;
  const ctx=A.ctx,bus=ctx.createGain();bus.gain.value=.7;
  // its own ping-pong echo, so nothing leaks into the master delay or reverb
  const snd=ctx.createGain();snd.gain.value=.22;const dl=ctx.createDelay(2),dr=ctx.createDelay(2),fb=ctx.createGain(),lp=ctx.createBiquadFilter(),mrg=ctx.createChannelMerger(2);
  fb.gain.value=.32;lp.type="lowpass";lp.frequency.value=2800;dl.delayTime.value=dr.delayTime.value=.3;
  bus.connect(snd);snd.connect(dl);dl.connect(lp);lp.connect(dr);dr.connect(fb);fb.connect(dl);dl.connect(mrg,0,0);dr.connect(mrg,0,1);
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=8;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.2;
  const lim=ctx.createDynamicsCompressor();lim.threshold.value=-4;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.001;lim.release.value=.1;
  bus.connect(comp);mrg.connect(comp);comp.connect(lim);
  const toMix=ctx.createGain(),toOut=ctx.createGain();lim.connect(toMix);lim.connect(toOut);
  toMix.connect(A.mixIn);toOut.connect(A.out); // A.mixIn → safety ceiling → A.tap feeds every recorder; A.out is just the speakers
  T={ctx,bus,lim,toMix,toOut,dl,dr,voices:new Map(),played:0};route(true);return T}
function route(now){if(!T)return;const c=T.ctx.currentTime,inMix=MODE==="mix";
  T.toMix.gain.setTargetAtTime(inMix?1:0,c,now?.001:.03);T.toOut.gain.setTargetAtTime(inMix?0:1,c,now?.001:.03)}
const syncDelay=()=>{if(!T)return;const t=clamp(60/(S.bpm||100)*.75,.18,.6);T.dl.delayTime.setTargetAtTime(t,T.ctx.currentTime,.1);T.dr.delayTime.setTargetAtTime(t,T.ctx.currentTime,.1)};

// let the title be heard when the planet isn't playing
const openOut=()=>{A.ctx.resume();const c=A.ctx.currentTime,v=+($("vol")?.value||.8);
  if(!S.on){A.out.gain.cancelScheduledValues(c);A.out.gain.setTargetAtTime(v,c,.02);clearTimeout(closeT);
    closeT=setTimeout(()=>{if(A&&!S.on&&!(T&&T.voices.size)&&!(typeof G!=="undefined"&&G&&G.on))A.out.gain.setTargetAtTime(0,A.ctx.currentTime,.4)},3200)}};

/* ---------- one voice ---------- */
// p = {n, vel 0..1, bright 0..1 (top of letter = 1), metal 0..1 (edges = 1), pan -1..1}
function voice(p){
  const {ctx,bus}=T,c=ctx.currentTime+.004,f=mtof(p.n);
  const o1=ctx.createOscillator(),o2=ctx.createOscillator(),o3=ctx.createOscillator(),g2=ctx.createGain(),g3=ctx.createGain();
  o1.type="triangle";o2.type="sine";o3.type="sine";o1.frequency.value=f;o2.frequency.value=f*2.76;o3.frequency.value=f*5.43;
  g2.gain.value=.12+p.bright*.18;g3.gain.value=p.metal*.16;
  const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.Q.value=.8;lp.frequency.value=420+p.bright*p.bright*7600;
  const vib=ctx.createOscillator(),vibG=ctx.createGain();vib.frequency.value=5.2;vibG.gain.value=0;vib.connect(vibG);
  const g=ctx.createGain(),pan=ctx.createStereoPanner();pan.pan.value=W_(p.pan);
  [o1,o2,o3].forEach(o=>vibG.connect(o.detune));
  o1.connect(lp);o2.connect(g2);g2.connect(lp);o3.connect(g3);g3.connect(lp);lp.connect(g);g.connect(pan);pan.connect(bus);
  // gain staging: ~.11 peak per voice, 8 voices max, then the title's own compressor + limiter
  const pk=.05+.07*p.vel,att=.003+(1-p.bright)*.014;
  g.gain.setValueAtTime(0,c);g.gain.linearRampToValueAtTime(pk,c+att);g.gain.setTargetAtTime(pk*.38,c+att,.22+(1-p.bright)*.3);
  [o1,o2,o3,vib].forEach(o=>o.start(c));
  const v={p,o:[o1,o2,o3,vib],g,lp,pan,vibG,t0:performance.now(),off:false,
    bend(cents){[o1,o2,o3].forEach(o=>o.detune.setTargetAtTime(cents,ctx.currentTime,.015))},
    shape(bright,pn){lp.frequency.setTargetAtTime(420+bright*bright*7600,ctx.currentTime,.04);pan.pan.setTargetAtTime(W_(pn),ctx.currentTime,.05)},
    bloom(){if(!v.off)vibG.gain.setTargetAtTime(14,ctx.currentTime,.6)},
    release(){if(v.off)return;v.off=true;const t=ctx.currentTime,tau=.25+(1-p.bright)*.35+p.metal*.25;
      g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(Math.max(g.gain.value,.0001),t);g.gain.setTargetAtTime(0,t,tau);
      v.o.forEach(o=>o.stop(t+tau*7));setTimeout(()=>{try{pan.disconnect()}catch(_){}},(tau*7+.2)*1000);
      if(v.midi){tx([0x80+TCH-1,v.midi,0]);tx([0xE0+TCH-1,0,64])}}};
  return v}

/* ---------- reading the letters ---------- */
const letters=()=>[...h.querySelectorAll(".L")];
const at=(x,y)=>{const t=document.elementFromPoint(x,y);return t&&t.classList&&t.classList.contains("L")&&h.contains(t)?t:null};
function where(el,x,y){const r=el.getBoundingClientRect(),fx=clamp((x-r.left)/r.width,0,1),fy=clamp((y-r.top)/r.height,0,1);
  return {fx,fy,bright:1-fy,metal:Math.pow(Math.abs(fx-.5)*2,1.6),r}}
const P=new Map(); // pointerId → state

function strike(el,x,y,vel,pid){
  const ls=letters(),i=ls.indexOf(el);if(i<0)return null;
  try{iosUnlock()}catch(_){}ensure();openOut();syncDelay();
  if(T.voices.size>=8){const old=[...T.voices.values()].sort((a,b)=>a.t0-b.t0)[0];old.release();T.voices.delete(old)}
  const w=where(el,x,y),sc=scaleFor(kpAt(Date.now())||2),n=degree(sc,i+2,ROOT+12),
    pn=(i/(ls.length-1))*1.4-.7+(w.fx-.5)*.15;
  const v=voice({n,vel,bright:w.bright,metal:w.metal,pan:pn});T.voices.set(v,v);T.played++;
  if(MODE!=="off"){const mv=clamp(Math.round(30+vel*97),1,127);v.midi=n;try{tx([0x90+TCH-1,n,mv])}catch(_){}}
  try{pushNote(n,"u",Math.round(30+vel*97),1.2)}catch(_){}
  // the letter leans toward where you hit it and pops
  el.style.rotate=((w.fx-.5)*10).toFixed(1)+"deg";el.classList.add("held");
  if(!RM){el.classList.remove("tap");void el.offsetWidth;el.classList.add("tap")}
  if(window.EMRec&&EMRec.capturing&&!told){told=1;
    xs(MODE==="mix"?"● Your title playing is going into this recording":MODE==="separate"?"● Your title playing is being saved as its own file":"Your title playing isn't being recorded (change it in Record)")}
  return {el,v,x0:x,y0:y,lx:x,ly:y,lt:performance.now(),i,pn,hold:setTimeout(()=>v.bloom(),260),pid}}
function letGo(st){if(!st)return;clearTimeout(st.hold);st.v.release();T&&T.voices.delete(st.v);
  st.el.classList.remove("held");st.el.style.rotate="";}

if(h){
  h.style.touchAction="none";
  h.addEventListener("pointerdown",e=>{const el=at(e.clientX,e.clientY);if(!el)return;e.preventDefault();
    try{h.setPointerCapture(e.pointerId)}catch(_){}
    const vel=e.pointerType==="pen"&&e.pressure>0?clamp(.25+e.pressure,0,1):.85;
    P.set(e.pointerId,strike(el,e.clientX,e.clientY,vel,e.pointerId))});
  h.addEventListener("pointermove",e=>{const st=P.get(e.pointerId);if(!st)return;
    const now=performance.now(),dt=Math.max(1,now-st.lt),sp=Math.hypot(e.clientX-st.lx,e.clientY-st.ly)/dt;st.lx=e.clientX;st.ly=e.clientY;st.lt=now;
    const el=at(e.clientX,e.clientY);
    if(el&&el!==st.el){ // strum onto the next letter: faster sweep, harder hit
      letGo(st);P.set(e.pointerId,strike(el,e.clientX,e.clientY,clamp(.45+sp*.35,.45,1),e.pointerId));return}
    // still on the same letter: vertical drag bends (up = sharper, up to 2 semitones), position reshapes the tone
    const w=where(st.el,e.clientX,e.clientY),dy=(st.y0-e.clientY)/w.r.height,cents=clamp(dy*200,-200,200);
    st.v.bend(cents);st.v.shape(w.bright,st.pn+(w.fx-.5)*.15);
    st.el.style.rotate=((w.fx-.5)*10-cents/40).toFixed(1)+"deg";
    if(st.v.midi&&MODE!=="off"){const b=clamp(Math.round(8192+cents/200*8191),0,16383);tx([0xE0+TCH-1,b&127,b>>7])}});
  const end=e=>{const st=P.get(e.pointerId);if(!st)return;P.delete(e.pointerId);letGo(st)};
  h.addEventListener("pointerup",end);h.addEventListener("pointercancel",end);h.addEventListener("lostpointercapture",end);
  h.title="Play the letters. Top is bright, bottom is warm, edges ring metallic. Hold to sustain, drag up or down to bend, sweep across to strum.";
  // live reactions: quake shake, flare flash (throttled, cheap: class toggles only)
  let qT=0,xT=0;setInterval(()=>{if(!S.on||document.hidden)return;const now=performance.now();
    if(!RM&&(S.hit.q||0)>.85&&now-qT>1500){qT=now;h.classList.remove("shake");void h.offsetWidth;h.classList.add("shake")}
    if((S.hit.x||0)>.8&&now-xT>1500){xT=now;h.classList.remove("flash");void h.offsetWidth;h.classList.add("flash")}},90);
}

/* ---------- separate title file: a WAV of the title chain alone ---------- */
function capStart(){if(MODE!=="separate")return false;ensure();if(CAP)capStop();
  const ctx=T.ctx,sp=ctx.createChannelSplitter(2),mg=ctx.createChannelMerger(2),proc=ctx.createScriptProcessor(4096,2,2),L=[],R=[],max=ctx.sampleRate*1200;let n=0;
  T.lim.connect(sp);sp.connect(mg,0,0);sp.connect(mg,1,1);mg.connect(proc);proc.connect(ctx.destination);
  proc.onaudioprocess=e=>{const o=e.outputBuffer;o.getChannelData(0).fill(0);o.getChannelData(1).fill(0);if(n>=max)return;
    L.push(f2i(e.inputBuffer.getChannelData(0)));R.push(f2i(e.inputBuffer.getChannelData(1)));n+=4096};
  CAP={sp,proc,L,R,rate:ctx.sampleRate,played0:T.played,start:realNow()};told=0;return true}
function capStop(){const C=CAP;if(!C)return null;CAP=null;try{T.lim.disconnect(C.sp)}catch(_){}try{C.proc.disconnect()}catch(_){}
  if(T.played===C.played0)return {empty:true};
  return {blob:encodeWav(C.L,C.R,C.rate,`Earth MIDI title playing ${new Date(C.start).toISOString().slice(0,16)} UTC`),name:`earth-midi_title-playing_${stamp()}.wav`}}

window.EMTitle={
  get mode(){return MODE},MODES,
  setMode(m){if(!MODES[m])return;MODE=m;try{localStorage.setItem("em.titleRec",m)}catch(_){}route(false)},
  // plain-English rule for the current mode
  rule(m=MODE){return m==="mix"?"Anything you play on the EARTH MIDI title goes into your recordings, mixed in with everything else."
    :m==="separate"?"Recordings leave the title out. Whatever you play on it is saved as its own WAV, starting at the same moment, so you can line it up later."
    :"You'll hear the title when you play it, but it is never recorded or sent as MIDI."},
  node(){return ensure().lim},ensure,capStart,capStop,resetTold(){told=0}};
}
