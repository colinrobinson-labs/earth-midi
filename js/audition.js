/* Earth MIDI · audition: pick something in the Producer panel and hear it.
   Choosing an instrument, key, scale, room, progression, genre or preset plays a short preview built the
   same way as the real voice (same waveforms, FM ratios and room impulse), in the current key and scale.
   Previews run on their own little bus straight to the speakers, so they never leak into recordings and
   never wake the stopped mix. Stopped: normal level. Playing: much quieter, and genres/presets are skipped
   because the live mix already changes. Level follows the volume slider; a limiter keeps it clean. */
"use strict";
const AUD=(()=>{
let pv=null,slot=null,lastK="",lastT=0,idle=null;
function bus(){if(!A)initAudio();const ctx=A.ctx;if(pv&&pv.ctx===ctx)return pv;
  const inp=ctx.createGain(),wet=ctx.createConvolver(),wg=ctx.createGain(),out=ctx.createGain(),lim=ctx.createDynamicsCompressor();
  wet.buffer=genIR(ctx,CFG.revType);wg.gain.value=.32;lim.threshold.value=-6;lim.knee.value=4;lim.ratio.value=12;lim.attack.value=.002;lim.release.value=.12;
  inp.connect(out);inp.connect(wet);wet.connect(wg);wg.connect(out);out.connect(lim);lim.connect(ctx.destination);
  pv={ctx,inp,wet,wg,out,room:CFG.revType};return pv}
function level(){const v=clamp(+($("vol")?.value??.8),0,1);return v*(S.on?.28:.9)}
// each preview gets a slot; a new pick fades the previous one so they never pile up
function start(k){iosUnlock();const b=bus();A.ctx.resume();const c=A.ctx.currentTime;
  if(b.room!==CFG.revType){b.wet.buffer=genIR(A.ctx,CFG.revType);b.room=CFG.revType}
  b.wg.gain.setValueAtTime(k==="revType"?.8:.3,c);b.out.gain.cancelScheduledValues(c);b.out.gain.setValueAtTime(level(),c);
  if(slot){const g=slot.gain;g.cancelScheduledValues(c);g.setTargetAtTime(0,c,.03)}
  slot=A.ctx.createGain();slot.connect(b.inp);
  clearTimeout(idle);idle=setTimeout(()=>{if(!S.on&&typeof UNLOCK!=="undefined"&&UNLOCK)UNLOCK.pause()},6000);
  return {ctx:A.ctx,c:c+.02,to:slot}}
const sc=()=>scaleFor(S.cur.kp||2),root=()=>48+(+CFG.key)+12*(+CFG.oct);
function env(ctx,g,t,peak,att,dec){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(.0003,t+att+dec)}
function osc(ctx,type,f,t,len){const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(t+len+.05);return o}

/* the voices, mirroring audio.js */
function fm(P,n,t,amp){const {ctx,to}=P,I=QINST[CFG.inst.q]||QINST.bell,f=mtof(n),dec=1.6*I.dec,pl=CFG.inst.q==="pluck";
  const car=osc(ctx,pl?"triangle":"sine",f,t,dec+.3),mod=osc(ctx,"sine",f*I.r,t,dec+.3),mg=ctx.createGain(),g=ctx.createGain();
  mg.gain.setValueAtTime(f*I.idx[1]*.6,t);mg.gain.exponentialRampToValueAtTime(f*.02,t+dec*(pl?.15:.6));mod.connect(mg);mg.connect(car.frequency);
  env(ctx,g,t,amp,.004,dec);car.connect(g);g.connect(to)}
function pad(P,notes,t,len,amp){const {ctx,to}=P,lp=ctx.createBiquadFilter(),g=ctx.createGain();lp.type="lowpass";lp.frequency.setValueAtTime(500,t);lp.frequency.linearRampToValueAtTime(1800,t+len*.6);lp.Q.value=2;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.35);g.gain.setValueAtTime(amp,t+len-.4);g.gain.exponentialRampToValueAtTime(.0003,t+len+.6);lp.connect(g);g.connect(to);
  notes.forEach(n=>[-7,7].forEach(d=>{const o=osc(ctx,PADTYPE[CFG.inst.s]||"sawtooth",mtof(n),t,len+.6),vg=ctx.createGain(),p=ctx.createStereoPanner();o.detune.value=d;vg.gain.value=.5/notes.length;p.pan.value=d<0?-.4:.4;o.connect(vg);vg.connect(p);p.connect(lp)}))}
function choir(P,notes,t,len,amp){const {ctx,to}=P,[ty,form]=CHORDTYPE[CFG.inst.c]||CHORDTYPE.voices,mix=ctx.createGain(),g=ctx.createGain(),f1=ctx.createBiquadFilter(),f2=ctx.createBiquadFilter(),dry=ctx.createGain(),fg=ctx.createGain();
  f1.type=f2.type="bandpass";f1.frequency.value=720;f1.Q.value=3;f2.frequency.value=1150;f2.Q.value=4;fg.gain.value=form*2.2;dry.gain.value=form?.35:.9;
  mix.connect(fg);fg.connect(f1);fg.connect(f2);mix.connect(dry);[f1,f2,dry].forEach(x=>x.connect(g));g.connect(to);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.25);g.gain.setValueAtTime(amp,t+len-.3);g.gain.exponentialRampToValueAtTime(.0003,t+len+.5);
  const vib=osc(ctx,"sine",4.6,t,len+.5),vg=ctx.createGain();vg.gain.value=4;vib.connect(vg);
  notes.forEach((n,i)=>{const o=osc(ctx,ty,mtof(n),t,len+.5),og=ctx.createGain(),p=ctx.createStereoPanner();vg.connect(o.detune);og.gain.value=.6/notes.length;p.pan.value=(i/(notes.length-1||1)-.5)*1.2;o.connect(og);og.connect(p);p.connect(mix)})}
