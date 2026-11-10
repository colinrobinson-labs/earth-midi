/* Earth MIDI · live weather on the globe and the flat map.
   Source: Open-Meteo forecast model (CC BY 4.0), or Apple WeatherKit when the weather switch is on
   (docs/weatherkit.md: same points, hours and fields, so the sound is the same), a 15° × 10° global grid of 408 points, hourly,
   from 24 h ago to the end of today (UTC). Wind at 10 m, cloud cover, precipitation, air temperature and sea-level pressure.
   Values are interpolated in space (bilinear) and time (linear), so the weather follows the replay clock.
   Wind particles are pushed by the measured wind field. Cloud and rain shading come from the measured
   fractions; the fine cloud texture is a fixed pattern that gives the 15° cells some grain, nothing more.
   Tap anywhere on the map: the exact point is fetched from the same model and played on the Jet stream bus
   (with WeatherKit on, the tap plays the grid value only: WeatherKit is never called from the browser). */
"use strict";
// grid (WX_LON, WX_LAT, WX_N) and request URLs live in feeds.js, shared with the snapshot job
const WX={t:[],u:null,v:null,c:null,p:null,T:null,f:{u:new Float32Array(WX_N),v:new Float32Array(WX_N),c:new Float32Array(WX_N),p:new Float32Array(WX_N),T:new Float32Array(WX_N),P:new Float32Array(WX_N)},
  ok:false,err:"",loading:false,at:0,fT:NaN,texT:NaN,texC:new Float32Array(64800),texR:new Float32Array(64800),parts:[],pins:[],
  g:null,gLat:NaN,gSize:0,gc:null,fc:null,fT2:0,lastNow:0,hoverAt:0};
(function noise(){// fixed value-noise texture, 360 × 180, wraps east-west
  const W=360,H=180,n=new Float32Array(W*H),h=(x,y,s)=>{const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return v-Math.floor(v)};
  const oct=[[30,.5],[12,.3],[5,.2]];for(let y=0;y<H;y++)for(let x=0;x<W;x++){let a=0;oct.forEach(([c,w],s)=>{const gx=x/c,gy=y/c,x0=Math.floor(gx),y0=Math.floor(gy),tx=gx-x0,ty=gy-y0,nx=Math.round(W/c),
    q=(i,j)=>h(((i%nx)+nx)%nx,j,s),sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);a+=w*lerp(lerp(q(x0,y0),q(x0+1,y0),sx),lerp(q(x0,y0+1),q(x0+1,y0+1),sx),sy)});n[y*W+x]=a}
  WX.noise=n})();

