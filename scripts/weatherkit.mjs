#!/usr/bin/env node
/* Earth MIDI · Apple WeatherKit as a second weather source, off until the switch is flipped.
   Used by scripts/snapshot.mjs. When the GitHub Actions variable WEATHER_SOURCE is "weatherkit" (and the
   WeatherKit secrets are set), the snapshot job asks WeatherKit for the same points and hours as the
   Open-Meteo feeds marked `wk` in js/feeds.js, and rewrites each answer into the exact Open-Meteo shape
   the page and the apps already read. Same fields, same units, same hours, so the sound rules don't change.

   Field mapping (WeatherKit forecastHourly → Open-Meteo hourly):
     temperature (°C)            → temperature_2m (°C)
     precipitationAmount (mm)    → precipitation (mm in the hour)
     cloudCover (0…1)            → cloud_cover (%), ×100
     windSpeed (km/h)            → wind_speed_10m (km/h)
     windDirection (°, from)     → wind_direction_10m (°, from)
     pressure (mbar, sea level)  → pressure_msl (hPa; 1 mbar = 1 hPa)
   Hours: yesterday 00:00 UTC to today 23:00 UTC, 48 values, like Open-Meteo's past_days=1&forecast_days=1.

   Keys never reach the browser: the job signs a short-lived token (ES256 JWT) with the private key from
   the GitHub secret, calls WeatherKit once per point on its own schedule, and publishes the result as a
   static file. A traffic spike on the site costs zero extra WeatherKit calls.

   Secrets (Settings → Secrets and variables → Actions → Secrets):
     WEATHERKIT_KEY         the whole .p8 private key file
     WEATHERKIT_KEY_ID      the key's 10-character Key ID
     WEATHERKIT_SERVICE_ID  the Services ID, e.g. com.colinrobinson.earthmidi.weather
   Variables (… → Variables):
     WEATHER_SOURCE         "weatherkit" to switch, anything else (or unset) = Open-Meteo
     WEATHERKIT_TEAM_ID     optional, defaults to the team ID below

   Check without switching (one full grid, ~420 calls, nothing published):
     node scripts/weatherkit.mjs check        (the "WeatherKit check" workflow runs this) */
import {createSign,createPrivateKey} from "node:crypto";
import {createRequire} from "node:module";
import {appendFileSync} from "node:fs";

const TEAM_DEFAULT="VNJA6Y7DCH";
const API="https://weatherkit.apple.com";
const UA="earthmidi.com live-data snapshot (+https://github.com/colinrobinson-labs/earth-midi)";
export const LEGAL_DEFAULT="https://weatherkit.apple.com/legal-attribution.html";

/* ---------- config ---------- */
export function wkConfig(env=process.env){
  const want=String(env.WEATHER_SOURCE||"").trim().toLowerCase()==="weatherkit";
  const key=String(env.WEATHERKIT_KEY||"").replace(/\\n/g,"\n").trim();
  const c={want,key,keyId:String(env.WEATHERKIT_KEY_ID||"").trim(),serviceId:String(env.WEATHERKIT_SERVICE_ID||"").trim(),
    teamId:String(env.WEATHERKIT_TEAM_ID||TEAM_DEFAULT).trim()};
  const missing=[["WEATHERKIT_KEY",c.key],["WEATHERKIT_KEY_ID",c.keyId],["WEATHERKIT_SERVICE_ID",c.serviceId]].filter(x=>!x[1]).map(x=>x[0]);
  c.ready=!missing.length;c.missing=missing;c.on=want&&c.ready;
  return c}

/* ---------- token: ES256 JWT, valid one hour ---------- */
const b64u=b=>Buffer.from(b).toString("base64url");
let tok=null;
export function wkToken(c,now=Date.now()){
  if(tok&&tok.exp-now>5*6e4)return tok.jwt;
  const iat=Math.floor(now/1e3),exp=iat+3600;
  const head={alg:"ES256",kid:c.keyId,id:`${c.teamId}.${c.serviceId}`},body={iss:c.teamId,iat,exp,sub:c.serviceId};
  const data=b64u(JSON.stringify(head))+"."+b64u(JSON.stringify(body));
  const sig=createSign("SHA256").update(data).sign({key:createPrivateKey(c.key),dsaEncoding:"ieee-p1363"});
  tok={jwt:data+"."+b64u(sig),exp:exp*1e3};return tok.jwt}