function pluck(P,n,t,amp,land){const {ctx,to}=P,inst=CFG.inst.i,f=mtof(n),o=osc(ctx,inst==="square"?"square":"sine",f,t,2.5),m=osc(ctx,"sine",f*(land?3:2),t,2.5),mg=ctx.createGain(),g=ctx.createGain();
  mg.gain.setValueAtTime(f*(inst==="pluck"?2.5:inst==="glass"?1.2:.4),t);mg.gain.exponentialRampToValueAtTime(f*.01,t+.25);m.connect(mg);mg.connect(o.frequency);
  env(ctx,g,t,amp*(inst==="square"?.5:1),.004,inst==="glass"?2.2:.8);o.connect(g);g.connect(to)}
function chime(P,n,t,amp,rise){const {ctx,to}=P,inst=CFG.inst.u,s=sc();(rise?[0,4,7]:[7,4,0]).forEach((st,i)=>{const nn=n+(st===4?(s.includes(4)?4:3):st),tt=t+i*.11,g=ctx.createGain(),g2=ctx.createGain();
  const o=osc(ctx,inst==="warm"?"triangle":"sine",mtof(nn),tt,2.4),o2=osc(ctx,"sine",mtof(nn)*(inst==="chime"?2.76:2),tt,2.4);g2.gain.value=inst==="soft"?0:.35;o2.connect(g2);g2.connect(g);o.connect(g);env(ctx,g,tt,amp,.01,2.2);g.connect(to)})}
function soft(P,n,t,amp,dec=.7){const {ctx,to}=P,o=osc(ctx,"triangle",mtof(n),t,dec+.1),g=ctx.createGain();env(ctx,g,t,amp,.005,dec);o.connect(g);g.connect(to)}
function drum(P,k,t,v){const {ctx,to}=P;
  if(k==="k"){const o=osc(ctx,"sine",150,t,.45),g=ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(44,t+.12);env(ctx,g,t,.5*v,.002,.38);o.connect(g);g.connect(to);return}
  if(k!=="s"){const g=ctx.createGain();g.gain.value=0;env(ctx,g,t,.2*v,.001,k==="o"?.24:.045);metal().connect(g);g.connect(to);setTimeout(()=>{try{A.metal.disconnect(g)}catch(_){}},800);return}// same metallic hats as the live kit
  const n=ctx.createBufferSource();n.buffer=A.nb;const f=ctx.createBiquadFilter(),g=ctx.createGain();
  f.type="highpass";f.frequency.value=900;env(ctx,g,t,.3*v,.0012,.17);soft(P,55,t,.14*v,.1);
  n.connect(f);f.connect(g);g.connect(to);n.start(t,Math.random()*2);n.stop(t+.25)}