/* ---------- data ---------- */
async function loadWX(force){
  if(WX.loading)return;if(!force&&WX.ok&&Date.now()-WX.at<90*6e4)return;WX.loading=true;
  try{let d=null;
    if(!force)try{const c=JSON.parse(localStorage.getItem("em.wx")||"null");if(c&&c.v===2&&Date.now()-c.at<90*6e4)d=c}catch(_){}
    if(!d){const res=(await Promise.all([FEED.wx0,FEED.wx1].map(u=>getJSON(u,30000)))).flatMap(arr);
      if(res.length!==WX_N||!res[0].hourly)throw new Error("grid");
      const R=a=>a.map(v=>v==null?null:Math.round(v*10)/10);
      d={v:2,at:Date.now(),src:WSRC.wx0||"open-meteo",P:res.map(x=>R(x.hourly.pressure_msl)),time:res[0].hourly.time,T:res.map(x=>R(x.hourly.temperature_2m)),p:res.map(x=>R(x.hourly.precipitation)),c:res.map(x=>x.hourly.cloud_cover),s:res.map(x=>R(x.hourly.wind_speed_10m)),d:res.map(x=>x.hourly.wind_direction_10m)};
      try{localStorage.setItem("em.wx",JSON.stringify(d))}catch(_){}}
    const nT=d.time.length,P=(src,fn)=>{const o=new Float32Array(nT*WX_N);for(let k=0;k<WX_N;k++)for(let i=0;i<nT;i++){const v=fn?fn(k,i):src[k][i];o[i*WX_N+k]=v==null?NaN:v}return o};
    WX.t=omTimes(d.time);WX.T=P(d.T);WX.p=P(d.p);WX.c=P(d.c);WX.P=P(d.P);
    // meteorological direction is where the wind comes FROM: u east, v north
    WX.u=P(0,(k,i)=>d.s[k][i]==null?null:-d.s[k][i]*Math.sin(d.d[k][i]*D2R));WX.v=P(0,(k,i)=>d.s[k][i]==null?null:-d.s[k][i]*Math.cos(d.d[k][i]*D2R));
    WX.ok=true;WX.err="";WX.at=d.at;WX.fT=NaN;WX.texT=NaN;WX.src=d.src||"open-meteo";WSRC.wx0=WX.src;
  }catch(e){if(!WX.ok)WX.err=String(e&&e.message||e)==="429"?"weather feed busy, retrying":"weather feed unreachable, retrying"}
  finally{WX.loading=false;wxLegend(true)}
}
function wxField(t){if(!WX.ok)return false;if(Math.abs(t-WX.fT)<3e4)return true;const ts=WX.t,n=ts.length;let i=0;while(i<n-2&&ts[i+1]<=t)i++;
  const a=clamp((t-ts[i])/((ts[i+1]-ts[i])||1),0,1),o0=i*WX_N,o1=(i+1)*WX_N,f=WX.f;
  for(const key of ["u","v","c","p","T","P"]){const s=WX[key],d=f[key];for(let k=0;k<WX_N;k++){const x=s[o0+k],y=s[o1+k];d[k]=Number.isFinite(x)?(Number.isFinite(y)?x+(y-x)*a:x):(Number.isFinite(y)?y:0)}}
  WX.fT=t;return true}
// bilinear sample of the current field
function wxS(arr,lon,lat){const fx=(((lon+180)%360)+360)%360/15,i0=Math.floor(fx)%24,i1=(i0+1)%24,tx=fx-Math.floor(fx);
  const fy=clamp((80-lat)/10,0,16),j0=Math.min(15,Math.floor(fy)),ty=fy-j0,r0=j0*24,r1=r0+24;
  return (arr[r0+i0]*(1-tx)+arr[r0+i1]*tx)*(1-ty)+(arr[r1+i0]*(1-tx)+arr[r1+i1]*tx)*ty}
function wxSample(lon,lat){const f=WX.f;const u=wxS(f.u,lon,lat),v=wxS(f.v,lon,lat);return {u,v,ws:Math.hypot(u,v),wd:(Math.atan2(-u,-v)/D2R+360)%360,c:wxS(f.c,lon,lat),p:Math.max(0,wxS(f.p,lon,lat)),T:wxS(f.T,lon,lat)}}
// box blur on the 360×180 texture (wraps east-west): smooths the 15° cells into weather-shaped fields
const WX_TMP=new Float32Array(64800);
function blur(a,r){const W=360,H=180,t=WX_TMP,n=2*r+1;
  for(let y=0;y<H;y++){const o=y*W;let s=0;for(let k=-r;k<=r;k++)s+=a[o+((k+W)%W)];for(let x=0;x<W;x++){t[o+x]=s/n;s+=a[o+(x+r+1)%W]-a[o+(x-r+W)%W]}}
  for(let x=0;x<W;x++){let s=0;for(let k=-r;k<=r;k++)s+=t[clamp(k,0,H-1)*W+x];for(let y=0;y<H;y++){a[y*W+x]=s/n;s+=t[Math.min(H-1,y+r+1)*W+x]-t[Math.max(0,y-r)*W+x]}}}
