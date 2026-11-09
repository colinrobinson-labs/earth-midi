/* Earth MIDI · the list of live data feeds, in one place.
   Plain data, no page code, so the browser and the snapshot job (scripts/snapshot.mjs)
   build exactly the same request URLs. The snapshot job fetches every feed on a schedule
   and publishes the answers at /data/*.json; the page reads those first and only calls a
   source directly when the copy is missing or older than its ttl. See docs/live-data-cache.md. */
"use strict";
const OCEAN_PTS=[["N Pacific",30,-150],["Gulf of Alaska",55,-145],["N Atlantic",50,-30],["S Atlantic",-35,-20],["Cape of Good Hope",-38,20],["S Indian",-40,80],["Bay of Bengal",14,88],["Tasman Sea",-38,160],["Southern Ocean",-55,-90],["Philippine Sea",20,135]];
const JET_PTS=[["N Atlantic",45,-40],["N Pacific",38,165],["N America",42,-95],["Eurasia",45,70],["S Indian",-45,90],["S Pacific",-45,-120]];
const CITIES=[["Reykjavík",64.14,-21.9],["Anchorage",61.2,-149.9],["Tokyo",35.68,139.69],["Los Angeles",34.05,-118.24],["Cairo",30.04,31.24],["Mumbai",19.08,72.88],["Singapore",1.35,103.82],["Nairobi",-1.29,36.82],["São Paulo",-23.55,-46.63],["Sydney",-33.87,151.21]];
const TIDE_ST=[["La Jolla","9410230",32.87,-117.26],["The Battery, NY","8518750",40.7,-74.01],["Honolulu","1612340",21.31,-157.87]];
const WX_LON=[...Array(24)].map((_,i)=>-180+i*15),WX_LAT=[...Array(17)].map((_,j)=>80-j*10),WX_N=408;
const WX_PTS=WX_LAT.flatMap(la=>WX_LON.map(lo=>[la,lo]));

const MIN=6e4,HR=36e5;
const omPts=(pts,la,lo)=>`latitude=${pts.map(p=>p[la])}&longitude=${pts.map(p=>p[lo])}`;
const wxURL=g=>`https://api.open-meteo.com/v1/forecast?${omPts(g,0,1)}&hourly=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl&past_days=1&forecast_days=1&timezone=GMT`;

/* id: key · name: shown in the "delayed" note · file: which snapshot file holds it
   every: how often the snapshot job refetches it · ttl: how old a copy the page will use before calling the source itself
   text: plain-text response */
const FEEDS=[
 {id:"quakes",name:"quakes",url:"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",every:5*MIN,ttl:20*MIN},
 {id:"rtswWind",name:"solar wind",url:"https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",every:5*MIN,ttl:20*MIN},
 {id:"rtswMag",name:"solar wind",url:"https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",every:5*MIN,ttl:20*MIN},
 {id:"kp",name:"Kp",url:"https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",every:15*MIN,ttl:3*HR},
 {id:"xray",name:"X-rays",url:"https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json",every:5*MIN,ttl:20*MIN},
 {id:"dst",name:"Dst",url:"https://services.swpc.noaa.gov/products/kyoto-dst.json",every:15*MIN,ttl:2*HR},
 {id:"protons",name:"protons",url:"https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json",every:5*MIN,ttl:20*MIN},
 {id:"ocean",name:"ocean",url:`https://marine-api.open-meteo.com/v1/marine?${omPts(OCEAN_PTS,1,2)}&current=wave_height,wave_period,wave_direction&hourly=wave_height&past_days=1&forecast_days=1&timezone=GMT`,every:30*MIN,ttl:90*MIN},
 {id:"jet",name:"jet stream",url:`https://api.open-meteo.com/v1/forecast?${omPts(JET_PTS,1,2)}&hourly=wind_speed_250hPa,wind_direction_250hPa&past_days=1&forecast_days=1&timezone=GMT`,every:30*MIN,ttl:3*HR},
 {id:"temps",name:"city temps",url:`https://api.open-meteo.com/v1/forecast?${omPts(CITIES,1,2)}&hourly=temperature_2m&past_days=1&forecast_days=1&timezone=GMT`,every:30*MIN,ttl:3*HR},
 {id:"air",name:"air quality",url:`https://air-quality-api.open-meteo.com/v1/air-quality?${omPts(CITIES,1,2)}&hourly=pm2_5,uv_index&past_days=1&forecast_days=1&timezone=GMT`,every:30*MIN,ttl:3*HR},
 ...TIDE_ST.map(st=>({id:"tide"+st[1],name:"tides",url:`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?range=26&station=${st[1]}&product=water_level&datum=MLLW&units=metric&time_zone=gmt&format=json&application=earth_midi`,every:6*MIN,ttl:30*MIN})),
 {id:"events",name:"NASA events",url:"https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=45",every:30*MIN,ttl:6*HR},
 {id:"issTle",name:"ISS orbit",url:"https://api.wheretheiss.at/v1/satellites/25544/tles?format=json",every:HR,ttl:24*HR},
 {id:"issTleCt",name:"ISS orbit",url:"https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE",every:2*HR,ttl:24*HR,text:true},
 {id:"issFix",name:"ISS fix",url:"https://api.wheretheiss.at/v1/satellites/25544",every:5*MIN,ttl:20*MIN},
 // the weather grid is big and hourly, so it lives in its own file and is fetched rarely (Open-Meteo counts each point as a call)
 {id:"wx0",name:"weather",url:wxURL(WX_PTS.slice(0,204)),every:110*MIN,ttl:6*HR,file:"wx"},
 {id:"wx1",name:"weather",url:wxURL(WX_PTS.slice(204)),every:110*MIN,ttl:6*HR,file:"wx"}];
const FEED=Object.fromEntries(FEEDS.map(f=>[f.id,f.url]));
if(typeof module!=="undefined")module.exports={FEEDS,FEED,WX_N};
