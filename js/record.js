/* Earth MIDI · record + share.
   Video: composites every canvas inside .mapwrap (the globe, plus any overlay such as the sandbox)
   onto a frame sized for where it's going (vertical, square, wide), adds live readouts and the credit,
   and records it with the master audio through MediaRecorder (MP4 where the browser can, WebM otherwise).
   Audio: lossless WAV (the existing writer in io.js) or a small M4A/WebM.
   Then a review sheet: play it back, share the file, save it, copy the caption or a settings link.
   Nothing leaves the browser unless you share it. */
"use strict";
{ // block scope: nothing here leaks into the shared global namespace except window.EMRec
const CAP={kind:"video",shape:IS_MOBILE?"vertical":"square",afmt:"wav",len:30};
try{Object.assign(CAP,JSON.parse(localStorage.getItem("em.cap")||"{}"))}catch(_){}
const capSave=()=>{try{localStorage.setItem("em.cap",JSON.stringify(CAP))}catch(_){}};
let CREC=null,LAST=null,TPEND=null;
const fmtT=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const isGod=()=>document.body.classList.contains("god")||!!(window.GOD&&window.GOD.on)||(typeof S!=="undefined"&&!!(S.god||S.sandbox));
const SHAPES={vertical:{w:1080,h:1920,label:"Vertical",sub:"9:16 · Reels, TikTok, Stories"},square:{w:1080,h:1080,label:"Square",sub:"1:1 · feed posts"},wide:{w:1920,h:1080,label:"Wide",sub:"16:9 · YouTube, desktop"}};
const VID_MIMES=["video/mp4;codecs=avc1.42E01F,mp4a.40.2","video/mp4;codecs=avc1,mp4a.40.2","video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
const AUD_MIMES=["audio/mp4;codecs=mp4a.40.2","audio/mp4","audio/webm;codecs=opus","audio/webm"];
const canVideo=()=>!!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream&&pickMime(VID_MIMES));
const canSmallAudio=()=>!!(window.MediaRecorder&&pickMime(AUD_MIMES));

/* ---------------- the sheet ---------------- */
const ICON={video:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
  audio:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h0"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>',
  save:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 10.5L12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>',
  link:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
  again:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 108-8 8.5 8.5 0 00-6 2.5L4 8.5"/><path d="M4 3.5v5h5"/></svg>'};
function buildSheet(){
  const el=document.createElement("div");el.id="recSheet";el.className="rsheet";el.hidden=true;el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-labelledby","rsTitle");
  el.innerHTML=`<div class="rs-back" data-close></div><div class="rs-card">
  <div class="rs-grab" aria-hidden="true"></div>
  <div class="rs-head"><h3 id="rsTitle">Record</h3><button class="rs-x" data-close aria-label="Close">✕</button></div>
  <div class="rs-setup">
    <div class="rs-kinds" role="radiogroup" aria-label="What to record">
      <button data-kind="video" role="radio">${ICON.video}<b>Video</b><span>globe + sound, ready to post</span></button>
      <button data-kind="audio" role="radio">${ICON.audio}<b>Audio</b><span>sound only, for your DAW</span></button>
    </div>
    <div class="rs-row" data-for="video"><span class="cap">Shape</span><div class="rs-chips" data-opt="shape">${Object.entries(SHAPES).map(([k,v])=>`<button data-v="${k}"><i class="sh sh-${k}"></i><b>${v.label}</b><small>${v.sub}</small></button>`).join("")}</div></div>
    <div class="rs-row" data-for="audio"><span class="cap">Format</span><div class="rs-chips" data-opt="afmt"><button data-v="wav"><b>WAV</b><small>lossless 16-bit · biggest</small></button><button data-v="small"><b id="rsSmallLbl">M4A</b><small>small · easy to send</small></button></div></div>
    <div class="rs-row"><span class="cap">Length</span><div class="rs-chips rs-len" data-opt="len"><button data-v="15"><b>15 s</b></button><button data-v="30"><b>30 s</b></button><button data-v="60"><b>60 s</b></button><button data-v="0"><b>Until I stop</b></button></div></div>
    <div class="rs-row rs-ttl"><span class="cap">Playing the EARTH MIDI title</span><div class="rs-chips" data-opt="tmode"><button data-v="mix"><b>In the mix</b><small>recorded with everything</small></button><button data-v="separate"><b>Own file</b><small>a separate WAV</small></button><button data-v="off"><b>Not recorded</b><small>you hear it, files don't</small></button></div><p class="rs-tnote" id="rsTNote"></p></div>
    <button class="rs-go" id="rsGo"><i></i><span>Start recording</span></button>
    <p class="rs-note" id="rsNote"></p>
  </div>
  <div class="rs-review" hidden>
    <div class="rs-media" id="rsMedia"></div>
    <div class="rs-meta" id="rsMeta"></div>
    <div class="rs-acts">
      <button class="rs-pri" id="rsShare">${ICON.share}<span>Share</span></button>
      <button id="rsSave">${ICON.save}<span>Save</span></button>
      <button id="rsCap">${ICON.copy}<span>Copy caption</span></button>
      <button id="rsLink">${ICON.link}<span>Copy link</span></button>
    </div>
    <button class="rs-again rs-ttlsave" id="rsTitle2" hidden>${ICON.save}<span>Save title track (WAV)</span></button>
    <button class="rs-again" id="rsAgain">${ICON.again}<span>Record another</span></button>
    <p class="rs-note" id="rsNote2"></p>
  </div></div>`;
  document.body.appendChild(el);
  const pill=document.createElement("div");pill.id="recPill";pill.className="rpill";pill.hidden=true;pill.setAttribute("role","status");
  pill.innerHTML=`<i class="rp-dot"></i><span class="rp-k" id="rpK">VIDEO</span><b id="rpT">0:00</b><span class="rp-of" id="rpOf"></span><span class="rp-tt" id="rpTT"></span><button id="rpStop" aria-label="Stop recording"><i></i>Stop</button><span class="rp-bar"><span id="rpBar"></span></span>`;
  document.body.appendChild(pill);
  el.addEventListener("click",e=>{if(e.target.closest("[data-close]"))closeSheet();
    const k=e.target.closest("[data-kind]");if(k){CAP.kind=k.dataset.kind;capSave();syncSheet()}
    const c=e.target.closest(".rs-chips button");if(c){const o=c.parentNode.dataset.opt;if(o==="tmode"){window.EMTitle&&EMTitle.setMode(c.dataset.v);syncSheet();return}CAP[o]=o==="len"?+c.dataset.v:c.dataset.v;capSave();syncSheet()}});
  addEventListener("keydown",e=>{if(e.key==="Escape"&&!el.hidden)closeSheet()});
  $("rsGo").onclick=startCapture;$("rpStop").onclick=stopCapture;
  $("rsShare").onclick=shareLast;$("rsSave").onclick=()=>{if(LAST){download(LAST.name,LAST.blob);note2(`Saved ${LAST.name}`)}};
  $("rsCap").onclick=async()=>{try{await navigator.clipboard.writeText(caption());note2("Caption copied. Paste it with your post")}catch(_){prompt("Copy this caption",caption())}};
  $("rsLink").onclick=async()=>{const u=shareURL();try{await navigator.clipboard.writeText(u);note2("Link copied: opens Earth MIDI with your exact settings")}catch(_){prompt("Copy this link",u)}};
  $("rsAgain").onclick=()=>{showStep("setup")};
  $("rsTitle2").onclick=()=>{if(LAST&&LAST.title){download(LAST.title.name,LAST.title.blob);note2(`Saved ${LAST.title.name}`)}};
}
function syncSheet(){const el=$("recSheet");if(!CAP.kind||(CAP.kind==="video"&&!canVideo()))CAP.kind=canVideo()?"video":"audio";
  if(CAP.afmt==="small"&&!canSmallAudio())CAP.afmt="wav";if(!SHAPES[CAP.shape])CAP.shape="square";
  el.querySelectorAll("[data-kind]").forEach(b=>{b.setAttribute("aria-checked",b.dataset.kind===CAP.kind);b.disabled=b.dataset.kind==="video"&&!canVideo()});
  el.querySelectorAll("[data-for]").forEach(r=>r.hidden=r.dataset.for!==CAP.kind);
  const TM=window.EMTitle?EMTitle.mode:"off";el.querySelector(".rs-ttl").hidden=!window.EMTitle;if(window.EMTitle)$("rsTNote").textContent=EMTitle.rule();
  el.querySelectorAll(".rs-chips").forEach(g=>{const o=g.dataset.opt;g.querySelectorAll("button").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.v)===String(o==="tmode"?TM:CAP[o]));if(o==="afmt"&&b.dataset.v==="small")b.disabled=!canSmallAudio()})});
  const sm=pickMime(AUD_MIMES);$("rsSmallLbl").textContent=sm&&sm.includes("webm")?"WebM":"M4A";
  const vm=pickMime(VID_MIMES),god=isGod();
  $("rsNote").innerHTML=(CAP.kind==="video"?`Records the globe and everything you hear as ${vm&&vm.includes("mp4")?"MP4":"WebM"}${vm&&!vm.includes("mp4")?" (this browser can't write MP4; Chrome and Safari can)":""}. `:`Records the master output${CAP.afmt==="wav"?" as a lossless WAV with the credit in its metadata":""}. `)
    +(S.on?"":"Starts PLAY for you. ")+(god?'<b class="gold">Sandbox is on: the clip is stamped “not real data”.</b> ':"")+"Volume doesn't affect the recording.";
  $("rsGo").querySelector("span").textContent=CAP.kind==="video"?`Record ${SHAPES[CAP.shape].label.toLowerCase()} video`:`Record ${CAP.afmt==="wav"?"WAV":$("rsSmallLbl").textContent} audio`}
