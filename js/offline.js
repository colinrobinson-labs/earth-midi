/* Earth MIDI · registers the offline worker (sw.js) and tells it which files this visit loaded.
   Not inside the Apple apps (they bundle their own copy), and only where service workers are allowed (https or localhost). */
"use strict";
(()=>{
if(window.EMNative||!("serviceWorker" in navigator)||!isSecureContext)return;
addEventListener("load",()=>{
  navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready).then(reg=>{
    const send=()=>{const w=reg.active;if(!w)return;
      const list=performance.getEntriesByType("resource").map(e=>e.name).filter(u=>u.startsWith(location.origin+"/"));
      w.postMessage({cache:[...new Set(list)]})};
    setTimeout(send,4000)}).catch(()=>{});
});
})();
