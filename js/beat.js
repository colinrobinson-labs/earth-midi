/* Earth MIDI · the title and the globe move with the music, gently.
   Pulse: every kick gives the EARTH MIDI title a small bounce and the globe a breath. Kicks are read off the
   audio clock (the same time the kick is scheduled to sound), so the motion lands on the beat, not early.
   Ambient: there's no kick, so real events give a softer nudge: a quake, a flare, a sunrise chime,
   a natural event, the space station crossing a coastline. Busier moments never stack into anything big.
   Stopped, or prefers-reduced-motion: nothing moves.
   The title's own play, shake and flash keep working: this only uses transform on the whole title,
   the letters keep their own transform, rotate, scale and translate. */
"use strict";
(()=>{
const RM=matchMedia("(prefers-reduced-motion: reduce)");
const h=$("title");
const Q=[];window.onKick=(t,v)=>{if(Q.length<64)Q.push([t,v])};
const EV={q:1,x:1,u:.8,e:.8,i:.45,w:.6}; // which layers count as "events" in Ambient, and how much
const prev={};
let env=0,shown=0,last=0,lastEv=0,still=true;
function rest(){if(still)return;still=true;env=shown=0;Q.length=0;window.BEATG=0;FX.css(h,"--bt","0")}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.1,last?(now-last)/1000:.016);last=now;
  const on=typeof S!=="undefined"&&S.on&&A&&A.ctx;
  if(RM.matches||document.hidden||!on){if(!on)Q.length=0;if(shown<.002)return rest();}
  still=false;
  if(on&&!RM.matches){
    if(S.style==="pulse"){
      // fire each kick when it actually reaches the speakers
      const ct=A.ctx.currentTime-(A.ctx.outputLatency||A.ctx.baseLatency||0);
      while(Q.length&&Q[0][0]<=ct){const [t,v]=Q.shift();if(ct-t<.15)env=Math.max(env,v)}
    }else{
      Q.length=0;
      // a jump in an event layer's level = something just happened
      let kick=0;for(const k in EV){const v=S.hit[k]||0,r=v-(prev[k]||0);prev[k]=v;if(r>.18)kick=Math.max(kick,Math.min(1,r)*EV[k])}
      if(kick&&now-lastEv>380){lastEv=now;env=Math.max(env,.25+kick*.35)}
    }
  }
  // quick rise, smooth fall (about a third of a beat at 120 bpm)
  shown+=(env-shown)*(env>shown?.7:1);
  env*=Math.exp(-dt/.12);
  if(RM.matches)env=0;
  const v=Math.max(0,shown);
  if(FX.on(h))FX.css(h,"--bt",v.toFixed(3)); // only while the title is on screen (js/fx.js)
  window.BEATG=v*.014; // the globe grows by at most 1.4% on a full kick
}
requestAnimationFrame(frame);
})();