/* ---------- the 48 hourly slots Open-Meteo returns (past_days=1, forecast_days=1, GMT) ---------- */
export function omHours(now=Date.now()){const d=new Date(now),t0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-864e5;
  return [...Array(48)].map((_,i)=>t0+i*36e5)}
const omTime=ms=>new Date(ms).toISOString().slice(0,16);

/* ---------- one point ---------- */
export const CALLS={n:0};
async function hourly(c,lat,lon,hours,ms=20000){
  const q=new URLSearchParams({dataSets:"forecastHourly",hourlyStart:new Date(hours[0]).toISOString().replace(".000",""),hourlyEnd:new Date(hours[hours.length-1]+36e5).toISOString().replace(".000","")});
  const url=`${API}/api/v1/weather/en/${lat.toFixed(4)}/${lon.toFixed(4)}?${q}`;
  for(let attempt=0;;attempt++){
    const ac=new AbortController(),to=setTimeout(()=>ac.abort(),ms);
    try{CALLS.n++;const r=await fetch(url,{signal:ac.signal,headers:{authorization:"Bearer "+wkToken(c),"user-agent":UA,accept:"application/json"}});
      if(r.status===401||r.status===403)throw Object.assign(new Error("WeatherKit refused the key (HTTP "+r.status+")"),{fatal:true});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const j=await r.json(),h=j&&j.forecastHourly&&j.forecastHourly.hours;
      if(!Array.isArray(h)||!h.length)throw new Error("no hourly data");return h}
    catch(e){if(e.fatal||attempt>=2)throw e;await new Promise(r=>setTimeout(r,800*(attempt+1)))}
    finally{clearTimeout(to)}}}

/* ---------- WeatherKit hours → Open-Meteo hourly block ---------- */
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const MAP={
  temperature_2m:h=>r1(h.temperature),
  precipitation:h=>r1(h.precipitationAmount),
  cloud_cover:h=>Number.isFinite(h.cloudCover)?Math.round(h.cloudCover*100):null,
  wind_speed_10m:h=>r1(h.windSpeed),
  wind_direction_10m:h=>Number.isFinite(h.windDirection)?Math.round(h.windDirection):null,
  pressure_msl:h=>r1(h.pressure)};
export function toOpenMeteo(lat,lon,hrs,vars,hours){
  const by=new Map(hrs.map(h=>[Date.parse(h.forecastStart),h]));
  const hourly={time:hours.map(omTime)};
  for(const v of vars){const f=MAP[v];if(!f)throw new Error("no WeatherKit field for "+v);hourly[v]=hours.map(t=>{const h=by.get(t);return h?f(h):null})}
  // the page needs the current hour; a block with no readings near now is treated as a failure
  const now=Date.now(),near=hours.findIndex(t=>Math.abs(t-now)<36e5*1.5);
  if(near<0||hourly[vars[0]][near]==null)throw new Error(`no reading near now at ${lat},${lon}`);
  return {latitude:lat,longitude:lon,hourly}}

/* ---------- a whole feed: every point, a few at a time ---------- */
export async function wkFeed(c,f,{par=6,now=Date.now()}={}){
  const hours=omHours(now),pts=f.wk.pts,out=new Array(pts.length);let i=0,fail=null;
  await Promise.all([...Array(Math.min(par,pts.length))].map(async()=>{
    while(i<pts.length&&!fail){const k=i++,[la,lo]=pts[k];
      try{out[k]=toOpenMeteo(la,lo,await hourly(c,la,lo,hours),f.wk.vars,hours)}
      catch(e){fail=new Error(`point ${k} (${la},${lo}): ${e.message}`);fail.fatal=e.fatal}}}));
  if(fail)throw fail;return out}