/* one preview per kind of pick */
function pick(k){const now=performance.now();if(k===lastK&&now-lastT<200)return;lastK=k;lastT=now;
  const r=root(),s=sc(),d=i=>{const o=Math.floor(i/s.length);return r+12*o+s[((i%s.length)+s.length)%s.length]};
  if(S.on&&!/^(inst\.|snd\.|key$|scale$|oct$|tune$|revType$|prog$|coct$|qoct$)/.test(k))return;
  const P=start(k),t=P.c;
  switch(k){
   case "inst.q":case "qoct":[0,2,4].forEach((i,j)=>fm(P,d(i+s.length)+12*CFG.qoct,t+j*.28,.2));break;
   case "inst.s":pad(P,[0,2,4,7].map(i=>d(i)-12),t,1.8,.2);break;
   case "inst.c":case "coct":choir(P,[0,2,4,6].map(i=>d(i)+12*CFG.coct),t,1.6,.22);break;
   case "inst.i":[2,4,6,9].forEach((i,j)=>pluck(P,d(i+s.length),t+j*.16,.18,j%2));break;
   case "inst.u":chime(P,d(s.length),t,.15,true);break;
   case "key":case "scale":case "oct":case "tune":for(let i=0;i<=s.length;i++)soft(P,d(i),t+i*.13,.16,i===s.length?1.2:.5);break;
   case "revType":fm(P,d(s.length),t,.22);soft(P,d(s.length+2),t+.35,.12,.4);break;
   case "prog":{const pr=PROGS[CFG.prog]||PROGS.classic;pr.forEach((ch,j)=>pad(P,ch.map(i=>d(i)-12),t+j*.55,.5,.16));break}
   case "genre":{const G=GROOVES[CFG.pattern]||GROOVES.four,g=GENRE_BY[CFG.genre],bpm=g?(g.lo+g.hi)/2:(+CFG.bpmMin+ +CFG.bpmMax)/2,st=60/bpm/4,sw=+CFG.swing||0;
     for(let i=0;i<16;i++){const tt=t+i*st+(i%2?sw*st:0);if(G.k[i]==="x"||G.k[i]==="g")drum(P,"k",tt,G.k[i]==="g"?.5:1);
       if(G.s[i]==="x")drum(P,"s",tt,1);else if(G.s[i]==="r"||G.s[i]==="g")drum(P,"s",tt,.35);
       if(G.h[i]&&G.h[i]!==".")drum(P,G.h[i]==="o"?"o":"h",tt,G.h[i]==="-"?.45:.8);
       if(G.b[i]&&G.b[i]!=="."){const bn=d(G.b[i]==="f"?2:0)-12+(G.b[i]==="o"?12:0),o=osc(P.ctx,"sawtooth",mtof(bn),tt,st*(G.bl||1.6)),lp=P.ctx.createBiquadFilter(),bg=P.ctx.createGain();lp.type="lowpass";lp.frequency.setValueAtTime(900,tt);lp.frequency.exponentialRampToValueAtTime(160,tt+st*(G.bl||1.6));env(P.ctx,bg,tt,.18,.004,st*(G.bl||1.6));o.connect(lp);lp.connect(bg);bg.connect(P.to)}}
     break}
   case "preset":[0,2,4,7,4].forEach((i,j)=>fm(P,d(i+s.length),t+j*.2,.17));pad(P,[0,2,4].map(i=>d(i)-12),t,1.4,.12);break;
   case "snd.oTone":case "snd.oQ":noise(P,t,1.8,"bandpass",900*SN2("oTone"),+SN("oQ"),.5,.6,.1);break;
   case "snd.xBell":case "snd.xOct":[0,7,12,19].forEach((dd,j)=>{const o=osc(P.ctx,SN("xBell"),mtof(r+24+dd),t+j*.12,2),g=P.ctx.createGain();env(P.ctx,g,t+j*.12,.07,.02,1.8);o.connect(g);g.connect(P.to)});
     [74,81,86,93].forEach((m,j)=>{const o=osc(P.ctx,"sine",mtof(m+12*SN("xOct")),t+.6,1.6),g=P.ctx.createGain();g.gain.setValueAtTime(0,t+.6);g.gain.linearRampToValueAtTime(.025,t+1);g.gain.exponentialRampToValueAtTime(.0003,t+2.2);o.connect(g);g.connect(P.to)});break;
   case "snd.wTone":case "snd.wQ":noise(P,t,1.8,"bandpass",700*SN2("wTone"),5*SN("wQ"),.9,.7,.5);noise(P,t,1.8,"bandpass",1400*SN2("wTone"),9*SN("wQ"),.9,.7,.5);break;
   case "snd.tWave":case "snd.tOct":case "snd.tLp":{const {ctx,to}=P,lp=ctx.createBiquadFilter(),g=ctx.createGain(),w=SN("tWave"),k2=({triangle:.85,square:.5,sawtooth:.55}[w]||1);lp.type="lowpass";lp.frequency.value=+SN("tLp");lp.Q.value=.5;
     [r-12+12*SN("tOct"),r+12*SN("tOct")].forEach((n,j)=>{const o=osc(ctx,w,mtof(n),t,2),og=ctx.createGain();og.gain.value=j?.35:1;o.detune.setValueAtTime(-30,t);o.detune.linearRampToValueAtTime(30,t+1.8);o.connect(og);og.connect(lp)});
     g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.32*k2,t+.3);g.gain.setValueAtTime(.32*k2,t+1.5);g.gain.exponentialRampToValueAtTime(.0003,t+2.1);lp.connect(g);g.connect(to);break}
   case "snd.eHp":case "snd.eOct":{const {ctx,to}=P,hp=ctx.createBiquadFilter();hp.type="highpass";hp.frequency.value=+SN("eHp");hp.frequency.value=+SN("eHp")*.25;hp.connect(to);
     {const sc=scaleFor(S.cur&&S.cur.kp!=null?S.cur.kp:2);for(let j=0;j<10;j++)ember(t+Math.random()*1.5,.06*(.5+Math.random()*.6),sc,hp,ctx)}
     const lp=ctx.createBiquadFilter(),vg=ctx.createGain();lp.type="lowpass";lp.frequency.value=180;lp.Q.value=4;env(ctx,vg,t,.22,.4,1.6);lp.connect(vg);vg.connect(to);[0,7,12].forEach(dd=>{const o=osc(ctx,"sawtooth",mtof(r-24+12*SN("eOct")+dd),t,2.1),og=ctx.createGain();og.gain.value=.3;o.connect(og);og.connect(lp)});break}
   case "snd.gMode":case "snd.gOct":{const {ctx,to}=P,a=osc(ctx,"sine",mtof(r),t,2),b=osc(ctx,"sine",mtof(r)*(SN("gMode")==="fifth"?1.5:SN("gMode")==="octave"?2:1.414),t,2),rm=ctx.createGain(),f=ctx.createBiquadFilter(),g=ctx.createGain();
     rm.gain.value=0;b.connect(rm.gain);a.connect(rm);f.type="bandpass";f.frequency.value=900;f.Q.value=1.5;rm.connect(f);f.connect(g);env(ctx,g,t,.5,.3,1.6);g.connect(to);
     for(let j=0;j<8;j++){const tt=t+.2+j*.17,o=osc(ctx,"sine",mtof(d(8+Math.floor(Math.random()*6))+12+12*SN("gOct")),tt,.2),gg=ctx.createGain();env(ctx,gg,tt,.05,.002,.18);o.connect(gg);gg.connect(to)}break}
   case "snd.aTone":noise(P,t,1.8,"bandpass",2000*SN2("aTone"),.8,.45,.6,.3);break;
   case "snd.rKick":case "snd.rDec":case "snd.rBass":case "snd.rTone":{const bpm=120,st=60/bpm/4,{ctx,to}=P,kt=Math.pow(2,+SN("rKick")/12),kd=.45*SN("rDec");
     [0,4,8,12].forEach(i=>{const tt=t+i*st,o=osc(ctx,"sine",155*kt,tt,kd),g=ctx.createGain();o.frequency.setValueAtTime(155*kt,tt);o.frequency.exponentialRampToValueAtTime(42*kt,tt+.12);env(ctx,g,tt,.5,.002,kd);o.connect(g);g.connect(to)});
     [2,6,10,14].forEach(i=>{const tt=t+i*st,len=st*1.6,bn=d(0)-24,o=osc(ctx,SN("rBass"),mtof(bn),tt,len),lp=ctx.createBiquadFilter(),bg=ctx.createGain();lp.type="lowpass";lp.Q.value=8;lp.frequency.setValueAtTime(900*SN2("rTone"),tt);lp.frequency.exponentialRampToValueAtTime(140*SN2("rTone"),tt+len);env(ctx,bg,tt,.22*(SN("rBass")==="sine"?1.4:1),.004,len);o.connect(lp);lp.connect(bg);bg.connect(to)});break}
   default:return}}
const SN2=k=>Math.pow(2,+SN(k));
function noise(P,t,len,type,f,q,amp,att,lfo){const {ctx,to}=P,n=ctx.createBufferSource();n.buffer=A.nb;n.loop=true;const fl=ctx.createBiquadFilter(),g=ctx.createGain();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+att);g.gain.setValueAtTime(amp,t+len-.4);g.gain.exponentialRampToValueAtTime(.0003,t+len+.3);
  if(lfo){const l=osc(ctx,"sine",.9,t,len+.3),lg=ctx.createGain();lg.gain.value=f*.25*lfo;l.connect(lg);lg.connect(fl.frequency)}
  n.connect(fl);fl.connect(g);g.connect(to);n.start(t,Math.random()*2);n.stop(t+len+.35)}
return {pick,_bus:()=>pv};
})();
