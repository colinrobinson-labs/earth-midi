// Renders every app icon / top shelf image from the Earth MIDI "Breach" mark (breach-mark.js) with headless Chromium.
// Run from the repo root: node apps/apple/scripts/make-icons.js   (needs playwright; output is committed)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const A=path.join(__dirname,'..');
const M=require('./breach-mark.js');
const svg=(w,h,defs,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
// iOS: full-bleed square, the system rounds the corners. R = 300/1024 of the canvas.
const ios=s=>{const R=s*300/1024;return svg(s,s,M.bgDefs('i',s>=64)+M.glowDef('i',R),M.bg('i',0,0,s,s,0,s>=64)+M.mark('i',s/2,s/2,R))};
// macOS: rounded tile inset on a transparent canvas (Apple's 824/1024 grid)
const mac=s=>{const i=s*100/1024,w=s-2*i,R=s*300/1024*.805,g=s>=64;
  return svg(s,s,M.bgDefs('m',g)+M.glowDef('m',R)+`<filter id="ms" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="${s*14/1024}" stdDeviation="${s*16/1024}" flood-color="#000" flood-opacity=".45"/></filter>`,
    `<g filter="url(#ms)"><rect x="${i}" y="${i}" width="${w}" height="${w}" rx="${w*.225}" fill="#05070a"/></g>${M.bg('m',i,i,w,w,w*.225,g)}<rect x="${i}" y="${i}" width="${w}" height="${w}" rx="${w*.225}" fill="none" stroke="#ffffff17" stroke-width="${Math.max(1,s/256)}"/>${M.mark('m',s/2,s/2,R)}`)};
// tvOS layered icon (parallax): Back = graphite + grain, Middle = broken spectrum ring, Front = seismogram
const tvR=h=>.28*h;
const tvBack=(w,h)=>svg(w,h,M.bgDefs('b',true),M.bg('b',0,0,w,h,0,true));
const tvRing=(w,h)=>{const R=tvR(h),r=M.ring(w/2,h/2,R);return svg(w,h,M.glowDef('r',R),M.glow('r',r)+r)};
const tvWave=(w,h)=>{const R=tvR(h),t=M.trace(w/2,h/2,R);return svg(w,h,M.glowDef('t',R),M.glow('t',t)+t)};
const shelf=(w,h)=>{const R=h*.3;return svg(w,h,M.bgDefs('s',true)+M.glowDef('s',R),M.bg('s',0,0,w,h,0,true)+M.mark('s',w*.08+R*1.42,h/2,R)+
  `<text x="${w*.08+R*3.1}" y="${h*.56}" font-family="Archivo,Helvetica Neue,Arial" font-stretch="125%" font-weight="900" font-size="${h*.15}" fill="#eceee8" letter-spacing="${h*.004}">EARTH MIDI</text><text x="${w*.08+R*3.1+h*.006}" y="${h*.68}" font-family="IBM Plex Mono,Menlo,monospace" font-size="${h*.045}" fill="#97a1aa" letter-spacing="${h*.008}">THE PLANET, PLAYED LIVE</text>`)};
const jobs=[];const put=(rel,w,h,s)=>jobs.push({file:path.join(A,rel),w,h,s});
const AS=path.join(A,'App/Assets.xcassets'),TV=path.join(A,'TV/Assets.xcassets');
const J=(p,o)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2))};
J(path.join(AS,'Contents.json'),{info:{author:'xcode',version:1}});
// iOS single-size + macOS sizes in one AppIcon set
const macSizes=[[16,1],[16,2],[32,1],[32,2],[128,1],[128,2],[256,1],[256,2],[512,1],[512,2]];
put('App/Assets.xcassets/AppIcon.appiconset/ios-1024.png',1024,1024,ios(1024));
macSizes.forEach(([p,sc])=>put(`App/Assets.xcassets/AppIcon.appiconset/mac-${p}@${sc}x.png`,p*sc,p*sc,mac(p*sc)));
J(path.join(AS,'AppIcon.appiconset/Contents.json'),{images:[{filename:'ios-1024.png',idiom:'universal',platform:'ios',size:'1024x1024'},...macSizes.map(([p,sc])=>({filename:`mac-${p}@${sc}x.png`,idiom:'mac',scale:`${sc}x`,size:`${p}x${p}`}))],info:{author:'xcode',version:1}});
J(path.join(AS,'AccentColor.colorset/Contents.json'),{colors:[{idiom:'universal',color:{'color-space':'srgb',components:{red:'0.235',green:'0.784',blue:'1.000',alpha:'1.000'}}}],info:{author:'xcode',version:1}});
put('App/Assets.xcassets/Mark.imageset/mark.png',512,512,ios(512));
J(path.join(AS,'Mark.imageset/Contents.json'),{images:[{filename:'mark.png',idiom:'universal'}],info:{author:'xcode',version:1}});
// tvOS brand assets
const BA=path.join(TV,'App Icon & Top Shelf Image.brandassets');
J(path.join(TV,'Contents.json'),{info:{author:'xcode',version:1}});
J(path.join(TV,'AccentColor.colorset/Contents.json'),{colors:[{idiom:'universal',color:{'color-space':'srgb',components:{red:'0.235',green:'0.784',blue:'1.000',alpha:'1.000'}}}],info:{author:'xcode',version:1}});
const stack=(name,w,h,scales)=>{const dir=path.join(BA,name+'.imagestack');J(path.join(dir,'Contents.json'),{info:{author:'xcode',version:1},layers:[{filename:'Front.imagestacklayer'},{filename:'Middle.imagestacklayer'},{filename:'Back.imagestacklayer'}]});
  [['Front',tvWave],['Middle',tvRing],['Back',tvBack]].forEach(([L,f])=>{const ld=path.join(dir,L+'.imagestacklayer');J(path.join(ld,'Contents.json'),{info:{author:'xcode',version:1}});
    const imgs=scales.map(sc=>{const fn=`${L.toLowerCase()}@${sc}x.png`;jobs.push({file:path.join(ld,'Content.imageset',fn),w:w*sc,h:h*sc,s:f(w*sc,h*sc)});return {filename:fn,idiom:'tv',scale:`${sc}x`}});
    J(path.join(ld,'Content.imageset/Contents.json'),{images:imgs,info:{author:'xcode',version:1}})})};
