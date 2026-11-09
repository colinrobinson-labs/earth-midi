/* Earth MIDI v1.0 · playback and sharing extras.
   - Lock screen / Control Center / media keys (Media Session), with play and pause
   - Picks playback back up after a phone call or Siri pauses the audio, or offers one tap to resume
   - Keeps the screen awake while playing
   - A live line under Play that says what's driving the sound right now
   - Screen reader announcements for big moments only (M5.5+ quakes, M and X flares, geomagnetic storms)
   - Anonymous action counts in GoatCounter (Play, style, export, share, record, Console, Zeus, Simple, story image)
   - "Share this moment": a 1080×1920 story image of what just played
   - Embed mode (earthmidi.com/#embed): globe, Play and a credit link, for articles
   - The WAV master loudness choice
   Nothing here changes a note: it only reads what the engine already did. */
"use strict";
(()=>{
const root=document.documentElement,body=document.body,IN_APP=!!window.EMNative;
const playing=()=>typeof S!=="undefined"&&!!S.on;
const hasA=()=>typeof A!=="undefined"&&!!A;
const LS={get:k=>{try{return localStorage.getItem(k)}catch(_){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}}};

/* ---------- what just happened (feeds the now line, announcements and the story image) ---------- */
const LAST={q:null,ev:null,byLayer:{}};
const SR=document.createElement("div");SR.className="sr";SR.setAttribute("aria-live","polite");SR.setAttribute("role","status");body.appendChild(SR);
let srT=0;function announce(t){const now=Date.now();if(now-srT<20000)return;srT=now;SR.textContent="";setTimeout(()=>{SR.textContent=t},60)}
if(typeof window.logEv==="function"&&!window.logEv.__x){
  const orig=window.logEv;
  window.logEv=function(txt,k,q){const r=orig.apply(this,arguments);try{
    const item={txt:String(txt),k,q:q||null,at:Date.now()};LAST.ev=item;LAST.byLayer[k]=item;if(q)LAST.q=item;
    if(q&&q.mag>=5.5)announce(`Magnitude ${q.mag.toFixed(1)} earthquake, ${q.place}. Now playing.`);
    else if(k==="x"&&/\b[MX]\d/.test(txt))announce(`Solar flare: ${txt}.`);
    nowLine()}catch(_){}return r};
  window.logEv.__x=true}
let lastStorm=false;setInterval(()=>{if(!playing()||!S.cur||!Number.isFinite(S.cur.kp))return;const st=(S.cur.kp||0)>=5;if(st&&!lastStorm)announce(`Geomagnetic storm, Kp ${S.cur.kp.toFixed(1)}. The scale turns minor.`);lastStorm=st},5000);

/* ---------- now line: one plain sentence about what's driving the sound ---------- */
const nl=document.createElement("p");nl.id="nowLine";nl.setAttribute("aria-hidden","true");
const status=document.querySelector(".bar .status");if(status)status.after(nl);
const scaleName=kp=>{if(typeof CFG!=="undefined"&&CFG.scale&&CFG.scale!=="auto")return CFG.scale.replace(/pent$/," pentatonic").replace(/^maj/,"major ").replace(/^min/,"minor ");return kp>=5?"minor pentatonic":kp>=4?"Dorian":"major pentatonic"};
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
function nowLine(){if(!playing()||!S.cur){if(nl.textContent)nl.textContent="";return}
  const c=S.cur,parts=[];
  if(Number.isFinite(c.kp))parts.push(`Kp ${c.kp.toFixed(1)} picks <b>${scaleName(c.kp)}</b>`);
  if(S.style==="pulse"&&S.bpm)parts.push(`${Number.isFinite(c.sp)&&CFG.tempoSrc==="sun"?`solar wind ${Math.round(c.sp)} km/s sets `:""}<b>${Math.round(S.bpm)} BPM</b>`);
  else if(Number.isFinite(c.sp))parts.push(`solar wind <b>${Math.round(c.sp)} km/s</b> sweeps the pad`);
  const e=LAST.q&&Date.now()-LAST.q.at<120000?LAST.q:LAST.ev&&Date.now()-LAST.ev.at<60000?LAST.ev:null;
  if(e)parts.push(e.q?`<b>M${e.q.mag.toFixed(1)}</b> ${esc(String(e.q.place).replace(/^\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i,""))} rang <b>${esc((e.txt.match(/→\s*([A-G]#?-?\d)/)||[])[1]||"a bell")}</b>`:esc((t=>t.length>48?t.slice(0,46).replace(/[\s,:;]+\S*$/,"")+"…":t)(e.txt.split(" · ")[0])));
  nl.innerHTML=parts.join("<i>·</i>")}
setInterval(nowLine,2000);

/* ---------- Media Session: lock screen, Control Center, keyboard media keys ---------- */
if("mediaSession" in navigator&&!IN_APP){
  const ms=navigator.mediaSession;
  const meta=()=>{try{ms.metadata=new MediaMetadata({title:"Earth MIDI · Live",artist:LAST.ev?LAST.ev.txt.split(" · ")[0]:"The planet, played live",album:S.style==="pulse"?"Pulse":"Ambient",
    artwork:[{src:"icons/icon-192.png",sizes:"192x192",type:"image/png"},{src:"icons/icon-512.png",sizes:"512x512",type:"image/png"}]})}catch(_){}};
  const want=on=>{if(on!==playing()&&typeof startStop==="function")startStop()};
  try{ms.setActionHandler("play",()=>want(true));ms.setActionHandler("pause",()=>want(false));ms.setActionHandler("stop",()=>want(false))}catch(_){}
  const sync=()=>{try{ms.playbackState=playing()?"playing":"paused";if(playing())meta()}catch(_){}};
  new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:["class"]});
  setInterval(()=>{if(playing())meta()},15000);sync()}