/* ---------- attribution: Apple's logo + legal page, shown wherever WeatherKit data appears ---------- */
export async function wkAttribution(){
  const out={name:"Apple Weather",legal:LEGAL_DEFAULT,logos:{}};
  try{const r=await fetch(`${API}/attribution/en`,{headers:{"user-agent":UA}});if(!r.ok)throw new Error("HTTP "+r.status);const j=await r.json();
    if(j.serviceName)out.name=j.serviceName;if(j.legalPageURL)out.legal=new URL(j.legalPageURL,API).href;
    for(const [k,f] of [["dark","logoDark2x"],["light","logoLight2x"]])if(j[f]){
      const u=new URL(j[f],API).href,l=await fetch(u,{headers:{"user-agent":UA}});if(l.ok)out.logos[k]=Buffer.from(await l.arrayBuffer())}}
  catch(e){out.err=String(e.message||e)}
  return out}

/* ---------- check: fetch the full WeatherKit set once and compare with Open-Meteo, publish nothing ---------- */
async function check(){
  const c=wkConfig({...process.env,WEATHER_SOURCE:"weatherkit"}),log=[];const say=s=>{console.log(s);log.push(s)};
  say("## WeatherKit check");
  if(!c.ready){say(`Missing secrets: ${c.missing.join(", ")}. Nothing to test yet.`);finish(log);process.exit(1)}
  say(`Switch right now: WEATHER_SOURCE=${process.env.WEATHER_SOURCE||"(not set)"} → the site uses ${wkConfig().on?"**WeatherKit**":"**Open-Meteo**"}`);
  const require=createRequire(import.meta.url),{FEEDS}=require("../js/feeds.js");
  const a=await wkAttribution();say(`Attribution: ${a.name} · legal ${a.legal} · logos ${Object.keys(a.logos).join(", ")||"none"}${a.err?" · "+a.err:""}`);
  let bad=0;
  for(const f of FEEDS.filter(f=>f.wk)){const t0=Date.now();
    try{const wk=await wkFeed(c,f);let om=null;try{const r=await fetch(f.url,{headers:{"user-agent":UA}});if(r.ok)om=[].concat(await r.json())}catch(_){}
      const rows=f.wk.vars.map(v=>{let n=0,s=0;const now=Date.now();
        wk.forEach((p,k)=>{const o=om&&om[k];if(!o)return;p.hourly.time.forEach((t,i)=>{const a=p.hourly[v][i],b=o.hourly&&o.hourly[v]&&o.hourly[v][i];if(a==null||b==null||Math.abs(Date.parse(t+"Z")-now)>6*36e5)return;
          let d=a-b;if(v==="wind_direction_10m")d=((d+540)%360)-180;s+=Math.abs(d);n++})});
        return `| ${v} | ${n?(s/n).toFixed(1):"–"} |`});
      const filled=wk.reduce((a,p)=>a+p.hourly[f.wk.vars[0]].filter(v=>v!=null).length,0)/wk.length;
      say(`\n**${f.id}**: ${wk.length} points OK in ${((Date.now()-t0)/1e3).toFixed(0)} s, ${filled.toFixed(1)} of 48 hours filled per point. Typical gap vs Open-Meteo near now (±6 h):\n\n| field | mean abs diff |\n|---|---|\n${rows.join("\n")}`)}
    catch(e){bad++;say(`\n**${f.id}**: FAILED · ${e.message}`)}}
  say(`\nWeatherKit calls used by this check: ${CALLS.n}`);finish(log);process.exit(bad?1:0)}
function finish(log){if(process.env.GITHUB_STEP_SUMMARY)try{appendFileSync(process.env.GITHUB_STEP_SUMMARY,log.join("\n")+"\n")}catch(_){}}
if(import.meta.url===`file://${process.argv[1]}`&&process.argv[2]==="check")await check();