stack('App Icon',400,240,[1,2]);stack('App Icon - App Store',1280,768,[1]);
const shelfSet=(name,w,h)=>{const d=path.join(BA,name+'.imageset');const imgs=[1,2].map(sc=>{const fn=`shelf-${w}@${sc}x.png`;jobs.push({file:path.join(d,fn),w:w*sc,h:h*sc,s:shelf(w*sc,h*sc)});return {filename:fn,idiom:'tv',scale:`${sc}x`}});J(path.join(d,'Contents.json'),{images:imgs,info:{author:'xcode',version:1}})};
shelfSet('Top Shelf Image',1920,720);shelfSet('Top Shelf Image Wide',2320,720);
J(path.join(BA,'Contents.json'),{assets:[{filename:'App Icon - App Store.imagestack',idiom:'tv',role:'primary-app-icon',size:'1280x768'},{filename:'App Icon.imagestack',idiom:'tv',role:'primary-app-icon',size:'400x240'},{filename:'Top Shelf Image Wide.imageset',idiom:'tv',role:'top-shelf-image-wide',size:'2320x720'},{filename:'Top Shelf Image.imageset',idiom:'tv',role:'top-shelf-image',size:'1920x720'}],info:{author:'xcode',version:1}});
// Top shelf text uses the site faces; falls back to Helvetica/Menlo offline.
const FONTS='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,900&family=IBM+Plex+Mono:wght@400&display=block">';
(async()=>{const b=await chromium.launch();const p=await b.newPage();
  for(const j of jobs){await p.setViewportSize({width:j.w,height:j.h});await p.setContent(`<html><head>${FONTS}</head><body style="margin:0;background:transparent">${j.s}</body></html>`,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
    fs.mkdirSync(path.dirname(j.file),{recursive:true});
    const opaque=!/mac-|front@|middle@/.test(j.file); // App Store / tvOS back layers must be opaque
    await p.screenshot({path:j.file,omitBackground:!opaque,clip:{x:0,y:0,width:j.w,height:j.h}})}
  await b.close();console.log(jobs.length+' images')})();
