/* Earth MIDI v0.6 · UI, transport, playback loop, boot */
"use strict";
/* ---------- cards ---------- */
const CARDS=[
 ["q","Earthquakes","notes","<b>magnitude → velocity</b> · <b>depth → pitch</b> (shallow is high) · <b>longitude → pan</b> · M4.5+ adds a sub hit and a drum fill"],
 ["s","Solar wind","CC 1–4 + root","<b>speed → filter</b> (+ Pulse tempo by default) · <b>density → resonance</b> · <b>Bz south → darker</b> · <b>Kp → scale</b>"],
 ["o","Ocean swell","CC 5 + notes","<b>wave height → surf level</b> · <b>period → surf rhythm</b> (the real period, in seconds)"],
 ["x","Solar X-rays","CC 6 + notes","<b>X-ray flux → shimmer</b> · a C, M or X class flare rings a bell swell"],
 ["w","Jet stream","CC 7","<b>250 hPa wind (~10 km up) → wind roar + filter</b> · 6 points, both hemispheres"],
 ["t","Ocean tides","CC 8 + bend","<b>measured water level → drone pitch</b> (±50 cents) · NOAA gauges"],
 ["c","Planet chord","notes","<b>each city's live temperature → one voice</b> · cold low, hot high · re-voiced every 20 s"],
 ["i","Space station","CC 16–17 + notes","<b>ISS latitude → beacon pitch</b> · a pluck every 5° of orbit · brighter over land · quieter in Earth's shadow"],
 ["e","Fires, storms, volcanoes","CC 20–22 + notes","<b>active wildfires → ember density</b> (soft tuned crackles) · <b>erupting volcanoes → low drones</b> · <b>storms → swirling wind</b> · NASA EONET"],
 ["g","Magnetosphere","CC 23–24","<b>Dst ring current → metallic drone</b> (stronger storm, louder) · <b>≥10 MeV protons → glitter rate</b>"],
 ["a","Air","CC 14–15","<b>PM2.5 → haze on the planet chord</b> (dirtier air, dirtier sound) · <b>UV index → brightness</b>"],
 ["u","Sunrise chorus","notes","<b>the sun rising or setting over 42 big cities → a chime</b> · up for sunrise, down for sunset · <b>population → velocity</b>"],
 ["m","Moon","CC 9","<b>illumination → reverb size</b> · computed from orbital mechanics, not fetched"]];
function buildCards(){$("grid").innerHTML=CARDS.map(([k,n,midi,m])=>`<div class="ch" id="c${k}" style="--c:${COLS[k]}"><h3><span>${n}</span><small>ch ${CH(k==="m"?"m":k)} · ${midi}</small></h3>
  <div class="vrow"><div class="big" id="v${k}">–</div>${k!=="m"?`<canvas class="vu" id="vu${k}"></canvas>`:""}</div><div class="sub" id="s${k}"></div><canvas class="spark" id="k${k}"></canvas>
  <button type="button" class="chow" aria-expanded="false" aria-controls="c${k}">How it sounds</button><div class="map">${m}</div>${k!=="m"?`<div class="ms"><button data-m="${k}" aria-pressed="false">Mute</button><button data-s="${k}" aria-pressed="false">Solo</button></div>`:""}</div>`).join("");
  document.querySelectorAll("#grid .chow").forEach(b=>b.onclick=()=>{const c=b.closest(".ch"),o=c.classList.toggle("open");b.setAttribute("aria-expanded",String(o))});
  bindMS()}
function bindMS(){document.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>toggleMute(b.dataset.m));document.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>toggleSolo(b.dataset.s))}
function toggleMute(k){S.mute[k]=!S.mute[k];syncMS()}
function toggleSolo(k){S.solo=S.solo===k?null:k;syncMS()}
function syncMS(){document.querySelectorAll("[data-m]").forEach(b=>b.setAttribute("aria-pressed",S.mute[b.dataset.m]));document.querySelectorAll("[data-s]").forEach(b=>b.setAttribute("aria-pressed",S.solo===b.dataset.s));
  document.querySelectorAll(".lrow").forEach(b=>{const k=b.dataset.k;b.classList.toggle("off",muted(k));b.classList.toggle("solo",S.solo===k)});layerCount();document.querySelectorAll(".ch").forEach(c=>c.classList.toggle("dim",muted(c.id.slice(1))))}