function wxTex(){const C=WX.texC,Rr=WX.texR,N=WX.noise,f=WX.f;
  for(let y=0;y<180;y++){const la=89.5-y;for(let x=0;x<360;x++){const lo=-179.5+x,k=y*360+x;C[k]=wxS(f.c,lo,la)/100;Rr[k]=Math.max(0,wxS(f.p,lo,la))}}
  blur(C,4);blur(C,4);blur(Rr,4);blur(Rr,3);
  for(let k=0;k<64800;k++){const c=C[k],p=Rr[k],n=N[k]-.5;
    C[k]=clamp(c*1.12-.1+n*.55*Math.sqrt(Math.max(0,c)),0,1);
    // rain: log scale, 10 mm/h ≈ full, edge feathered by the same grain
    const ri=Math.log10(1+p*2)/1.32,e=clamp(ri*1.1+n*1.1+.12,0,1);Rr[k]=p<.04?0:clamp(ri,0,1)*e*e}}

/* ---------- inverse projection: screen pixel → lon/lat ---------- */
function invProj(px,py){const W=cv.width,H=cv.height;
  if(CFG.mapView==="flat")return px<0||px>W||py<0||py>H?null:[px/W*360-180,90-py/H*180];
  const R=globeR(),x=(px-W/2)/R,y=-(py-H/2)/R,rho=Math.hypot(x,y);if(rho>=1)return null;
  const c=Math.asin(rho),sc=Math.sin(c),cc=Math.cos(c),p0=VIEW.lat*D2R;if(rho<1e-9)return [VIEW.lon,VIEW.lat];
  const lat=Math.asin(cc*Math.sin(p0)+y*sc*Math.cos(p0)/rho)/D2R,lon=VIEW.lon+Math.atan2(x*sc,rho*cc*Math.cos(p0)-y*sc*Math.sin(p0))/D2R;return [((lon+540)%360)-180,lat]}

/* ---------- cloud + rain shading ---------- */
const WX_COS=new Float32Array(360);
function shadePix(d,o,ca,ra,el,limb){// write one RGBA pixel from cloud + rain amounts
  if(ca<.02&&ra<.02){d[o+3]=0;return}
  const day=clamp((el+.1)/.22,0,1),ac=ca*lerp(.5,.82,day)*limb;
  let r=lerp(78,238,day),g=lerp(92,244,day),b=lerp(122,252,day);
  if(ra>.02){const ar=Math.min(.8,ra*.85+.08)*limb,h=clamp((ra-.55)/.35,0,1),rr=lerp(lerp(70,60,ra),232,h),rg=lerp(lerp(205,140,ra),92,h),rb=255,A=ar+ac*(1-ar);
    r=(rr*ar+r*ac*(1-ar))/A;g=(rg*ar+g*ac*(1-ar))/A;b=(rb*ar+b*ac*(1-ar))/A;d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=A*255}
  else{d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=ac*255}}
function globeCache(G){const p0=VIEW.lat*D2R,sp0=Math.sin(p0),cp0=Math.cos(p0),n=G*G,row=new Float32Array(n),dl=new Float32Array(n),sl=new Float32Array(n),cl=new Float32Array(n),lb=new Float32Array(n);
  for(let j=0;j<G;j++)for(let i=0;i<G;i++){const q=j*G+i,x=(i+.5)/G*2-1,y=1-(j+.5)/G*2,rho=Math.hypot(x,y);if(rho>=1){row[q]=-1;continue}
    const c=Math.asin(rho),sc=rho,cc=Math.cos(c),lat=rho<1e-9?p0:Math.asin(cc*sp0+y*sc*cp0/rho);
    row[q]=clamp(89.5-lat/D2R,0,178.999);dl[q]=rho<1e-9?0:Math.atan2(x*sc,rho*cc*cp0-y*sc*sp0)/D2R;sl[q]=Math.sin(lat);cl[q]=Math.cos(lat);lb[q]=clamp(cc*2.2,0,1)}
  WX.g={row,dl,sl,cl,lb};WX.gLat=VIEW.lat;WX.gSize=G;
  WX.gc=WX.gc||document.createElement("canvas");WX.gc.width=WX.gc.height=G;WX.gimg=WX.gc.getContext("2d").createImageData(G,G)}