function showStep(s){const el=$("recSheet");el.querySelector(".rs-setup").hidden=s!=="setup";el.querySelector(".rs-review").hidden=s!=="review";$("rsTitle").textContent=s==="review"?"Your recording":"Record";if(s==="setup")syncSheet()}
function openSheet(kind){if(CREC){stopCapture();return}if(kind){CAP.kind=kind;capSave()}const el=$("recSheet");showStep(kind||!LAST?"setup":(el.dataset.step||"setup"));el.hidden=false;requestAnimationFrame(()=>el.classList.add("open"));setTimeout(()=>$("rsGo").focus({preventScroll:true}),60)}
function closeSheet(){const el=$("recSheet");el.classList.remove("open");setTimeout(()=>{if(!el.classList.contains("open"))el.hidden=true},260);const v=$("rsMedia").querySelector("video,audio");v&&v.pause()}
const note2=m=>{const n=$("rsNote2");n.textContent=m;clearTimeout(note2.t);note2.t=setTimeout(()=>n.textContent="",5000)};

/* ---------------- recording UI state (pill, dock button, desktop button) ---------------- */
function recUI(on,kind){document.body.classList.toggle("capturing",on);$("recPill").hidden=!on;
  const m=$("mRec"),d=$("bRecord");if(on){$("rpK").textContent=kind==="video"?"VIDEO":"AUDIO";const tm=window.EMTitle?EMTitle.mode:"off";$("rpTT").textContent=tm==="mix"?"title in mix":tm==="separate"?"title → own file":"title not recorded";$("rpOf").textContent=CAP.len?"/ "+fmtT(CAP.len):"";$("rpBar").style.width="0%"}
  if(m){m.classList.toggle("rec-on",on);m.setAttribute("aria-label",on?"Stop recording":"Record video or audio");m.innerHTML=on?`<b>■</b><span class="rk">${kind==="video"?"VID":"AUD"}</span><span class="rt">0:00</span>`:"<b>●</b>Record"}
  if(d){d.classList.toggle("rec-on",on);d.innerHTML=on?`<b>■</b> Stop <span class="rt">0:00</span>`:"<b>●</b> Record"}}
