// Offline checks for the WeatherKit switch (scripts/weatherkit.mjs): token signing, field mapping, feed shape.
// No network, no real key: a throwaway key is generated and WeatherKit is mocked.   node tests/weatherkit.test.mjs
import {generateKeyPairSync,createVerify} from "node:crypto";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {wkConfig,wkToken,toOpenMeteo,omHours,wkFeed} from "../scripts/weatherkit.mjs";
const {FEEDS}=createRequire(import.meta.url)("../js/feeds.js");

const {privateKey,publicKey}=generateKeyPairSync("ec",{namedCurve:"P-256"});
const pem=privateKey.export({type:"pkcs8",format:"pem"});
const env={WEATHER_SOURCE:"weatherkit",WEATHERKIT_KEY:pem,WEATHERKIT_KEY_ID:"ABC123DEFG",WEATHERKIT_SERVICE_ID:"com.example.weather"};

// switch logic
assert.equal(wkConfig({}).on,false,"off by default");
assert.equal(wkConfig({WEATHER_SOURCE:"weatherkit"}).on,false,"no secrets = stays off");
assert.equal(wkConfig({...env,WEATHER_SOURCE:"open-meteo"}).on,false);
assert.equal(wkConfig(env).on,true);
assert.equal(wkConfig({...env,WEATHERKIT_KEY:pem.replace(/\n/g,"\\n")}).on,true,"escaped newlines work");

// token: ES256, Apple's header and claims, verifiable with the public key
const c=wkConfig(env),jwt=wkToken(c),[h,p,s]=jwt.split(".");
const head=JSON.parse(Buffer.from(h,"base64url")),body=JSON.parse(Buffer.from(p,"base64url"));
assert.deepEqual(head,{alg:"ES256",kid:"ABC123DEFG",id:"VNJA6Y7DCH.com.example.weather"});
assert.equal(body.iss,"VNJA6Y7DCH");assert.equal(body.sub,"com.example.weather");assert.ok(body.exp>body.iat);
assert.ok(createVerify("SHA256").update(h+"."+p).verify({key:publicKey,dsaEncoding:"ieee-p1363"},Buffer.from(s,"base64url")),"signature verifies");

// mapping: WeatherKit units → Open-Meteo fields, 48 hourly slots, same time format
const hours=omHours();assert.equal(hours.length,48);
const wkHour=t=>({forecastStart:new Date(t).toISOString().replace(".000",""),temperature:12.34,precipitationAmount:0.26,cloudCover:0.47,windSpeed:18.06,windDirection:271.4,pressure:1012.55});
const om=toOpenMeteo(10,20,hours.map(wkHour),["temperature_2m","precipitation","cloud_cover","wind_speed_10m","wind_direction_10m","pressure_msl"],hours);
assert.equal(om.hourly.time[0],new Date(hours[0]).toISOString().slice(0,16));
assert.equal(om.hourly.temperature_2m[5],12.3);assert.equal(om.hourly.precipitation[5],0.3);assert.equal(om.hourly.cloud_cover[5],47);
assert.equal(om.hourly.wind_speed_10m[5],18.1);assert.equal(om.hourly.wind_direction_10m[5],271);assert.equal(om.hourly.pressure_msl[5],1012.6);
assert.throws(()=>toOpenMeteo(0,0,[],["temperature_2m"],hours),/near now/,"no current reading = failure, not invented");

// whole feed with a mocked WeatherKit: right point count, order kept, auth header sent
const temps=FEEDS.find(f=>f.id==="temps");assert.ok(temps.wk&&temps.wk.pts.length===10);
let seen=0;globalThis.fetch=async(url,o)=>{seen++;assert.match(o.headers.authorization,/^Bearer /);
  const m=String(url).match(/weather\/en\/(-?[\d.]+)\/(-?[\d.]+)/);assert.ok(m);
  return {ok:true,status:200,json:async()=>({forecastHourly:{hours:hours.map(t=>({...wkHour(t),temperature:+m[1]}))}})}};
const out=await wkFeed(c,temps);assert.equal(out.length,10);assert.equal(seen,10);
out.forEach((x,i)=>{assert.equal(x.latitude,temps.wk.pts[i][0]);assert.equal(x.hourly.temperature_2m[30],Math.round(temps.wk.pts[i][0]*10)/10)});
// a refused key stops at once instead of retrying 408 times
globalThis.fetch=async()=>({ok:false,status:401});
await assert.rejects(wkFeed(c,FEEDS.find(f=>f.id==="wx0")),/refused the key/);
for(const id of ["wx0","wx1"])assert.equal(FEEDS.find(f=>f.id===id).wk.pts.length,204);
console.log("weatherkit: all checks passed");