function drawClouds(globe,sp){const sd=Math.sin(sp.lat*D2R),cd=Math.cos(sp.lat*D2R);for(let x=0;x<360;x++)WX_COS[x]=Math.cos((-179.5+x-sp.lon)*D2R);
  if(globe){const G=FX.lvl?140:IS_MOBILE?180:240;if(!WX.g||WX.gSize!==G||Math.abs(WX.gLat-VIEW.lat)>.05)globeCache(G);
    // light effects (js/fx.js): while the globe is just drifting, re-shade the clouds ~12 times a second and reuse them in between
    const pn=performance.now();if(FX.lvl&&WX.gT&&pn-WX.gT<80&&!VIEW.drag&&!(typeof MOTION!=="undefined"&&MOTION.inertia)&&WX.gL===VIEW.lon-VIEW.lon%.5){const R=globeR();cx.drawImage(WX.gc,cv.width/2-R,cv.height/2-R,2*R,2*R);return}
    WX.gT=pn;WX.gL=VIEW.lon-VIEW.lon%.5;
    const {row,dl,sl,cl,lb}=WX.g,img=WX.gimg,d=img.data,L=VIEW.lon+179.5,C=WX.texC,Rr=WX.texR;
    for(let q=0,n=G*G;q<n;q++){const o=q*4,r=row[q];if(r<0){d[o+3]=0;continue}
      // bilinear texel lookup so 1° texels never show as steps
      let fc=(dl[q]+L)%360;if(fc<0)fc+=360;const c0=fc|0,c1=c0===359?0:c0+1,tx=fc-c0,r0=r|0,ty=r-r0,k00=r0*360+c0,k01=r0*360+c1,k10=k00+360,k11=k01+360;
      const ca=(C[k00]*(1-tx)+C[k01]*tx)*(1-ty)+(C[k10]*(1-tx)+C[k11]*tx)*ty,ra=(Rr[k00]*(1-tx)+Rr[k01]*tx)*(1-ty)+(Rr[k10]*(1-tx)+Rr[k11]*tx)*ty;
      shadePix(d,o,ca,ra,sl[q]*sd+cl[q]*cd*WX_COS[c0],lb[q])}
    WX.gc.getContext("2d").putImageData(img,0,0);const R=globeR();cx.drawImage(WX.gc,cv.width/2-R,cv.height/2-R,2*R,2*R)}
  else{if(!WX.fc){WX.fc=document.createElement("canvas");WX.fc.width=360;WX.fc.height=180;WX.fimg=WX.fc.getContext("2d").createImageData(360,180)}
    if(performance.now()-WX.fT2>250){WX.fT2=performance.now();const d=WX.fimg.data;
      for(let y=0;y<180;y++){const la=(89.5-y)*D2R,s=Math.sin(la),c=Math.cos(la);for(let x=0;x<360;x++){const k=y*360+x;shadePix(d,k*4,WX.texC[k],WX.texR[k],s*sd+c*cd*WX_COS[x],1)}}
      WX.fc.getContext("2d").putImageData(WX.fimg,0,0)}
    cx.drawImage(WX.fc,0,0,cv.width,cv.height)}}

/* ---------- wind particles ---------- */
const WX_BUCK=[[12,"rgba(190,215,240,.30)"],[25,"rgba(170,220,255,.50)"],[45,"rgba(140,230,255,.72)"],[1e9,"rgba(240,252,255,.92)"]];
function spawn(p,globe){if(globe){for(let k=0;k<6;k++){const a=Math.random()*2*Math.PI,r=Math.sqrt(Math.random())*.97*globeR(),ll=invProj(cv.width/2+Math.cos(a)*r,cv.height/2+Math.sin(a)*r);if(ll){p.lon=ll[0];p.lat=ll[1];break}}}
  else{p.lon=Math.random()*360-180;p.lat=Math.asin(Math.random()*2-1)/D2R*.95}p.age=0;p.max=50+Math.random()*70}
