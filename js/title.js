/* Earth MIDI · playable title. Each letter is a note in the current key (tap, or drag across);
   the title shakes on a big quake hit and flashes on a solar flare. */
"use strict";
(()=>{const h=$("title");if(!h)return;
  const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last=-1,down=false,closeT=0;
  const openOut=()=>{if(!A){initAudio()}A.ctx.resume();const c=A.ctx.currentTime,v=+($("vol")?.value||.8);
    if(!S.on){A.out.gain.cancelScheduledValues(c);A.out.gain.setTargetAtTime(v,c,.02);clearTimeout(closeT);
      closeT=setTimeout(()=>{if(A&&!S.on&&!(typeof G!=="undefined"&&G&&G.on))A.out.gain.setTargetAtTime(0,A.ctx.currentTime,.4)},3200)}};
  function ping(el){const ls=[...h.querySelectorAll(".L")],i=ls.indexOf(el);if(i<0)return;
    try{iosUnlock()}catch(_){}openOut();
    const sc=scaleFor(kpAt(Date.now())||2),n=degree(sc,i+2,ROOT+12),{ctx}=A,c=ctx.currentTime+.005;
    const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),g2=ctx.createGain(),p=ctx.createStereoPanner();
    o.type="triangle";o.frequency.value=mtof(n);o2.type="sine";o2.frequency.value=mtof(n)*2.76;g2.gain.value=.22;
    g.gain.setValueAtTime(0,c);g.gain.linearRampToValueAtTime(.12,c+.006);g.gain.exponentialRampToValueAtTime(.0004,c+1.8);
    p.pan.value=W_((i/(ls.length-1))*1.4-.7);o.connect(g);o2.connect(g2);g2.connect(g);g.connect(p);p.connect(A.sum);p.connect(A.dly);
    o.start(c);o2.start(c);o.stop(c+1.9);o2.stop(c+1.9);
    try{midiNote(CH("u"),n,96,400)}catch(_){}try{pushNote(n,"u",96,1.2)}catch(_){}
    el.classList.remove("tap");void el.offsetWidth;el.classList.add("tap")}
  const at=e=>{const t=document.elementFromPoint(e.clientX,e.clientY);return t&&t.classList&&t.classList.contains("L")?t:null};
  h.addEventListener("pointerdown",e=>{const el=at(e);if(!el)return;down=true;last=el;ping(el)});
  h.addEventListener("pointermove",e=>{if(!down)return;const el=at(e);if(el&&el!==last){last=el;ping(el)}});
  addEventListener("pointerup",()=>{down=false;last=null});addEventListener("pointercancel",()=>{down=false;last=null});
  h.title="Tap the letters";
  // live reactions: quake shake, flare flash (throttled, cheap: class toggles only)
  let qT=0,xT=0;setInterval(()=>{if(!S.on||document.hidden)return;const now=performance.now();
    if(!RM&&(S.hit.q||0)>.85&&now-qT>1500){qT=now;h.classList.remove("shake");void h.offsetWidth;h.classList.add("shake")}
    if((S.hit.x||0)>.8&&now-xT>1500){xT=now;h.classList.remove("flash");void h.offsetWidth;h.classList.add("flash")}},90);
})();