/* ---------- layers: one row per sound (desktop side panel, phone drawer) ---------- */
const SHORT={"Pulse drums + bass":"Drums","Fires, storms, volcanoes":"Fires + storms"};
function buildPads(){$("pads").innerHTML=PAN_KEYS.map(k=>`<div class="lrow" data-k="${k}" style="--c:${COLS[k]}">
    <button class="lname" data-k="${k}" title="Tap to mute, hold to solo"><i></i><span>${SHORT[LNAME[k]]||LNAME[k]}</span></button>
    <input type="range" class="lvl" data-lvl="${k}" min="0" max="1.5" step=".05" value="${CFG.vol[k]}" aria-label="${LNAME[k]} level">
    <button class="lm" data-m="${k}" aria-pressed="false" aria-label="Mute ${LNAME[k]}">Mute</button><button class="ls" data-s="${k}" aria-pressed="false" aria-label="Solo ${LNAME[k]}">Solo</button></div>`).join("");
  document.querySelectorAll(".lname").forEach(b=>{let tm=null,long=false;const k=b.dataset.k;
    b.addEventListener("pointerdown",()=>{long=false;tm=setTimeout(()=>{long=true;toggleSolo(k);navigator.vibrate&&navigator.vibrate(20)},450)});
    b.addEventListener("pointerup",()=>{clearTimeout(tm);if(!long)toggleMute(k)});b.addEventListener("pointerleave",()=>clearTimeout(tm));b.addEventListener("pointercancel",()=>clearTimeout(tm));b.oncontextmenu=e=>e.preventDefault()});
  document.querySelectorAll(".lvl").forEach(el=>el.oninput=()=>{const k=el.dataset.lvl;setP(CFG,"vol."+k,+el.value);const m=$("p_vol_"+k);if(m){m.value=el.value;const o=$("p_vol_"+k+"_o");if(o)o.textContent=el.value}afterCFG(true)});
  bindMS()}
function syncLevels(){document.querySelectorAll(".lvl").forEach(el=>{const v=CFG.vol[el.dataset.lvl];if(document.activeElement!==el&&+el.value!==+v)el.value=v})}
function layerCount(){const on=PAN_KEYS.filter(k=>!muted(k)).length,c=$("layCount");if(c)c.textContent=S.solo?`solo: ${SHORT[LNAME[S.solo]]||LNAME[S.solo]}`:`${on} of ${PAN_KEYS.length} on`}