function drawWind(globe,dt){const want=IS_MOBILE?520:1400;while(WX.parts.length<want){const p={};spawn(p,globe);p.age=Math.random()*p.max;WX.parts.push(p)}
  const K=.0042*dt,TR=IS_MOBILE?8:10,f=WX.f,paths=WX_BUCK.map(()=>new Path2D());
  for(const p of WX.parts){const u=wxS(f.u,p.lon,p.lat),v=wxS(f.v,p.lon,p.lat),ws=Math.hypot(u,v),cl=Math.max(.2,Math.cos(p.lat*D2R)),dlo=u*K/cl,dla=v*K;
    p.lon+=dlo;p.lat+=dla;if(p.lon>180)p.lon-=360;if(p.lon<-180)p.lon+=360;p.age+=dt;
    if(p.age>p.max||Math.abs(p.lat)>84||ws<.5){spawn(p,globe);continue}
    const[x1,y1,v1]=proj(p.lon,p.lat);if(v1<=.02){if(globe)spawn(p,globe);continue}
    let lo0=p.lon-dlo*TR/dt;if(!globe&&Math.abs(lo0-p.lon)>180)continue;const[x0,y0,v0]=proj(lo0,p.lat-dla*TR/dt);if(v0<=0)continue;
    let b=0;while(ws>WX_BUCK[b][0])b++;paths[b].moveTo(x0,y0);paths[b].lineTo(x1,y1)}
  cx.lineWidth=(IS_MOBILE?1.25:1.1)*DPR;cx.lineCap="round";paths.forEach((pa,i)=>{cx.strokeStyle=WX_BUCK[i][1];cx.stroke(pa)});cx.lineCap="butt"}

/* ---------- storm vortices around NASA EONET severe storms ---------- */
function drawStorms(now,t,globe){S.events.forEach(e=>{if(e.kind!=="storm"||e.start>t)return;const[x,y,v]=proj(e.lon,e.lat);if(v<=.05)return;
  const R=(globe?globeR()*.07:cv.width*.022)*(globe?.4+.6*v:1),spin=(e.lat>=0?-1:1)*now/1600;
  const g=cx.createRadialGradient(x,y,0,x,y,R*1.4);g.addColorStop(0,"rgba(240,248,255,.0)");g.addColorStop(.25,"rgba(240,248,255,.35)");g.addColorStop(1,"rgba(240,248,255,0)");cx.fillStyle=g;cx.beginPath();cx.arc(x,y,R*1.4,0,7);cx.fill();
  cx.strokeStyle="rgba(235,245,255,.55)";cx.lineWidth=2.2*DPR;for(let a=0;a<3;a++){cx.beginPath();for(let k=0;k<=22;k++){const th=spin+a*2.094+(e.lat>=0?1:-1)*k*.2,rr=R*(.12+k/22*.95);const px=x+Math.cos(th)*rr,py=y+Math.sin(th)*rr*(globe?.6+.4*v:1);k?cx.lineTo(px,py):cx.moveTo(px,py)}cx.stroke()}
  cx.fillStyle="rgba(10,20,30,.7)";cx.beginPath();cx.arc(x,y,R*.1,0,7);cx.fill()})}

/* ---------- tap pins ---------- */
function drawPins(now){WX.pins=WX.pins.filter(p=>now-p.t<3200);WX.pins.forEach(p=>{const[x,y,v]=proj(p.lon,p.lat);if(v<=0)return;const a=(now-p.t)/3200;
  for(let k=0;k<3;k++){const q=clamp(a*1.4-k*.15,0,1);if(q<=0||q>=1)continue;cx.strokeStyle=`rgba(154,209,255,${(1-q)*.85})`;cx.lineWidth=1.6*DPR;cx.beginPath();cx.arc(x,y,(4+q*34)*DPR,0,7);cx.stroke()}
  if(p.ws>.5){const ang=Math.atan2(p.v,p.u),L=clamp(p.ws,4,60)*.55*DPR+10*DPR;cx.strokeStyle=`rgba(240,252,255,${1-a})`;cx.lineWidth=2*DPR;cx.beginPath();cx.moveTo(x,y);const ex=x+Math.cos(ang)*L,ey=y-Math.sin(ang)*L;cx.lineTo(ex,ey);
    cx.moveTo(ex,ey);cx.lineTo(ex-Math.cos(ang-.45)*7*DPR,ey+Math.sin(ang-.45)*7*DPR);cx.moveTo(ex,ey);cx.lineTo(ex-Math.cos(ang+.45)*7*DPR,ey+Math.sin(ang+.45)*7*DPR);cx.stroke()}
  cx.fillStyle="#fff";cx.beginPath();cx.arc(x,y,2.6*DPR,0,7);cx.fill()})}