function recTick(s){$("rpT").textContent=fmtT(s);if(CAP.len)$("rpBar").style.width=Math.min(100,s/CAP.len*100)+"%";document.querySelectorAll("#mRec .rt,#bRecord .rt").forEach(e=>e.textContent=fmtT(s))}

/* ---------------- start / stop ---------------- */
async function startCapture(){
  if(CREC)return;
  const kind=CAP.kind,shape=CAP.shape,len=CAP.len;
  if(!S.on){try{await startStop()}catch(e){console.error(e)}}
  if(!A||!S.on){xs("Couldn't start the sound. Tap PLAY, then Record");return}
  closeSheet();
  const god=isGod(),t0=performance.now(),meta={kind,shape,god,start:realNow(),startPerf:t0,tmode:window.EMTitle?EMTitle.mode:"off"};
  TPEND=null;if(window.EMTitle){EMTitle.resetTold();if(meta.tmode==="separate")EMTitle.capStart()}
  const maxS=len||(kind==="video"?600:1200);
  if(kind==="audio"&&CAP.afmt==="wav"){
    toggleRec(false,{onDone:(blob,name)=>finish(blob,meta,"wav"),maxSec:maxS});if(!REC){xs("Couldn't start the recorder");return}
    CREC={kind,stop:()=>stopRec(),t0,iv:0}}
  else{
    if(!A.recDest){xs("This browser can't record here. Try WAV audio");return}
    const mime=kind==="video"?pickMime(VID_MIMES):pickMime(AUD_MIMES);if(!mime){xs("This browser can't record that format");return}
    let stream=A.recDest.stream,comp=null;
    if(kind==="video"){comp=makeCompositor(shape,god);stream=new MediaStream([...comp.stream.getVideoTracks(),...A.recDest.stream.getAudioTracks()])}
    let rec;const big=!IS_MOBILE;
    try{rec=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:kind==="video"?192000:256000,videoBitsPerSecond:big?9e6:6e6})}catch(e){try{rec=new MediaRecorder(stream)}catch(e2){comp&&comp.stop();xs("Recorder failed: "+e2.message);return}}
    const parts=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};
    rec.onstop=()=>{comp&&comp.stop();if(comp){meta.w=comp.W;meta.h=comp.H}const type=(rec.mimeType||mime).split(";")[0];finish(new Blob(parts,{type}),meta,type.includes("mp4")?(kind==="video"?"mp4":"m4a"):"webm")};
    rec.onerror=e=>{console.error(e);xs("Recording error: "+(e.error&&e.error.message||"unknown"))};
    rec.start(1000);CREC={kind,rec,comp,t0,stop:()=>{try{rec.state!=="inactive"&&rec.stop()}catch(_){}}}}
  recUI(true,kind);
  CREC.iv=setInterval(()=>{if(!CREC)return;const s=(performance.now()-CREC.t0)/1000;recTick(s);if(s>=maxS)stopCapture()},250);
}
function stopCapture(){const R=CREC;if(!R)return;CREC=null;if(window.EMTitle)TPEND=EMTitle.capStop();clearInterval(R.iv);recUI(false);xs("Finishing your recording…");R.stop()}
function finish(blob,meta,ext){
  const dur=(performance.now()-meta.startPerf)/1000;
  if(!blob||!blob.size){xs("The recording came out empty. Try again, or pick WAV audio");return}
  const name=`earth-midi${meta.god?"-sandbox":""}_${meta.kind==="video"?meta.shape:"audio"}_${stamp()}.${ext}`;
  if(LAST&&LAST.url)URL.revokeObjectURL(LAST.url);
  const tt=TPEND&&TPEND.blob?TPEND:null;TPEND=null;
  LAST={blob,name,ext,kind:meta.kind,shape:meta.shape,god:meta.god,dur,url:URL.createObjectURL(blob),start:meta.start,title:tt,tmode:meta.tmode};
  $("rsTitle2").hidden=!tt;
  const media=$("rsMedia");media.className="rs-media "+(meta.kind==="video"?"is-"+meta.shape:"is-audio");
  media.innerHTML=meta.kind==="video"?`<video src="${LAST.url}" controls playsinline loop preload="metadata"></video>`:`<div class="rs-wave">${ICON.audio}<b>${ext.toUpperCase()} audio</b><span>${fmtT(dur)}</span></div><audio src="${LAST.url}" controls preload="metadata"></audio>`;
  $("rsMeta").textContent=`${ext.toUpperCase()} · ${fmtT(dur)} · ${(blob.size/1048576).toFixed(1)} MB${meta.kind==="video"&&meta.w?` · ${meta.w}×${meta.h}`:""}${meta.god?" · sandbox":""} · title ${meta.tmode==="mix"?"in the mix":meta.tmode==="separate"?(tt?"saved separately":"not played"):"not recorded"}`;
  const file=new File([blob],name,{type:blob.type});$("rsShare").hidden=!(navigator.canShare&&navigator.canShare({files:[file]}));
  if(tt)note2("Your title playing is in its own WAV: tap “Save title track”");
  $("recSheet").dataset.step="review";showStep("review");$("recSheet").hidden=false;requestAnimationFrame(()=>$("recSheet").classList.add("open"));
  xs(`Recorded ${fmtT(dur)} of ${meta.kind}`)}