/* ---------- producer panel ---------- */
const SEL=(a)=>a;
const INST={q:[["bell","FM bell"],["marimba","Marimba"],["glass","Glass"],["gong","Gong"],["pluck","Pluck"]],s:[["saw","Saw ensemble"],["soft","Soft triangle"],["hollow","Hollow square"],["pure","Pure sine"]],c:[["voices","Voices (formant)"],["strings","Strings"],["glass","Glass"],["reed","Reed"]],i:[["pluck","FM pluck"],["glass","Glass"],["square","8-bit"]],u:[["chime","Chime"],["warm","Warm"],["soft","Soft"]]};
const TABS=[
 ["Sound",[
  ["Key + scale",[["key","Key","sel",KEYS.map((k,i)=>[i,k])],["oct","Octave shift","rng",-2,2,1],["scale","Scale","sel",[["auto","Auto (from Kp storm level)"],["majpent","Major pentatonic"],["minpent","Minor pentatonic"],["ionian","Major"],["aeolian","Natural minor"],["dorian","Dorian"],["lydian","Lydian"],["mixo","Mixolydian"],["phrygian","Phrygian"],["harmmin","Harmonic minor"],["blues","Blues"],["hirajoshi","Hirajoshi"],["insen","In-sen"],["pelog","Pelog-ish"],["wholetone","Whole tone"],["chromatic","Chromatic"]]],["tune","Tuning A4 (Hz)","rng",415,466,1]]],
  ["Harmony",[["prog","Pad progression","sel",[["classic","I–vi–IV–V shape"],["minor","Minor turn"],["modal","Modal shift"],["rising","Rising steps"],["drone","Single drone chord"],["kp","Follows Kp (calm/stormy)"]]],["chordEvery","Chord change every (s)","rng",2,30,1]]],
  ["Earthquakes",[["inst.q","Instrument","sel",INST.q],["mmin","Min magnitude","rng",0,6,.5],["region","Region","sel",[["world","Whole planet"],["ring","Pacific Ring of Fire"],["americas","Americas"],["asia","Asia-Pacific"],["japan","Japan"],["indo","Indonesia"],["andes","Andes"],["eurmed","Europe, Med & Middle East"],["alaska","Alaska"],["california","California"]]],["qpitch","Pitch from","sel",[["depth","Depth (shallow = high)"],["lat","Latitude (north = high)"],["mag","Magnitude (big = high)"]]],["qpan","Pan from","sel",[["lon","Longitude"],["lat","Latitude"]]],["vcurve","Velocity curve","sel",[["linear","Linear"],["soft","Soft"],["hard","Hard"]]],["velMin","Velocity floor","rng",1,100,1],["velMax","Velocity ceiling","rng",40,127,1],["len","Note length ×","rng",.25,4,.25],["dens","Max notes / sec","rng",1,30,1],["qoct","Quake octave","rng",-2,2,1]],"q"],
  ["Solar wind",[["inst.s","Pad","sel",INST.s]],"s"],
  ["Ocean swell",[["snd.oTone","Surf colour (dark ↔ bright)","rng",-1,1,.1],["snd.oQ","Surf focus (wide wash ↔ narrow hiss)","rng",.3,4,.1]],"o"],
  ["Solar X-rays",[["snd.xBell","Flare bell","sel",[["triangle","Soft"],["sine","Pure"],["square","Hollow"],["sawtooth","Bright"]]],["snd.xOct","Shimmer register (octaves)","rng",-1,1,1]],"x"],
  ["Jet stream",[["snd.wTone","Wind pitch (octaves)","rng",-1,1,.1],["snd.wQ","Breathy ↔ whistling","rng",.4,2.5,.1]],"w"],
  ["Tides",[["snd.tWave","Drone","sel",[["sine","Sine"],["triangle","Warm"],["square","Hollow"],["sawtooth","Buzz"]]],["snd.tOct","Register (octaves)","rng",-1,1,1],["snd.tLp","Drone filter (Hz)","rng",150,2000,10]],"t"],
  ["Planet chord",[["inst.c","Voice","sel",INST.c],["coct","Octave","rng",-2,1,1]],"c"],
  ["Space station",[["inst.i","Pluck","sel",INST.i]],"i"],
  ["Fires, storms, volcanoes",[["snd.eHp","Fire ember brightness (Hz)","rng",400,6000,50],["snd.eOct","Volcano drone register (octaves)","rng",-1,1,1]],"e"],
  ["Magnetosphere",[["snd.gMode","Storm drone","sel",[["metal","Metallic (follows Dst)"],["fifth","Fifth"],["octave","Octave"]]],["snd.gOct","Proton glitter register (octaves)","rng",-1,1,1]],"g"],
  ["Air",[["snd.aTone","Haze colour (dark ↔ bright)","rng",-1,1,.1]],"a"],
  ["Sunrise chorus",[["inst.u","Chime","sel",INST.u]],"u"],
  ["Pulse drums + bass",[["snd.rKick","Kick tune (semitones)","rng",-7,7,1],["snd.rDec","Kick length ×","rng",.4,2,.1],["snd.rBass","Bass wave","sel",[["sawtooth","Saw"],["square","Square"],["sine","Sub sine"],["triangle","Soft"]]],["snd.rTone","Bass brightness (octaves)","rng",-1,1,.1]],"r"],
  ["Moon",[["_","The moon isn't a voice of its own. Its illumination sets the reverb size whenever Master → Reverb level is at −1, so a full moon plays in a bigger room. Pick the room itself on Master.","info"]],"m"]]],
 ["Mixer",null],
 ["Rhythm",[
  ["Genre",[["genre","Genre + style","selg",[["custom","Your own (set it below)"]],GENRES],["tempoSrc","Tempo follows","sel",Object.entries(TSRC).map(([k,v])=>[k,v.n])],["tempoArea","Measured","sel",[["world","Across the whole planet"],["view","Where the globe is facing"]]],["note","tempoNow"]]],
  ["Pulse groove",[["pattern","Groove","sel",Object.entries(GROOVES).map(([k,v])=>[k,v.n])],["bpmMin","Tempo when the data is calm","rng",60,180,1],["bpmMax","Tempo when the data is intense","rng",60,180,1],["bpmLock","Lock tempo (0 = follow the data)","rng",0,180,1]]],
  ["Feel",[["swing","Swing","rng",0,.5,.02],["humanize","Humanize","rng",0,1,.05],["hats","Hi-hat density ×","rng",0,2,.1],["duck","Sidechain duck","rng",0,.9,.05],["wxFeel","Weather feel: rain adds a shaker, gusty wind adds swing","ck"],["fills","Big quakes trigger a kick fill","ck"],["quant","Quantize quakes to the beat","ck"]]]]],
 ["Master",[
  ["Space",[["revType","Reverb room","sel",[["hall","Hall"],["plate","Plate"],["room","Room"],["cathedral","Cathedral"],["cave","Cave"],["space","Deep space"]]],["rev","Reverb level (−1 = follow the moon)","rng",-1,1,.05],["dtime","Delay time","sel",[["0.25","1/8 at 120"],["0.375","dotted 1/8"],["0.5","1/4"],["0.75","dotted 1/4"]]],["dfb","Delay feedback","rng",0,.85,.01],["width","Stereo width","rng",0,1.5,.05]]],
  ["Tone",[["drive","Tape saturation","rng",0,1,.05],["lowEq","Low shelf (dB)","rng",-12,12,.5],["highEq","High shelf / air (dB)","rng",-12,12,.5],["hpf","High-pass (Hz)","rng",20,400,5],["mlp","Low-pass (Hz)","rng",300,20000,100]]]]],
 ["MIDI",[
  ["Sync + input",[["clock","Send MIDI clock (DAW follows the planet's tempo)","ck"],["playAlong","Play along: your keyboard snaps to the planet's scale","ck"]]],
  ["Channels",[["ch.q","Earthquakes","rng",1,16,1],["ch.s","Solar CCs + root","rng",1,16,1],["ch.o","Ocean","rng",1,16,1],["ch.x","Flares","rng",1,16,1],["ch.w","Jet stream CC","rng",1,16,1],["ch.t","Tides CC + bend","rng",1,16,1],["ch.c","Planet chord","rng",1,16,1],["ch.m","Moon CC","rng",1,16,1]]],
  ["Channels 2",[["ch.i","Space station","rng",1,16,1],["ch.e","Natural events","rng",1,16,1],["ch.g","Magnetosphere","rng",1,16,1],["ch.a","Air","rng",1,16,1],["ch.u","Sunrise chorus","rng",1,16,1],["ch.b","Pulse bass","rng",1,16,1],["ch.d","Pulse drums","rng",1,16,1]]]]],
 ["Presets",null]];