/* ---------- called by drawMap, after the base map and before the data layers ---------- */
window.WXdraw=function(now,t,globe){if(!CFG.weather)return;const dt=clamp((now-(WX.lastNow||now))/16.7,0,3)||1;WX.lastNow=now;
  if(!wxField(t)){drawPins(now);return}
  if(!(Math.abs(t-WX.texT)<(IS_MOBILE?6e5:3e5))){wxTex();WX.texT=t}
  const sp=sunPos(t);drawClouds(globe,sp);drawWind(globe,dt);drawStorms(now,t,globe);drawPins(now)};

/* ---------- readouts ---------- */
const DIRS=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"],dirName=d=>DIRS[Math.round(d/22.5)%16];
const WMO={0:"clear sky",1:"mainly clear",2:"partly cloudy",3:"overcast",45:"fog",48:"rime fog",51:"light drizzle",53:"drizzle",55:"heavy drizzle",56:"freezing drizzle",57:"freezing drizzle",61:"light rain",63:"rain",65:"heavy rain",66:"freezing rain",67:"freezing rain",71:"light snow",73:"snow",75:"heavy snow",77:"snow grains",80:"rain showers",81:"rain showers",82:"violent rain showers",85:"snow showers",86:"heavy snow showers",95:"thunderstorm",96:"thunderstorm with hail",99:"thunderstorm with heavy hail"};
const fmtLL=(lo,la)=>`${Math.abs(la).toFixed(1)}°${la>=0?"N":"S"} ${Math.abs(lo).toFixed(1)}°${lo>=0?"E":"W"}`;
const overLand=(lo,la)=>{const px=window.LANDPX;if(!px)return null;const x=clamp(Math.floor((lo+180)/360*720),0,719),y=clamp(Math.floor((90-la)/180*360),0,359);return px[(y*720+x)*4]>128};
function wxLegend(force){const el=$("wxl");if(!el)return;el.hidden=!CFG.weather;if(!CFG.weather)return;
  const h=WX.ok?`<div class="wxg"><i></i><span>wind 0</span><span>25</span><span>45+ km/h</span></div><div class="wxk"><span><i class="c"></i>cloud</span><span><i class="r"></i>rain</span><span><i class="h"></i>heavy</span></div><div class="wxs">${WX.src==="weatherkit"?"Apple Weather":"Open-Meteo model"} · 15° grid · ${new Date(WX.at).toISOString().slice(11,16)} UTC</div><div class="wxa" data-wk hidden></div><div class="wxh" id="wxh"></div>`
    :`<div class="wxs">${WX.err||"loading live weather…"}</div>`;if(force||el._h!==h){el.innerHTML=h;el._h=h;wkSync()}}
function wxLine(s){return `wind ${Math.round(s.ws)} km/h from ${dirName(s.wd)} · cloud ${Math.round(s.c)}% · ${s.p>=.05?`rain ${s.p.toFixed(1)} mm/h`:"dry"} · ${Math.round(s.T)}°C`}