function caption(){const top=[...PAN_KEYS].filter(k=>!muted(k)&&LNAME[k]&&k!=="r").slice(0,4).map(k=>LNAME[k].toLowerCase());
  const when=LAST?new Date(LAST.start).toISOString().slice(0,16).replace("T"," ")+" UTC":"";
  return (LAST&&LAST.god?"Sandbox mode, not real data: ":"Real planetary data, played as music: ")+top.join(", ")+(when?` · data from ${when}`:"")+`.\nMade with Earth MIDI by Colin Robinson · earthmidi.com`}
async function shareLast(){if(!LAST)return;const file=new File([LAST.blob],LAST.name,{type:LAST.blob.type});
  let files=[file];if(LAST.title){const tf=new File([LAST.title.blob],LAST.title.name,{type:"audio/wav"});if(navigator.canShare&&navigator.canShare({files:[file,tf]}))files=[file,tf]}
  try{await navigator.share({files,title:"Earth MIDI",text:caption()});note2(files.length>1?"Shared, with the title track as a second file":"Shared")}
  catch(e){if(e&&e.name==="AbortError")return;download(LAST.name,LAST.blob);note2("Sharing isn't available here, so it was saved instead")}}

/* ---------------- video compositor ---------------- */
function makeCompositor(shape,god){
  const sz=SHAPES[shape],scale=IS_MOBILE?(2/3):1,W=Math.round(sz.w*scale/2)*2,H=Math.round(sz.h*scale/2)*2,u=W/1080*(shape==="wide"?.75:1);
  const c=document.createElement("canvas");c.width=W;c.height=H;c.className="rec-canvas";c.setAttribute("aria-hidden","true");document.body.appendChild(c);
  const g=c.getContext("2d"),stream=c.captureStream(30),wrap=document.querySelector(".mapwrap"),wave=new Float32Array(A.an?A.an.fftSize:2048);
  let raf=0,alive=true;
  // map area inside the frame
  const area=shape==="vertical"?{x:0,y:Math.round(H*.17),w:W,h:W}:{x:0,y:0,w:W,h:H};
  const draw=()=>{if(!alive)return;raf=requestAnimationFrame(draw);try{frameDraw()}catch(e){console.error(e)}};
  function frameDraw(){
    const now=performance.now();
    g.fillStyle="#05070a";g.fillRect(0,0,W,H);
    // globe + any overlay canvases, cropped to cover the area, centred on the map
    const wr=wrap.getBoundingClientRect();let edges=null;if(wr.width>0){
      const ar=area.w/area.h;let sw=wr.width,sh=wr.width/ar;if(sh>wr.height){sh=wr.height;sw=sh*ar}const zf=shape==="wide"?1:(CFG.mapView==="flat"?1:1.16);sw*=zf;sh*=zf;const sx=(wr.width-sw)/2,sy=(wr.height-sh)/2;
      wrap.querySelectorAll("canvas").forEach(cn=>{if(!cn.width||!cn.height||cn.offsetParent===null)return;const r=cn.getBoundingClientRect();if(!r.width||!r.height)return;
        const kx=cn.width/r.width,ky=cn.height/r.height,ox=r.left-wr.left,oy=r.top-wr.top;
        // intersection of the crop with this canvas, in wrap CSS px
        const ix0=Math.max(sx,ox),iy0=Math.max(sy,oy),ix1=Math.min(sx+sw,ox+r.width),iy1=Math.min(sy+sh,oy+r.height);if(ix1<=ix0||iy1<=iy0)return;
        const f=area.w/sw,dx=area.x+(ix0-sx)*f,dy=area.y+(iy0-sy)*f,dw=(ix1-ix0)*f,dh=(iy1-iy0)*f;g.drawImage(cn,(ix0-ox)*kx,(iy0-oy)*ky,(ix1-ix0)*kx,(iy1-iy0)*ky,dx,dy,dw,dh);
        if(cn.id==="map")edges={x0:dx,y0:dy,x1:dx+dw,y1:dy+dh}});
      // soften the hard edges where the globe canvas ends inside the frame
      if(edges){const F=70*u,bgc="5,7,10",fe=(x0,y0,x1,y1,horiz)=>{const lg=horiz?g.createLinearGradient(x0,0,x1,0):g.createLinearGradient(0,y0,0,y1);lg.addColorStop(0,`rgba(${bgc},1)`);lg.addColorStop(1,`rgba(${bgc},0)`);g.fillStyle=lg;g.fillRect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0)||W,Math.abs(y1-y0)||H)};
        if(edges.y0>area.y+1)fe(0,edges.y0,0,edges.y0+F,false);if(edges.y1<area.y+area.h-1)fe(0,edges.y1,0,edges.y1-F,false);
        if(edges.x0>area.x+1)fe(edges.x0,0,edges.x0+F,0,true);if(edges.x1<area.x+area.w-1)fe(edges.x1,0,edges.x1-F,0,true)}}
    if(shape!=="vertical"){const tg=g.createLinearGradient(0,0,0,H*.28);tg.addColorStop(0,"rgba(5,7,10,.85)");tg.addColorStop(1,"rgba(5,7,10,0)");g.fillStyle=tg;g.fillRect(0,0,W,H*.28);
      const bg2=g.createLinearGradient(0,H*.62,0,H);bg2.addColorStop(0,"rgba(5,7,10,0)");bg2.addColorStop(1,"rgba(5,7,10,.92)");g.fillStyle=bg2;g.fillRect(0,H*.62,W,H*.38)}
    else{const fade=(y0,y1,a0,a1)=>{const lg=g.createLinearGradient(0,y0,0,y1);lg.addColorStop(0,`rgba(5,7,10,${a0})`);lg.addColorStop(1,`rgba(5,7,10,${a1})`);g.fillStyle=lg;g.fillRect(0,y0,W,y1-y0)};fade(area.y,area.y+80*u,1,0);fade(area.y+area.h-80*u,area.y+area.h,0,1)}
    const pad=Math.round(48*u);
    // header: wordmark + clock
    const hy=shape==="vertical"?Math.round(230*u):pad+Math.round(40*u);
    g.textBaseline="alphabetic";g.textAlign="left";g.font=`800 ${Math.round((shape==="vertical"?96:64)*u)}px Syne,system-ui,sans-serif`;
    const wm="EARTH MIDI",ww=g.measureText(wm).width,hue=(now/16000)%1,lg=g.createLinearGradient(pad,0,pad+ww,0);
    ["#ff5a3c","#ffc53d","#7cff9e","#3cc8ff","#c77dff"].forEach((col,i,arr)=>lg.addColorStop(((i/arr.length)+hue)%1,col));
    if(god){g.fillStyle=goldGrad(g,pad,ww)}else g.fillStyle=lg;
    g.shadowColor=god?"rgba(255,196,60,.7)":"rgba(255,140,90,.35)";g.shadowBlur=24*u*(1+(S.rms||0)*4);g.fillText(wm,pad,hy);g.shadowBlur=0;
    g.font=`500 ${Math.round(24*u)}px "IBM Plex Mono",ui-monospace,monospace`;g.fillStyle="#7d8b99";
    g.fillText(god?"sandbox · you are playing god":"the planet, played live",pad,hy+Math.round(40*u));
    g.textAlign="right";g.fillStyle="#e6edf3";g.font=`600 ${Math.round(24*u)}px "IBM Plex Mono",ui-monospace,monospace`;
    const clk=($("clock")?.textContent||"").trim(),ml=($("modeLbl")?.textContent||"").trim(),vert=shape==="vertical";
    const cy=vert?hy-Math.round(118*u):hy+Math.round(40*u);g.fillText(clk,W-pad,cy);g.fillStyle="#7d8b99";g.font=`500 ${Math.round(18*u)}px "IBM Plex Mono",ui-monospace,monospace`;g.fillText(fitText(g,ml,vert?W-pad*2:W*.42),W-pad,cy+Math.round(28*u));g.textAlign="left";
    // footer zone
    const fy=H-pad;
    // latest event ticker
    const ev=EVENTS[EVENTS.length-1];
    // layer activity bars
    const keys=LAYERS.map(l=>l[0]).filter(k=>k!=="r"||S.style==="pulse"),bw=(W-pad*2)/keys.length,bh=Math.round((shape==="vertical"?150:90)*u),by=fy-Math.round(70*u);
    keys.forEach((k,i)=>{const v=muted(k)?0:clamp(S.hit[k]||0,0,1),x=pad+i*bw,h=Math.max(3*u,v*bh);g.fillStyle=COLS[k];g.globalAlpha=muted(k)?.15:.35+v*.65;g.shadowColor=COLS[k];g.shadowBlur=v*18*u;
      roundRect(g,x+bw*.18,by-h,bw*.64,h,Math.min(6*u,bw*.2));g.fill();g.shadowBlur=0;g.globalAlpha=1;
      if(shape==="vertical"){g.save();g.translate(x+bw/2,by+Math.round(14*u));g.fillStyle=muted(k)?"#3a4652":"#7d8b99";g.font=`500 ${Math.round(14*u)}px "IBM Plex Mono",ui-monospace,monospace`;g.textAlign="center";g.fillText(shortName(k),0,0);g.restore()}});
    // waveform
    if(A.an){A.an.getFloatTimeDomainData(wave);const wy=by-bh-Math.round((shape==="vertical"?90:60)*u),wh=Math.round((shape==="vertical"?60:34)*u);g.beginPath();
      for(let i=0;i<wave.length;i+=4){const x=pad+(i/wave.length)*(W-pad*2),y=wy+wave[i]*wh;i?g.lineTo(x,y):g.moveTo(x,y)}g.strokeStyle=god?"rgba(255,207,74,.8)":"rgba(230,237,243,.6)";g.lineWidth=2*u;g.stroke();
      if(ev&&(shape==="vertical"||shape==="wide")){const ty=wy-wh-Math.round(30*u);g.fillStyle=COLS[ev.layer]||"#e6edf3";g.beginPath();g.arc(pad+8*u,ty-8*u,7*u,0,Math.PI*2);g.fill();
        g.fillStyle="#e6edf3";g.font=`500 ${Math.round(26*u)}px "IBM Plex Sans",system-ui,sans-serif`;g.fillText(fitText(g,ev.text,W-pad*2-30*u),pad+26*u,ty)}}
    // credit
    g.fillStyle="#7d8b99";g.font=`500 ${Math.round(19*u)}px "IBM Plex Mono",ui-monospace,monospace`;g.fillText(fitText(g,god?"Earth MIDI by Colin Robinson · earthmidi.com":"Real data · 0% AI audio · Earth MIDI by Colin Robinson · earthmidi.com",W-pad*2),pad,fy);
    if(god)drawGod(g,W,H,u,now)}
  draw();
  return {stream,W,H,stop(){alive=false;cancelAnimationFrame(raf);stream.getTracks().forEach(t=>t.stop());c.remove()}}}
