// Site icons from the Earth MIDI "Breach" mark (scripts/breach-mark.js; same file as apps/apple/scripts/breach-mark.js).
// Run from the repo root: node scripts/make-site-icons.js   (needs playwright). Writes icon.svg and apple-touch-icon.png.
const fs=require('fs');const M=require('./breach-mark.js');
// Favicon: 64 grid, rounded tile, no glow or grain, heavier strokes so it survives 16 px.
const fav=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${M.bgDefs('f',false)}</defs>${M.bg('f',0,0,64,64,14,false)}${M.ring(32,32,20.5,1.45)}${M.trace(32,32,20.5,1.45)}</svg>\n`;
fs.writeFileSync('icon.svg',fav);
const s=180,R=s*300/1024;
const touch=`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><defs>${M.bgDefs('t',true)}${M.glowDef('t',R)}</defs>${M.bg('t',0,0,s,s,0,true)}${M.mark('t',s/2,s/2,R)}</svg>`;
(async()=>{const {chromium}=require('playwright');const b=await chromium.launch();const p=await b.newPage({viewport:{width:s,height:s}});
  await p.setContent(`<html><body style="margin:0">${touch}</body></html>`);await p.screenshot({path:'apple-touch-icon.png',clip:{x:0,y:0,width:s,height:s}});
  await b.close();console.log('icon.svg + apple-touch-icon.png')})();