/* ---------- sound: one gust, one tone, rain drops, on the Jet stream bus + MIDI ---------- */
function wxVoice(s,lon){if(!A){initAudio();A.ctx.resume();A.out.gain.setTargetAtTime(+$("vol").value,A.ctx.currentTime,.1)}A.ctx.resume();
  const sc=scaleFor(S.cur.kp||2),steps=sc.length*3,n=degree(sc,Math.round(map(s.T,-30,45,0,steps-1)),ROOT+12),vel=Math.round(map(s.ws,0,70,55,120));
  midiNote(CH("w"),n,vel,1800);pushNote(n,"w",vel,1.8);S.hit.w=1;if(muted("w"))return n;
  const {ctx}=A,c=ctx.currentTime+.01,bus=A.buses.w,pan=clamp(lon/180,-1,1)*.8;
  // gust: filtered noise, louder and brighter with wind speed
  const src=ctx.createBufferSource();src.buffer=A.nb;src.playbackRate.value=.8+Math.random()*.3;const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.Q.value=1.6;
  const f0=map(s.ws,0,70,320,1500);bp.frequency.setValueAtTime(f0*.6,c);bp.frequency.linearRampToValueAtTime(f0*1.4,c+.7);bp.frequency.exponentialRampToValueAtTime(f0*.5,c+2.4);
  const g=ctx.createGain(),pk=map(s.ws,0,70,.12,.75),pn=ctx.createStereoPanner();pn.pan.value=pan;g.gain.setValueAtTime(0,c);g.gain.linearRampToValueAtTime(pk,c+.35);g.gain.exponentialRampToValueAtTime(.001,c+2.6);
  src.connect(bp);bp.connect(g);g.connect(pn);pn.connect(bus);src.start(c);src.stop(c+2.7);
  // tone: temperature picks the note, cloud cover closes the filter (clear sky = bright)
  const o=ctx.createOscillator(),o2=ctx.createOscillator(),lp=ctx.createBiquadFilter(),tg=ctx.createGain(),tp=ctx.createStereoPanner();o.type="triangle";o2.type="sine";o.frequency.value=mtof(n);o2.frequency.value=mtof(n+12);o2.detune.value=4;
  lp.type="lowpass";lp.frequency.value=map(s.c,0,100,4200,520);lp.Q.value=2;tp.pan.value=pan;tg.gain.setValueAtTime(0,c);tg.gain.linearRampToValueAtTime(.16,c+.06);tg.gain.exponentialRampToValueAtTime(.001,c+2.4);
  o.connect(lp);o2.connect(lp);lp.connect(tg);tg.connect(tp);tp.connect(bus);tp.connect(A.dly);o.start(c);o2.start(c);o.stop(c+2.5);o2.stop(c+2.5);
  // rain: one drop per 0.25 mm/h, up to 24, high notes from the same scale
  const drops=Math.min(24,Math.round(s.p*4));for(let i=0;i<drops;i++){const w=c+.15+Math.random()*2,dn=degree(sc,Math.floor(Math.random()*sc.length*2),ROOT+36),d=ctx.createOscillator(),dg=ctx.createGain(),dp=ctx.createStereoPanner();
    d.type="sine";d.frequency.value=mtof(dn);dg.gain.setValueAtTime(0,w);dg.gain.linearRampToValueAtTime(.05,w+.002);dg.gain.exponentialRampToValueAtTime(.0003,w+.14);dp.pan.value=clamp(pan+(Math.random()-.5)*.8,-1,1);d.connect(dg);dg.connect(dp);dp.connect(bus);dp.connect(A.dly);d.start(w);d.stop(w+.16)}
  return n}