/* ---------- auto-resume after a call or Siri, and keep the screen awake ---------- */
let pill=null,fails=0;
function showPill(on){if(on&&!pill){pill=document.createElement("button");pill.type="button";pill.className="resumepill";pill.textContent="Tap to resume sound";
    pill.onclick=()=>{try{iosUnlock()}catch(_){}hasA()&&A.ctx.resume().then(()=>{fails=0;showPill(false)}).catch(()=>{})};body.appendChild(pill)}
  if(!on&&pill){pill.remove();pill=null}}
setInterval(()=>{if(!playing()||!hasA()||document.hidden){showPill(false);fails=0;return}
  if(A.ctx.state==="running"){fails=0;showPill(false);return}
  A.ctx.resume().then(()=>{fails=0;showPill(false)}).catch(()=>{});try{if(typeof UNLOCK!=="undefined"&&UNLOCK)UNLOCK.play().catch(()=>{})}catch(_){}
  if(++fails>=3)showPill(true)},1500);
let lock=null;
async function wake(){const want=playing()&&!document.hidden&&LS.get("em.awake")!=="0";
  try{if(want&&!lock&&navigator.wakeLock){lock=await navigator.wakeLock.request("screen");lock.addEventListener("release",()=>{lock=null})}
    else if(!want&&lock){await lock.release();lock=null}}catch(_){lock=null}}
new MutationObserver(wake).observe(body,{attributes:true,attributeFilter:["class"]});
document.addEventListener("visibilitychange",()=>{wake();if(!document.hidden&&playing()&&hasA()&&A.ctx.state!=="running")A.ctx.resume().catch(()=>{})});

/* ---------- anonymous action counts (GoatCounter events, no cookies) ---------- */
const sent={};
function count(name){if(IN_APP)return;const now=Date.now();if(sent[name]&&now-sent[name]<60000)return;sent[name]=now;
  try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:"action/"+name,title:name,event:true})}catch(_){}}
window.EMCount=count;
const slug=t=>String(t).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
document.addEventListener("click",e=>{const b=e.target.closest("button,a");if(!b)return;
  if(b.matches(".go"))count(playing()?"stop":"play");
  else if(b.matches("[data-style]"))count("style-"+b.dataset.style);
  else if(b.closest("#exp")&&b.tagName==="BUTTON")count("export-"+slug(b.textContent));
  else if(b.id==="bShare")count("share-link");
  else if(b.id==="mRec"||b.id==="bVid"||b.id==="bAac")count("record");
  else if(b.matches("[data-vw]"))count("view-"+b.dataset.vw);
  else if(b.matches(".godbtn,#godBtn"))count("zeus");
  else if(b.id==="bMoment")count("story-image")},true);
addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(["console","zeus","simple","god"].includes(h))count("view-"+(h==="god"?"zeus":h))});
if(["#console","#zeus","#god","#simple","#embed"].includes(location.hash))count("open-"+location.hash.slice(1));

/* ---------- WAV master loudness choice ---------- */
const ls=$("loudSel");if(ls){ls.value=LS.get("em.loud")||"raw";ls.onchange=()=>{LS.set("em.loud",ls.value);xs(ls.value==="raw"?"WAV master: raw, exactly as played":`WAV master will be matched to ${ls.value==="socials"?"−14":"−16"} LUFS`)}}