const PRESETS={
 "Deep ambient":{style:"ambient",rev:.9,revType:"cathedral",vol:{q:.9,s:1.2,o:1.1,x:.8,w:.7,t:1,c:1.2,r:0,u:1},len:1.6,mmin:1.5},
 "Seismic techno":{style:"pulse",scale:"minpent",pattern:"four",bpmMin:124,bpmMax:136,swing:.08,duck:.6,vol:{q:1,s:.6,o:.4,x:.5,w:.5,t:.7,c:.4,r:1.2,e:.5},len:.5,quant:true,rev:.45,revType:"plate",inst:{q:"marimba"}},
 "Broken planet":{style:"pulse",pattern:"broken",scale:"phrygian",bpmLock:0,bpmMin:84,bpmMax:96,swing:.16,humanize:.4,drive:.5,inst:{q:"pluck",s:"hollow"},revType:"room"},
 "Ring of Fire":{region:"ring",mmin:2.5,scale:"hirajoshi",len:1.3,inst:{q:"gong"},vol:{q:1.3,s:.8,o:.8,x:.6,w:.5,t:.8,c:.6,r:.8}},
 "Space weather":{vol:{q:.3,s:1.4,o:.3,x:1.5,w:.6,t:.3,c:.5,r:.6,g:1.4,i:1.2},scale:"lydian",rev:.85,revType:"space",inst:{i:"glass"}},
 "Ocean & tides":{vol:{q:.3,s:.5,o:1.5,x:.3,w:.9,t:1.5,c:.8,r:0},scale:"dorian",rev:.8},
 "Dawn chorus":{vol:{q:.4,s:.8,o:.6,x:.4,w:.4,t:.6,c:.8,r:0,u:1.5,i:.6},scale:"majpent",inst:{u:"warm"},revType:"hall",rev:.8},
 "Burning world":{vol:{q:.6,s:.6,o:.4,x:.4,w:.8,t:.5,c:1,r:0,e:1.5,a:1.4},scale:"harmmin",drive:.45,inst:{c:"reed"}},
 "Orbit":{vol:{q:.4,s:.7,o:.4,x:.6,w:.3,t:.3,c:.4,r:0,i:1.5,g:1},scale:"wholetone",inst:{i:"square"},width:1.4},
 "California":{region:"california",mmin:0,scale:"majpent",len:.8,inst:{q:"glass"}},
 "Japan":{region:"japan",mmin:1,scale:"insen",inst:{q:"bell"},revType:"plate"},
 "Lo-fi Earth":{style:"pulse",pattern:"half",bpmLock:82,swing:.22,drive:.6,mlp:6500,highEq:-4,inst:{q:"marimba",s:"soft"},revType:"room"}
};
function ctl(k,label,type,o){const id="p_"+k.replace(".","_"),v=getP(CFG,k);
  if(k==="note")return `<p class="xs tnow" id="${label}" aria-live="off"></p>`;
  if(type==="info")return `<p class="xs linfo">${label}</p>`;
  if(type==="selg"){const g=GENRE_BY[v];return `<div class="pc"><label for="${id}">${label}</label><span></span><select id="${id}" data-k="${k}" data-t="sel">${o[0].map(([a,b])=>`<option value="${a}" ${a===v?"selected":""}>${b}</option>`).join("")}${o[1].map(([fam,L])=>`<optgroup label="${fam}">${L.map(([a,b,p])=>`<option value="${a}" ${a===v?"selected":""}>${b} · ${p.lo}–${p.hi}</option>`).join("")}</optgroup>`).join("")}</select>${g?`<small class="xs gtip">${g.tip}</small>`:""}</div>`}
  if(type==="rng")return `<div class="pc"><label for="${id}">${label}</label><output id="${id}_o">${v}</output><input type="range" id="${id}" data-k="${k}" data-t="rng" min="${o[0]}" max="${o[1]}" step="${o[2]}" value="${v}"></div>`;
  if(type==="sel")return `<div class="pc"><label for="${id}">${label}</label><span></span><select id="${id}" data-k="${k}" data-t="sel">${o[0].map(([a,b])=>`<option value="${a}" ${String(a)===String(v)?"selected":""}>${b}</option>`).join("")}</select></div>`;
  return `<div class="pc ck"><input type="checkbox" id="${id}" data-k="${k}" data-t="ck" ${v?"checked":""}><label for="${id}">${label}</label></div>`}