/* ---------- tap to hear, hover to read ---------- */
let wxReq=0;
window.wxTap=function(e,r){if(!CFG.weather||!WX.ok)return false;const ll=invProj((e.clientX-r.left)*DPR,(e.clientY-r.top)*DPR);if(!ll)return false;
  const [lon,lat]=ll,t=realNow();wxField(t);const s=wxSample(lon,lat),tip=$("tip"),land=overLand(lon,lat),id=++wxReq;
  WX.pins.push({lon,lat,t:performance.now(),u:s.u,v:s.v,ws:s.ws});const n=wxVoice(s,lon);
  const head=`<b style="color:#9ad1ff">${fmtLL(lon,lat)}</b>${land==null?"":land?" · over land":" · over ocean"}`;
  const body=(x,lbl)=>`${head}<br>${wxLine(x)}<br><small>${lbl} → ${noteName(n)}</small>`;
  const wk=WX.src==="weatherkit"||SNAP.wsrc==="weatherkit";
  tip.innerHTML=body(s,`${wk?"Apple Weather grid":"model grid"} at ${new Date(t).toISOString().slice(11,16)} UTC`)+(wk?`<br><small>${wkMark()}</small>`:"");tip.style.display="block";
  tip.style.left=Math.min(Math.max(4,e.clientX-r.left-110),r.width-254)+"px";tip.style.top=Math.max(4,e.clientY-r.top-92)+"px";
  logEv(`weather ${fmtLL(lon,lat)} · ${wxLine(s)} → ${noteName(n)}`,"w",null,[["Sensor",wk?"Apple Weather (WeatherKit), 15°×10° global grid, hourly":"Open-Meteo forecast model (CC BY 4.0), 15°×10° global grid, hourly"],["Raw reading",wxLine(s)],["Formula","temperature −30…45 °C → scale step\nwind 0…70 km/h → gust level, brightness, velocity\ncloud 0…100% → low-pass 4.2 kHz…520 Hz\nrain → one drop per 0.25 mm/h"],["Sound + MIDI",`Jet stream bus · MIDI ch ${CH("w")} · ${noteName(n)} vel ${Math.round(map(s.ws,0,70,55,120))}`],["AI running","none"]]);
  // exact point, current conditions, from the same model (Open-Meteo only; WeatherKit stays server-side)
  if(wk)return true;
  getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&timezone=GMT`,12000).then(j=>{
    if(id!==wxReq||tip.style.display==="none")return;const c=j.current;if(!c)return;const x={ws:c.wind_speed_10m,wd:c.wind_direction_10m,c:c.cloud_cover,p:c.precipitation,T:c.temperature_2m};
    const nowL=`<b>${WMO[c.weather_code]||"now"}</b>${Number.isFinite(c.wind_gusts_10m)?` · gusts ${Math.round(c.wind_gusts_10m)} km/h`:""}<br>${wxLine(x)}`;
    tip.innerHTML=Math.abs(Date.now()-t)>18e5?`${head}<br>${wxLine(s)}<br><small>model grid at ${new Date(t).toISOString().slice(11,16)} UTC (replay) → ${noteName(n)}</small><br>right now here: ${nowL}`:`${head}<br>${nowL}<br><small>this exact point, ${String(c.time).slice(11,16)} UTC → ${noteName(n)}</small>`}).catch(()=>{});
  return true};
cv.addEventListener("pointermove",e=>{if(e.pointerType==="touch"||!CFG.weather||!WX.ok||VIEW.drag)return;const now=performance.now();if(now-WX.hoverAt<60)return;WX.hoverAt=now;const h=$("wxh");if(!h)return;
  const r=cv.getBoundingClientRect(),ll=invProj((e.clientX-r.left)*DPR,(e.clientY-r.top)*DPR);if(!ll){h.textContent="";return}wxField(realNow());h.textContent=`${fmtLL(ll[0],ll[1])} · ${wxLine(wxSample(ll[0],ll[1]))}`});
cv.addEventListener("pointerleave",()=>{const h=$("wxh");if(h)h.textContent=""});

/* ---------- toggle ---------- */
function wxSync(){const b=$("wxBtn");if(b)b.setAttribute("aria-pressed",!!CFG.weather);wxLegend(true);if(CFG.weather)loadWX()}
window.wxToggle=function(){CFG.weather=!CFG.weather;try{localStorage.setItem("em5.cfg",JSON.stringify(CFG))}catch(_){}wxSync();xs(CFG.weather?"Live weather on":"Live weather off")};
{const b=$("wxBtn");if(b)b.onclick=wxToggle}
addEventListener("keydown",e=>{if(e.target.matches("input,select,textarea"))return;if(e.key==="w"&&!e.metaKey&&!e.ctrlKey)wxToggle()});
setTimeout(wxSync,1200);setInterval(()=>CFG.weather&&!S.frozen&&loadWX(),10*6e4);