function goldGrad(g,x,w){const t=(performance.now()/2400)%1,lg=g.createLinearGradient(x,0,x+w,0);lg.addColorStop(0,"#d9a227");lg.addColorStop(clamp(t-.15,0,1),"#ffcf4a");lg.addColorStop(clamp(t,0,1),"#fff4c2");lg.addColorStop(clamp(t+.15,0,1),"#ffcf4a");lg.addColorStop(1,"#d9a227");return lg}
function drawGod(g,W,H,u,now){const p=.5+.5*Math.sin(now/500);g.save();g.strokeStyle=`rgba(255,207,74,${.55+p*.35})`;g.lineWidth=6*u;g.shadowColor="rgba(255,190,40,.8)";g.shadowBlur=30*u;g.strokeRect(3*u,3*u,W-6*u,H-6*u);g.shadowBlur=0;
  const t="SANDBOX · NOT REAL DATA";g.font=`700 ${Math.round(22*u)}px "IBM Plex Mono",ui-monospace,monospace`;const tw=g.measureText(t).width+36*u,x=(W-tw)/2,y=H>W?H*.17-60*u:H*.5-H*.36;
  g.fillStyle="rgba(20,14,2,.8)";roundRect(g,x,y,tw,44*u,22*u);g.fill();g.strokeStyle="#ffcf4a";g.lineWidth=2*u;g.stroke();g.fillStyle="#ffcf4a";g.textAlign="center";g.fillText(t,W/2,y+30*u);g.restore();g.textAlign="left"}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function fitText(g,s,max){s=String(s||"");if(g.measureText(s).width<=max)return s;while(s.length>3&&g.measureText(s+"…").width>max)s=s.slice(0,-1);return s+"…"}
