// Earth MIDI "Breach" mark: the planet's ring in the six layer colours, broken top and bottom
// where a quake-red seismogram spikes through it. All geometry is relative to (cx, cy, R);
// R = 300 on a 1024 canvas is the reference size.
const TAU=Math.PI*2,D=Math.PI/180;
const C={q:'#ff5a3c',s:'#ffc53d',k:'#7cff9e',o:'#3cc8ff',x:'#c77dff',c:'#ff8fd1'};
const RING=[C.q,C.s,C.k,C.o,C.x,C.c];
const f=n=>Math.round(n*100)/100;
const P=(cx,cy,r,a)=>[f(cx+r*Math.cos(a)),f(cy+r*Math.sin(a))];
const arc=(cx,cy,r,a0,a1)=>{const[x0,y0]=P(cx,cy,r,a0),[x1,y1]=P(cx,cy,r,a1);return `M${x0} ${y0}A${f(r)} ${f(r)} 0 ${(a1-a0)>Math.PI?1:0} 1 ${x1} ${y1}`};
const AMP=[0,.03,-.05,.08,-.14,.3,-.62,1.22,-1.08,.7,-.42,.24,-.13,.07,-.03,0];
function ring(cx,cy,R,w=1){const g=11*D;let s='';
  [[-Math.PI/2+g,Math.PI/2-g,0],[Math.PI/2+g,Math.PI*1.5-g,3]].forEach(([a0,a1,o])=>{const st=(a1-a0)/3;
    for(let i=0;i<3;i++)s+=`<path d="${arc(cx,cy,R,a0+i*st,a0+(i+1)*st+(i<2?.01:0))}" fill="none" stroke="${RING[o+i]}" stroke-width="${f(.1*R*w)}"/>`});
  return s}
function trace(cx,cy,R,w=1){const pts=[[cx-1.42*R,cy],[cx-.95*R,cy]];
  AMP.forEach((v,i)=>pts.push([cx-.95*R+1.9*R*(i+.5)/AMP.length,cy-v*R]));
  pts.push([cx+.95*R,cy],[cx+1.42*R,cy]);
  return `<path d="${pts.map((p,i)=>(i?'L':'M')+f(p[0])+' '+f(p[1])).join('')}" fill="none" stroke="${C.q}" stroke-width="${f(.065*R*w)}" stroke-linejoin="round" stroke-linecap="round"/>`}
// Background: graphite radial (the site's panel tone) + optional film grain.
const bgDefs=(id,grain)=>`<radialGradient id="${id}b" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#141b23"/><stop offset="1" stop-color="#05070a"/></radialGradient>`+
  (grain?`<filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`:'');
const bg=(id,x,y,w,h,rx=0,grain=true)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${id}b)"/>`+(grain?`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" filter="url(#${id}n)" opacity=".07"/>`:'');
const glowDef=(id,R)=>`<filter id="${id}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(.06*R)}"/></filter>`;
const glow=(id,body)=>`<g filter="url(#${id}g)" opacity=".55">${body}</g>`;
// Whole mark with glow
function mark(id,cx,cy,R,{glow:g=true,w=1}={}){const body=ring(cx,cy,R,w)+trace(cx,cy,R,w);return (g?glow(id,body):'')+body}
module.exports={C,RING,ring,trace,bgDefs,bg,glowDef,glow,mark};