let TAB=0,TABIN=true;const PMORE=new Set();
function buildPro(){
  $("ptabs").innerHTML=STUDIO.tabs(TABS,TAB);
  document.querySelectorAll("#ptabs button").forEach(b=>b.onclick=()=>{if(TAB!==+b.dataset.i){TAB=+b.dataset.i;TABIN=true}buildPro()});
  const [name,groups]=TABS[TAB],g=$("pgrid");
  if(name==="Mixer"){g.className="mixer";g.innerHTML=STUDIO.mixer();bindMS();syncMS()}
  else if(name==="Presets"){g.className="pgrid pre";renderPresets()}
  else{g.className=groups.length>4?"pgrid mas":"pgrid";g.innerHTML=groups.map(([t,cs,lk],i)=>STUDIO.group(t,cs.map(([k,l,ty,...o])=>ctl(k,l,ty,o)).join(""),i,lk)).join("")}
  g.querySelectorAll("[data-k]").forEach(el=>{const k=el.dataset.k,ty=el.dataset.t;if(!ty)return;
    el.addEventListener("focus",()=>{if(LEARN.on){LEARN.armed=k;xs(`Move a knob to map it to “${k}”`)}});el.addEventListener("pointerdown",()=>{if(LEARN.on){LEARN.armed=k;xs(`Move a knob to map it to “${k}”`)}});
    el.oninput=el.onchange=()=>{let val=ty==="ck"?el.checked:ty==="rng"?+el.value:el.value;if(k==="key")val=+val;if(k==="genre"){applyGenre(val);return}setP(CFG,k,val);if(k==="tempoSrc"||k==="tempoArea"){if(NEEDS_WX.has(CFG.tempoSrc)&&typeof loadWX==="function")loadWX();TEMPO.lt=0}const ot=$(el.id+"_o");if(ot)ot.textContent=val;afterCFG(true)};
    if(ty==="sel"||(ty==="rng"&&/^(oct|tune|coct|qoct|snd\.)/.test(k)))el.addEventListener("change",()=>AUD.pick(k))});
  if(name!=="Presets")STUDIO.enhance(g);
  if(name!=="Presets"&&name!=="Mixer")g.querySelectorAll(".pgrp").forEach(grp=>{const t=(grp.querySelector("h5")||{}).textContent||"",cs=[...grp.children].filter(e=>e.tagName!=="H5"&&!e.classList.contains("linfo"));if(cs.length<6)return;
    // long groups show their first four controls; the rest sit behind "More"
    cs.slice(4).forEach(e=>e.classList.add("xtra"));if(PMORE.has(t))grp.classList.add("more-open");
    const b=document.createElement("button");b.type="button";b.className="pmore";const lab=()=>{const o=grp.classList.contains("more-open");b.textContent=o?"Fewer controls":`More (${cs.length-4})`;b.setAttribute("aria-expanded",String(o))};lab();
    b.onclick=()=>{const o=grp.classList.toggle("more-open");o?PMORE.add(t):PMORE.delete(t);lab()};grp.appendChild(b)});
  if(typeof RESET!=="undefined")RESET.decorate(g);
  g.classList.toggle("enter",TABIN);TABIN=false}
function renderPresets(){const g=$("pgrid");if(TABS[TAB][0]!=="Presets")return;
  g.innerHTML=STUDIO.presets();
  g.querySelectorAll("[data-genre]").forEach(b=>b.onclick=()=>{if(S.style!=="pulse")setStyle("pulse");STUDIO.setLast(null);applyGenre(b.dataset.genre);AUD.pick("genre")});
  g.querySelectorAll("[data-fp]").forEach(b=>b.onclick=()=>{STUDIO.setLast(b.dataset.fp);applyPreset(PRESETS[b.dataset.fp],b.dataset.fp);AUD.pick("preset");const n=$("pgrid").querySelector(`[data-fp="${CSS.escape(b.dataset.fp)}"]`);n&&n.classList.add("flash")});
  g.querySelector("[data-reset]").onclick=()=>{STUDIO.setLast(null);if(typeof RESET!=="undefined"){if(!RESET.all())xs("Already at the defaults")}else{CFG=clone(DEF);afterCFG();xs("Settings reset")}};
  g.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{const p=UPRE[b.dataset.up];STUDIO.setLast(b.dataset.up);CFG=mergeCFG(p.cfg);if(p.style)setStyle(p.style);afterCFG();xs(`Preset: ${b.dataset.up}`);AUD.pick("preset")});
  g.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteUserPreset(b.dataset.del));
  $("bUP").onclick=saveUserPreset;$("bEP").onclick=exportPreset;$("fPre").onchange=e=>{e.target.files[0]&&loadFile(e.target.files[0]);e.target.value=""};
  $("bLearn").onclick=()=>{LEARN.on=!LEARN.on;if(LEARN.on&&!midi)initMIDI();renderPresets();xs(LEARN.on?"MIDI learn on: touch a slider, then move a knob":"MIDI learn off")};
  g.classList.toggle("enter",TABIN);TABIN=false}
function applyPreset(p,n){CFG=clone(DEF);Object.entries(p).forEach(([k,v])=>{if(k==="style")setStyle(v);else if(typeof v==="object")Object.assign(CFG[k],v);else CFG[k]=v});afterCFG();xs(`Preset: ${n}`)}
function afterCFG(soft){setRoot();if(+CFG.bpmMax<+CFG.bpmMin)CFG.bpmMax=CFG.bpmMin;if(A){A.pad.lastChord=0;A.choir.last=-99;setPadType();setChoirType();applyMaster()}
  try{localStorage.setItem("em5.cfg",JSON.stringify(CFG))}catch(_){}
  syncLevels();
  if(!soft){buildPro();buildCards();syncMS()}document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===CFG.mapView));document.body.classList.toggle("flat",CFG.mapView==="flat")}