const REC_SHORT={q:"QUAKE",s:"SUN",o:"OCEAN",x:"X-RAY",w:"JET",t:"TIDE",c:"CHORD",i:"ISS",e:"EVENTS",g:"MAG",a:"AIR",u:"DAWN",r:"PULSE"};
const shortName=k=>REC_SHORT[k]||(LNAME[k]||k).slice(0,5).toUpperCase();

/* ---------------- wire up ---------------- */
(function initRecord(){
  buildSheet();
  const tools=document.querySelector(".tools");
  if(tools&&!$("bRecord")){const b=document.createElement("button");b.id="bRecord";b.className="rec-btn";b.setAttribute("aria-haspopup","dialog");b.innerHTML="<b>●</b> Record";tools.prepend(b)}
  $("bRecord").onclick=()=>openSheet();
  const m=$("mRec");if(m){m.innerHTML="<b>●</b>Record";m.setAttribute("aria-label","Record video or audio");m.onclick=()=>openSheet()}
  // Export panel shortcuts open the sheet pre-set
  const av=$("bVid"),aa=$("bAac");if(av)av.onclick=()=>openSheet("video");if(aa)aa.onclick=()=>{CAP.afmt="small";openSheet("audio")};
  // keep the sandbox note current
  new MutationObserver(()=>{if(!$("recSheet").hidden&&!$("recSheet").querySelector(".rs-setup").hidden)syncSheet()}).observe(document.body,{attributes:true,attributeFilter:["class"]});
  document.fonts&&document.fonts.load&&["800 40px Syne","500 20px 'IBM Plex Mono'","500 20px 'IBM Plex Sans'"].forEach(f=>document.fonts.load(f).catch(()=>{}));
})();
window.EMRec={open:openSheet,stop:stopCapture,get capturing(){return !!CREC},get last(){return LAST},caption,isGod,VID_MIMES,AUD_MIMES};
}