/* ---------- Share this moment: a 1080×1920 story image ---------- */
async function moment(){
  const W=1080,H=1920,cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d");
  try{await document.fonts.load('900 80px "Archivo"');await document.fonts.load('500 30px "IBM Plex Mono"')}catch(_){}
  const bg=g.createRadialGradient(W/2,760,80,W/2,760,1100);bg.addColorStop(0,"#0d1724");bg.addColorStop(1,"#05070a");g.fillStyle=bg;g.fillRect(0,0,W,H);
  // spectrum rule + title
  const sp=["#ff5a3c","#ffc53d","#7cff9e","#3cc8ff","#c77dff","#ff8fd1"];sp.forEach((c,i)=>{g.fillStyle=c;g.fillRect(90+i*60,150,60,6)});
  g.font='900 112px "Archivo","Arial Black",sans-serif';g.textBaseline="alphabetic";
  const tg=g.createLinearGradient(90,0,990,0);sp.forEach((c,i)=>tg.addColorStop(i/(sp.length-1),c));g.fillStyle=tg;g.fillText("EARTH MIDI",86,290);
  g.font='500 34px "IBM Plex Sans",system-ui,sans-serif';g.fillStyle="#c8cdd0";g.fillText("The planet, played live.",90,350);
  // the globe as it is right now
  const map=$("map");if(map&&map.width){const s=Math.min(map.width,map.height),sx=(map.width-s)/2,sy=(map.height-s)/2,D=900;
    g.save();g.beginPath();g.arc(W/2,820,D/2,0,Math.PI*2);g.clip();
    try{g.drawImage(map,sx,sy,s,s,(W-D)/2,820-D/2,D,D)}catch(_){}g.restore()}
  // the moment
  const e=LAST.q||LAST.ev,when=new Date(e?e.at:Date.now());
  let head="Live from Earth",sub="";
  if(e&&e.q){head=`M${e.q.mag.toFixed(1)} earthquake`;sub=`${e.q.place} · ${Math.round(e.q.depth)} km deep`;const nt=(e.txt.match(/→\s*([A-G]#?-?\d)/)||[])[1];if(nt)sub+=` · rang ${nt}`}
  else if(e){head=e.txt.split(" · ")[0];sub=e.txt.split(" · ").slice(1).join(" · ")}
  else if(S.quakes&&S.quakes.length){const b=S.quakes.reduce((a,q)=>q.mag>a.mag?q:a);head=`M${b.mag.toFixed(1)} today`;sub=b.place}
  const wrap=(t,x,y,max,lh)=>{const w=String(t).split(" ");let line="";for(const word of w){const tt=line?line+" "+word:word;if(g.measureText(tt).width>max&&line){g.fillText(line,x,y);y+=lh;line=word}else line=tt}if(line)g.fillText(line,x,y);return y+lh};
  g.fillStyle="#eceee8";g.font='800 72px "Archivo","Arial Black",sans-serif';let y=wrap(head,90,1400,900,80);
  g.font='500 36px "IBM Plex Sans",system-ui,sans-serif';g.fillStyle="#c8cdd0";if(sub)y=wrap(sub,90,y+6,900,48);
  const c=S.cur||{},bits=[];if(Number.isFinite(c.kp))bits.push(`Kp ${c.kp.toFixed(1)} · ${scaleName(c.kp)}`);if(Number.isFinite(c.sp))bits.push(`solar wind ${Math.round(c.sp)} km/s`);
  g.font='500 30px "IBM Plex Mono",monospace';g.fillStyle="#97a1aa";g.fillText(`${when.toISOString().slice(0,16).replace("T"," ")} UTC`,90,y+20);if(bits.length)g.fillText(bits.join(" · "),90,y+64);
  g.fillStyle="#262e36";g.fillRect(90,1760,900,2);g.font='500 26px "IBM Plex Mono",monospace';g.fillStyle="#97a1aa";
  g.fillText("Planetary data sonified with Earth MIDI",90,1810);g.fillText("by Colin Robinson · earthmidi.com",90,1848);
  const blob=await new Promise(r=>cv.toBlob(r,"image/png"));if(!blob){xs("Couldn't make the image");return}
  const name=`earth-midi-moment_${when.toISOString().slice(0,16).replace(/[:T]/g,"-")}.png`,file=new File([blob],name,{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:"Earth MIDI",text:"The planet, played live · earthmidi.com"});return}catch(err){if(err&&err.name==="AbortError")return}}
  download(name,blob);xs("Saved a story image of this moment")}
window.EMMoment=moment;
const expRow=document.querySelector("#exp #bVid");if(expRow){const b=document.createElement("button");b.type="button";b.id="bMoment";b.textContent="Story image of this moment";b.onclick=moment;expRow.after(b)}

/* ---------- embed mode ---------- */
if(root.classList.contains("embed")){const a=document.createElement("a");a.className="embcred";a.href="https://earthmidi.com/";a.target="_blank";a.rel="noopener";
  a.innerHTML="<b>Earth MIDI</b> · open the full instrument ↗";body.appendChild(a)}
})();