function setStyle(v){S.style=v;document.querySelectorAll("[data-style]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.style===v));seq={next:0,step:0,fill:false}}

/* ---------- playback loop ---------- */
function playQuake(q){
  S.played.add(q.id);const qn=quakeNote(q);let r={note:qn.note,vel:velOf(q.mag),dur:(1.2+q.mag*.9)*CFG.len};
  if(A&&!muted("q"))r=quakeVoice(q);
  midiNote(CH("q"),r.note,r.vel,Math.round(r.dur*400));
  S.rings.push({lat:q.lat,lon:q.lon,mag:q.mag,t:performance.now(),depth:q.depth});
  pushNote(r.note,"q",r.vel,r.dur);S.hit.q=Math.min(1,S.hit.q+map(q.mag,1,6,.25,1));
  const kp=kpAt(q.time);
  logEv(`M${q.mag.toFixed(1)} · ${q.place} · ${Math.round(q.depth)} km deep → ${noteName(r.note)} v${r.vel}`,"q",q,[
    ["Sensor","USGS / ANSS seismic network\n"+new Date(q.time).toISOString().replace("T"," ").slice(0,19)+" UTC"],
    ["Raw reading",`magnitude ${q.mag}\ndepth ${q.depth.toFixed(1)} km\nlat ${q.lat.toFixed(2)}, lon ${q.lon.toFixed(2)}`],
    ["Formula: velocity",`${CFG.velMin} + curve((mag − 1) ÷ 6) × ${CFG.velMax-CFG.velMin}\ncurve: ${CFG.vcurve}\n= ${r.vel}`],
    ["Formula: pitch",`scale: ${scaleLabel(kp)}\n${CFG.qpitch} → step ${qn.step} of ${qn.steps}\n= ${noteName(r.note)} (MIDI ${r.note})`],
    ["Formula: pan",`${CFG.qpan==="lat"?"latitude ÷ 90":"longitude ÷ 180"} × 0.85 = ${quakePan(q).toFixed(2)}`],
    ...(FOCUS.on()?[["Camera focus",`${FOCUS.mode()} mode · facing ${FOCUS.near(q.lat,q.lon).toFixed(2)}\nlevel ×${FOCUS.gain(q.lat,q.lon).toFixed(2)} · screen pan ${FOCUS.pan(q.lat,q.lon,0).toFixed(2)}\nMIDI note + velocity unchanged`]]:[]),
    ["Sound + MIDI",`${CFG.inst.q} voice, ${r.dur.toFixed(1)} s decay${q.mag>=4.5?"\n+ sub-bass hit (M4.5+)":""}\nMIDI ch ${CH("q")} note ${r.note} vel ${r.vel}`],
    ["AI running","none"]]);
  const v=$("vq");if(v)v.innerHTML=`M${q.mag.toFixed(1)}<small>${Math.round(q.depth)} km</small>`;const s=$("sq");if(s)s.textContent=q.place;
}
function auditionQuake(q,quiet){if(!A){initAudio();A.ctx.resume();A.out.gain.setTargetAtTime(+$("vol").value,A.ctx.currentTime,.1)}A.ctx.resume();const was=S.played.has(q.id);const r=quakeVoice(q);pushNote(r.note,"q",r.vel,r.dur);S.rings.push({lat:q.lat,lon:q.lon,mag:q.mag,t:performance.now()});S.hit.q=1;if(!quiet)xs(`M${q.mag.toFixed(1)} ${q.place} → ${noteName(r.note)}`)}
let lastX=null,lastOceanNote=0,issStep=null;
function isLand(lat,lon){if(!window.LANDPX)return false;const x=Math.floor((lon+180)/360*720)%720,y=clamp(Math.floor((90-lat)/180*360),0,359);return LANDPX[(y*720+x)*4]>128}
function tick(){
  if(!S.on)return;
  const t=realNow(),nowMs=performance.now();S.recent=(S.recent||[]).filter(x=>nowMs-x<1000);
  for(const q of S.quakes){if(S.played.has(q.id)||q.time>t)continue;
    if(!passQ(q)){S.played.add(q.id);continue}
    if(S.recent.length>=CFG.dens){S.played.add(q.id);continue}
    S.recent.push(nowMs);
    if(CFG.quant&&S.style==="pulse"&&A){S.played.add(q.id);const d=Math.max(0,(seq.next-A.ctx.currentTime)*1000);setTimeout(()=>playQuake(q),d)}else playQuake(q)}
  const xf=xrayAt(t),xc=flareClass(xf)[0];if(lastX&&"CMX".includes(xc)&&"ABCMX".indexOf(xc)>"ABCMX".indexOf(lastX))flareBell(flareClass(xf),xf);lastX=xc;
  let oh=S.cur.oh||0,op=S.cur.op||8;const oZ=ZN.has("o");if(oZ){const v=viewOcean(t);if(Number.isFinite(v.h))oh=v.h;if(Number.isFinite(v.p))op=v.p||op}
  if(nowMs-lastOceanNote>op*1000&&!(oZ&&ZN.bus("o")<.02)){lastOceanNote=nowMs;const n=degree(scaleFor(S.cur.kp||2),Math.round(map(oh,0,6,2,8)),ROOT-12);midiNote(CH("o"),n,Math.round(map(oh,0,6,30,110)),op*600);pushNote(n,"o",map(oh,0,6,30,110),op*.6);S.hit.o=.7}
  // ISS: a pluck every 5° of orbit (72 per revolution)
  if(S.iss){const per=86400000/S.iss.n,st=Math.floor((t-S.iss.epoch)/(per/72));if(issStep!==null&&st!==issStep&&(()=>{const p=issAt(t);return p&&ZN.w("i",p.lat,p.lon)>.02})()){const p=issAt(t),land=isLand(p.lat,p.lon),sc=scaleFor(S.cur.kp||2),n=degree(sc,Math.round(map(p.lat,-52,52,0,sc.length*2))+(land?sc.length:0),ROOT),vel=S.cur.issLit?(land?96:76):48;
      issPluck(n,vel,FOCUS.pan(p.lat,p.lon,clamp(p.lon/180,-1,1)*.85),land,FOCUS.gain(p.lat,p.lon));midiNote(CH("i"),n,vel,300);pushNote(n,"i",vel,.6);S.hit.i=.9}issStep=st}
  // sunrise / sunset over each city
  const sp=sunPos(t);for(const cc of SUN_CITIES){const up=sunElev(cc[1],cc[2],sp)>-.833,prev=S.sunState[cc[0]];if(prev!==undefined&&up!==prev&&ZN.w("u",cc[1],cc[2])>.02){const r=sunChime(cc,up);S.flashes.push({lat:cc[1],lon:cc[2],name:cc[0],rise:up,t:performance.now()});S.lastSun=`${up?"sunrise":"sunset"} in ${cc[0]}`;
      logEv(`${up?"Sunrise":"Sunset"} · ${cc[0]}`,"u",null,[["Source","Computed solar position (NOAA formula), not fetched"],["Raw reading",`${cc[0]} ${cc[1].toFixed(2)}°, ${cc[2].toFixed(2)}°\nsun crosses −0.833° (${up?"rising":"setting"}) at ${new Date(t).toISOString().slice(11,16)} UTC`],["Formula",`latitude → scale step\npopulation ${cc[3]} M → velocity ${r.vel}`],["Sound + MIDI",`3-note ${up?"rising":"falling"} chime\nMIDI ch ${CH("u")} note ${r.n}`],["AI running","none"]])}S.sunState[cc[0]]=up}
  // newly reported natural events
  for(const e of S.events){if(S.evPlayed.has(e.id)||e.start>t)continue;S.evPlayed.add(e.id);if(ZN.w("e",e.lat,e.lon)<.02)continue;if(t-e.start>864e5*1.02&&S.mode>0&&!S.liveSince)continue;if(S.liveSince&&e.start<S.liveSince-36e5)continue;
    const n={fire:72,storm:67,volcano:48,ice:84}[e.kind]||60;midiNote(CH("e"),n,90,800);pushNote(n,"e",90,1.5);S.hit.e=1;S.rings.push({lat:e.lat,lon:e.lon,mag:2,t:performance.now()});
    logEv(`NASA: ${e.title}`,"e",null,[["Source","NASA EONET (Earth Observatory Natural Event Tracker)"],["Raw reading",`${e.kind}: ${e.title}\nfirst reported ${new Date(e.start).toISOString().slice(0,16)} UTC\n${e.lat.toFixed(2)}°, ${e.lon.toFixed(2)}°`],["Formula",`event type → note (fire C5, storm G4, volcano C3, ice C6)`],["Sound + MIDI",`MIDI ch ${CH("e")} note ${n}`],["AI running","none"]])}
  focusTick();updateEngine();schedulePulse();midiClock();
  $("prog").style.width=(S.mode>0&&!S.liveSince?(t-S.replayFrom)/((S.endT||Date.now())-S.replayFrom)*100:100)+"%";
}
setInterval(tick,50);
setInterval(()=>S.on&&!S.frozen&&refresh(),60000);

/* ---------- transport ---------- */
/* iPhone: play through the silent switch (audio session = playback) */
let UNLOCK=null;function iosUnlock(){try{if(navigator.audioSession)navigator.audioSession.type="playback"}catch(_){}
  if(UNLOCK){UNLOCK.play().catch(()=>{});return}if(!/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent)||!("ontouchend" in document))return;
  const n=4410,b=new ArrayBuffer(44+n*2),v=new DataView(b),w=(o,t)=>[...t].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  w(0,"RIFF");v.setUint32(4,36+n*2,true);w(8,"WAVEfmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,44100,true);v.setUint32(28,88200,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*2,true);
  UNLOCK=new Audio(URL.createObjectURL(new Blob([b],{type:"audio/wav"})));UNLOCK.loop=true;UNLOCK.setAttribute("playsinline","");UNLOCK.play().catch(()=>{})}
async function startStop(){
  if(!S.on){
    iosUnlock();if(!A)initAudio();await A.ctx.resume();A.out.gain.setTargetAtTime(+$("vol").value,A.ctx.currentTime,.3);
    S.mode=+$("mode").value;S.played.clear();S.evPlayed.clear();S.sunState={};issStep=null;S.liveSince=0;S.replayStart=performance.now();S.endT=S.frozen?S.endT:Date.now();S.replayFrom=S.endT-864e5;if(S.frozen&&S.mode===0)S.mode=180;MREC.length=0;EVENTS.length=0;S.startPerf=performance.now();
    if(S.mode===0){S.quakes.forEach(q=>S.played.add(q.id));S.events.forEach(e=>S.evPlayed.add(e.id));S.liveSince=Date.now()}
    S.on=true;document.body.classList.add("playing");document.querySelectorAll(".go").forEach(b=>{b.classList.add("on");b.querySelector("span").textContent="STOP"});setMode();if(!S.frozen)refresh();initMIDI();
  }else{S.on=false;if(UNLOCK)UNLOCK.pause();A.out.gain.setTargetAtTime(0,A.ctx.currentTime,.4);document.body.classList.remove("playing");document.querySelectorAll(".go").forEach(b=>{b.classList.remove("on");b.querySelector("span").textContent="PLAY"});setMode();$("prog").style.width="0";if(REC)stopRec();if(window.EMRec)EMRec.stop()}
}

/* ---------- boot ---------- */
function boot(){
  const fromHash=readHash();setRoot();buildCards();buildPads();buildPro();syncMS();setStyle(S.style);
  $("title").innerHTML="EARTH MIDI".split("").map((ch,i)=>ch===" "?'<span class="sp"> </span>':`<span class="L" style="--c:${COLS[TL_LAYERS[(i>5?i-1:i)%TL_LAYERS.length]]};--i:${i}">${ch}</span>`).join("");
  document.querySelectorAll(".go").forEach(b=>b.onclick=startStop);
  document.querySelectorAll("[data-style]").forEach(b=>b.onclick=()=>setStyle(b.dataset.style));
  // one volume, two sliders (bar on desktop, dock on phones), remembered per browser
  const setVol=(v,src)=>{v=clamp(+v,0,1);["vol","mVol"].forEach(id=>{const el=$(id);if(el&&el!==src)el.value=v});if(A)A.out.gain.setTargetAtTime(v,A.ctx.currentTime,.05);try{localStorage.setItem("em5.vol",v)}catch(_){}};
  try{const sv=localStorage.getItem("em5.vol");if(sv!=null&&isFinite(+sv))setVol(sv)}catch(_){}
  ["vol","mVol"].forEach(id=>{const el=$(id);if(el)el.oninput=e=>setVol(e.target.value,e.target)});
  // Web MIDI: Chrome/Edge/Firefox. Safari (Mac + iPhone) has none, so say so instead of offering a dead menu
  if(!navigator.requestMIDIAccess){const m=$("midiOut");m.disabled=true;m.options[0].textContent="Needs Chrome or Edge";m.title="Safari has no Web MIDI. Use Export → Data pack to get the MIDI instead";if(IS_MOBILE)$("midiCtl").hidden=true}
  $("midiOut").onchange=e=>{out=midi&&e.target.value?midi.outputs.get(e.target.value):null;$("midiState").textContent=out?"sending MIDI":"";clk.on=false};
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{CFG.mapView=b.dataset.view;afterCFG(true);sizeMap()});
  const panel=(id,btn)=>()=>{const p=$(id);p.hidden=!p.hidden;$(btn).setAttribute("aria-expanded",!p.hidden);if(!p.hidden)p.scrollIntoView({behavior:"smooth",block:"nearest"})};
  $("bPro").onclick=panel("pro","bPro");$("bExp").onclick=panel("exp","bExp");
  $("bRec").onclick=()=>toggleRec(false);$("bStems").onclick=()=>toggleRec(true);
  $("bMid").onclick=exportPerfMidi;$("bCsv").onclick=exportEventsCsv;$("bSave").onclick=saveSession;$("fLoad").onchange=e=>{e.target.files[0]&&loadFile(e.target.files[0]);e.target.value=""};
  $("bShare").onclick=shareLink;$("bCredit").onclick=copyCredit;$("bPack").onclick=exportDataPack;$("bPackMid").onclick=exportDataMidOnly;
  document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>{const t=$(b.dataset.jump);if(t.hidden){t.hidden=false;const x=$(t.id==="pro"?"bPro":"bExp");x&&x.setAttribute("aria-expanded","true")}t.scrollIntoView({behavior:"smooth",block:"start"})});
  document.querySelectorAll('a[href="#how"]').forEach(l=>l.addEventListener("click",()=>{$("how").open=true}));if(location.hash==="#how")$("how").open=true;
  addEventListener("keydown",e=>{if(e.target.matches("input,select,textarea"))return;if(e.code==="Space"){e.preventDefault();startStop()}else if(e.key==="g")document.querySelector('[data-view="globe"]').click();else if(e.key==="f")document.querySelector('[data-view="flat"]').click();else if(e.key==="p")setStyle(S.style==="pulse"?"ambient":"pulse")});
  if(fromHash){$("pro").hidden=false;$("bPro").setAttribute("aria-expanded","true")}
  if(IS_MOBILE){VIEW.zoom=.98}
  sizeMap();afterCFG(true);loadLand();refresh(true);requestAnimationFrame(frame);
  // live "AI" counters animate in
  renderLedger();
}
window.onData=()=>{const n=$("feedCount");if(n)n.textContent=14-Object.values(S.demo).filter(Boolean).length};
boot();
