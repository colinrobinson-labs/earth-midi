// Renders every app icon / top shelf image from the site's icon design (icon.svg) with headless Chromium.
// Run from the repo root: node apps/apple/scripts/make-icons.js   (needs playwright; output is committed)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const A=path.join(__dirname,'..');
const GRAD=`<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc53d"/><stop offset=".35" stop-color="#7cff9e"/><stop offset=".65" stop-color="#3cc8ff"/><stop offset="1" stop-color="#c77dff"/></linearGradient>`;
const BG=`<radialGradient id="b" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#121820"/><stop offset="1" stop-color="#05070a"/></radialGradient>`;
const mark=(s=1,tx=0,ty=0)=>`<g transform="translate(${tx} ${ty}) scale(${s})"><circle cx="32" cy="32" r="20" fill="none" stroke="url(#g)" stroke-width="5"/><path d="M14 36c6-6 10 6 16 0s10-12 20-2" fill="none" stroke="#ff5a3c" stroke-width="4" stroke-linecap="round"/></g>`;
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${GRAD}${BG}</defs>${body}</svg>`;
// iOS: full-bleed square, the system rounds the corners
const ios=s=>svg(s,s,`<rect width="${s}" height="${s}" fill="url(#b)"/>${mark(s/64*1.08,-s*0.04,-s*0.04)}`);
// macOS: rounded tile inset on a transparent canvas (Apple's 824/1024 grid)
const mac=s=>{const i=s*100/1024,w=s-2*i;return svg(s,s,`<rect x="${i}" y="${i}" width="${w}" height="${w}" rx="${w*.225}" fill="url(#b)"/><rect x="${i}" y="${i}" width="${w}" height="${w}" rx="${w*.225}" fill="none" stroke="#ffffff14" stroke-width="${s/256}"/>${mark(w/64*.9,i+w*.05,i+w*.05)}`)};
// tvOS layered icon: back plate, ring, wave (parallax)
const tvBack=(w,h)=>svg(w,h,`<rect width="${w}" height="${h}" fill="url(#b)"/>`+[...Array(7)].map((_,k)=>`<line x1="0" x2="${w}" y1="${h*(k+1)/8}" y2="${h*(k+1)/8}" stroke="#ffffff08" stroke-width="${h/200}"/>`).join(''));
const tvRing=(w,h)=>{const r=h*.36;return svg(w,h,`<circle cx="${w/2}" cy="${h/2}" r="${r}" fill="none" stroke="url(#g)" stroke-width="${h*.09}"/>`)};
const tvWave=(w,h)=>{const s=h/64*1.1;return svg(w,h,`<g transform="translate(${w/2-32*s} ${h/2-32*s}) scale(${s})"><path d="M14 36c6-6 10 6 16 0s10-12 20-2" fill="none" stroke="#ff5a3c" stroke-width="4" stroke-linecap="round"/></g>`)};
const shelf=(w,h)=>svg(w,h,`<rect width="${w}" height="${h}" fill="url(#b)"/>${mark(h/64*.55,w*.08,h*.225)}<text x="${w*.08+h*.66}" y="${h*.56}" font-family="Helvetica Neue,Arial" font-weight="700" font-size="${h*.15}" fill="#e8ecf2" letter-spacing="${h*.01}">EARTH MIDI</text><text x="${w*.08+h*.66}" y="${h*.68}" font-family="Menlo,monospace" font-size="${h*.045}" fill="#8a96a3" letter-spacing="${h*.006}">THE PLANET, PLAYED LIVE</text>`);
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
(async()=>{const b=await chromium.launch();const p=await b.newPage();
  for(const j of jobs){await p.setViewportSize({width:j.w,height:j.h});await p.setContent(`<html><body style="margin:0;background:transparent">${j.s}</body></html>`);
    fs.mkdirSync(path.dirname(j.file),{recursive:true});
    const opaque=!/mac-|front@|middle@/.test(j.file); // App Store / tvOS back layers must be opaque
    await p.screenshot({path:j.file,omitBackground:!opaque,clip:{x:0,y:0,width:j.w,height:j.h}})}
  await b.close();console.log(jobs.length+' images')})();
