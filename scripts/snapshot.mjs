#!/usr/bin/env node
/* Earth MIDI · live data snapshot.
   Runs in GitHub Actions every ~10 minutes (.github/workflows/pages.yml). Fetches every feed in
   js/feeds.js once, trims each answer to the fields the page reads, and writes
     <out>/data/live.json   small feeds, read by every visitor about once a minute
     <out>/data/wx.json     the 408-point weather grid, read about once every 30-90 minutes
     <out>/data/status.json what was fetched, when, and what failed (for checking on it)
   A feed that fails keeps its last good copy from the published snapshot, with its original time,
   so the page can tell how old it is. This script never fails the deploy: worst case it publishes
   the previous snapshot unchanged, and the page falls back to calling the sources itself.
   No values are invented or altered here. Trimming only drops fields and rows the page doesn't use.

   Usage: node scripts/snapshot.mjs <outDir>
   Env:   SNAPSHOT_PREV  base URL of the published snapshot (default https://earthmidi.com/data/)
          SNAPSHOT_FAKE  path to a JSON map {url: response} for offline tests */
import {createRequire} from "node:module";
import {mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {join} from "node:path";

const require=createRequire(import.meta.url);
const {FEEDS}=require("../js/feeds.js");
const OUT=process.argv[2]||"_site";
const PREV=(process.env.SNAPSHOT_PREV||"https://earthmidi.com/data/").replace(/\/?$/,"/");
const FAKE=process.env.SNAPSHOT_FAKE?JSON.parse(readFileSync(process.env.SNAPSHOT_FAKE,"utf8")):null;
const UA="earthmidi.com live-data snapshot (+https://github.com/colinrobinson-labs/earth-midi)";
const NOW=Date.now(),KEEP_MAX=48*36e5;// never republish a copy older than two days

async function get(url,ms=25000,text=false){
  if(FAKE){if(!(url in FAKE))throw new Error("no fake");const v=FAKE[url];if(v&&v.__status)throw new Error(String(v.__status));return text?String(v):structuredClone(v)}
  const ac=new AbortController(),to=setTimeout(()=>ac.abort(),ms);
  try{const r=await fetch(url,{signal:ac.signal,headers:{"user-agent":UA,accept:text?"text/plain":"application/json"}});
    if(!r.ok)throw new Error("HTTP "+r.status);return text?await r.text():await r.json()}
  finally{clearTimeout(to)}}

/* ---------- trim + sanity checks (throw = keep the last good copy) ---------- */
const since=h=>NOW-h*36e5;
const swpcT=s=>Date.parse(String(s).replace(" ","T")+(/Z$|[+-]\d\d:?\d\d$/.test(String(s))?"":"Z"));
const need=(c,m)=>{if(!c)throw new Error(m)};
const pick=(o,ks)=>Object.fromEntries(ks.filter(k=>k in o).map(k=>[k,o[k]]));
// SWPC "products" come as a header row + rows, or (newer) as a list of objects; keep whichever shape arrives
const table=(j,h)=>{need(Array.isArray(j)&&j.length>1,"empty");
  if(Array.isArray(j[0])){const i=Math.max(0,j[0].indexOf("time_tag"));return [j[0],...j.slice(1).filter(r=>!(swpcT(r[i])<=since(h)))]}
  return j.filter(r=>!(swpcT(r&&r.time_tag)<=since(h)))};
const omCheck=(j,n,key)=>{const a=Array.isArray(j)?j:[j];need(a.length===n,`expected ${n} points, got ${a.length}`);need(a.every(x=>x&&x[key]),`missing ${key}`);
  return a.map(x=>pick(x,["latitude","longitude","current","hourly"]))};
const round1=a=>a.map(x=>({...x,hourly:Object.fromEntries(Object.entries(x.hourly).map(([k,v])=>[k,k==="time"?v:v.map(n=>n==null?null:Math.round(n*10)/10)]))}));
const npts=u=>new URL(u).searchParams.get("latitude").split(",").length;
const TRIM={
  quakes:j=>{need(Array.isArray(j.features),"no features");
    return {type:"FeatureCollection",metadata:pick(j.metadata||{},["generated","count"]),features:j.features.map(f=>({id:f.id,properties:pick(f.properties||{},["mag","place","time","url","tsunami","felt"]),geometry:{coordinates:f.geometry?.coordinates}}))}},
  rtswWind:j=>{need(Array.isArray(j),"not a list");const a=j.filter(r=>r.active&&Date.parse(r.time_tag+"Z")>since(26)).map(r=>pick(r,["time_tag","active","proton_speed","proton_density"]));need(a.length>=10,"too few rows");return a},
  rtswMag:j=>{need(Array.isArray(j),"not a list");const a=j.filter(r=>r.active&&Date.parse(r.time_tag+"Z")>since(26)).map(r=>pick(r,["time_tag","active","bz_gsm","bt"]));need(a.length>=10,"too few rows");return a},

  kp:j=>{need(Array.isArray(j)&&j.length>1,"empty");return j},
  dst:j=>table(j,50),
  xray:j=>{need(Array.isArray(j),"not a list");const a=j.filter(r=>r.energy==="0.1-0.8nm").map(r=>pick(r,["time_tag","energy","flux"]));need(a.length>=10,"too few rows");return a},
  protons:j=>{need(Array.isArray(j),"not a list");const a=j.filter(r=>r.energy===">=10 MeV").map(r=>pick(r,["time_tag","energy","flux"]));need(a.length>=10,"too few rows");return a},
  ocean:(j,f)=>omCheck(j,npts(f.url),"current"),
  jet:(j,f)=>omCheck(j,npts(f.url),"hourly"),temps:(j,f)=>omCheck(j,npts(f.url),"hourly"),air:(j,f)=>omCheck(j,npts(f.url),"hourly"),
  // weather grid: rounded to 0.1, the same rounding the page applies when it loads it
  wx0:(j,f)=>round1(omCheck(j,npts(f.url),"hourly")),wx1:(j,f)=>round1(omCheck(j,npts(f.url),"hourly")),
  tide:j=>{const d=(j.data||[]).filter(r=>r.v!=="").map(r=>({t:r.t,v:r.v}));need(d.length,"no readings");return {data:d}},
  events:j=>{need(Array.isArray(j.events),"no events");
    return {events:j.events.map(e=>{const g=e.geometry||[];return {id:e.id,title:e.title,categories:(e.categories||[]).slice(0,1).map(c=>({id:c.id})),
      geometry:(g.length>1?[g[0],g[g.length-1]]:g).map(x=>pick(x,["date","coordinates","magnitudeValue","magnitudeUnit"])),sources:(e.sources||[]).slice(0,1).map(s=>({url:s.url}))}})}},
  issTle:j=>{need(j.line1&&j.line2,"no TLE");return pick(j,["line1","line2"])},
  issTleCt:t=>{need(/^1 25544/m.test(t)&&/^2 25544/m.test(t),"no TLE");return t.trim()},
  issFix:j=>{need(Number.isFinite(j.latitude)&&Number.isFinite(j.timestamp),"no position");return pick(j,["latitude","longitude","altitude","velocity","timestamp"])}};
const trimFor=f=>TRIM[f.id]||(f.id.startsWith("tide")?TRIM.tide:(j=>j));

/* ---------- run ---------- */
async function prevFile(name){
  if(FAKE&&process.env.SNAPSHOT_PREV_DIR){try{return JSON.parse(readFileSync(join(process.env.SNAPSHOT_PREV_DIR,name+".json"),"utf8")).feeds||{}}catch(_){return {}}}
  try{const j=await get(PREV+name+".json?t="+NOW,15000);return j&&j.v===1?j.feeds:{}}catch(e){console.log(`no previous ${name}.json (${e.message})`);return {}}}
const prev={live:await prevFile("live"),wx:await prevFile("wx")};
const files={live:{},wx:{}},status={};
const host=u=>new URL(u).host,byHost={};
FEEDS.forEach(f=>(byHost[host(f.url)]??=[]).push(f));
// one request at a time per host, hosts in parallel: polite to the sources, still done in seconds
await Promise.all(Object.values(byHost).map(async list=>{for(const f of list){
  const file=f.file||"live",old=prev[file][f.url],t0=Date.now();
  if(old&&NOW-old.at<f.every-9e4){files[file][f.url]={...old,ttl:f.ttl};status[f.id]={ok:true,at:old.at,kept:"not due"};continue}
  try{const raw=await get(f.url,f.id==="events"?45000:f.file?40000:25000,!!f.text);
    const data=trimFor(f)(raw,f);files[file][f.url]={at:NOW,ttl:f.ttl,data};status[f.id]={ok:true,at:NOW,ms:Date.now()-t0}}
  catch(e){const err=String(e&&e.message||e);
    if(old&&NOW-old.at<KEEP_MAX){files[file][f.url]={...old,ttl:f.ttl};status[f.id]={ok:false,at:old.at,err,kept:"last good copy"}}
    else status[f.id]={ok:false,err};
    console.log(`! ${f.id}: ${err}`)}}}));

mkdirSync(join(OUT,"data"),{recursive:true});
for(const [name,feeds] of Object.entries(files)){
  const body=JSON.stringify({v:1,at:NOW,feeds});writeFileSync(join(OUT,"data",name+".json"),body);
  console.log(`${name}.json: ${Object.keys(feeds).length} feeds, ${(body.length/1024).toFixed(0)} KB`)}
writeFileSync(join(OUT,"data","status.json"),JSON.stringify({v:1,at:NOW,feeds:status},null,1));
const bad=Object.entries(status).filter(([,s])=>!s.ok);
console.log(`${FEEDS.length-bad.length}/${FEEDS.length} feeds current${bad.length?" · stale or missing: "+bad.map(([k])=>k).join(", "):""}`);
