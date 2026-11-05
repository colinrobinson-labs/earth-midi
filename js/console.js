/* Earth MIDI · Console: the whole desk on one screen, built for touch.
   All 13 layers as channel strips (level fader with a live meter, reverb send, mute, solo), the key Sound controls,
   the Pulse groove and the Master section, side by side. Every fader follows its own finger, so you can ride several
   at once on an iPad. Faders write the same settings the Producer panel does (same CFG keys, same afterCFG path),
   so presets, sharing, saving and MIDI learn all keep working. The layout (section order, hidden sections, hidden
   or reordered channels, fader size) is saved in this browser. */
"use strict";
const CONSOLE=(()=>{
const LS="em5.console",SEEN="em5.console.seen";
const SECS={ch:{n:"Channels",s:"level · send · mute · solo",c:"var(--o)",i:"mixer"},sound:{n:"Sound",s:"key · scale · harmony",c:"var(--c)",i:"note"},pulse:{n:"Pulse",s:"genre · groove · feel",c:"var(--q)",i:"rhythm"},master:{n:"Master",s:"space · tone · volume",c:"var(--s)",i:"master"}};
const DEFL={order:["ch","sound","pulse","master"],hide:[],chOrder:[...PAN_KEYS],chHide:[],size:"auto"};
const TINY={q:"Quakes",s:"Solar",o:"Swell",x:"X-rays",w:"Jet",t:"Tides",c:"Chord",r:"Drums",i:"ISS",e:"Fires",g:"Magneto",a:"Air",u:"Sunrise"};
const SCALE_L=[["auto","Auto"],["majpent","Maj pent"],["minpent","Min pent"],["ionian","Major"],["aeolian","Minor"],["dorian","Dorian"],["lydian","Lydian"],["mixo","Mixo"],["phrygian","Phryg"],["harmmin","Harm min"],["blues","Blues"],["hirajoshi","Hirajoshi"],["insen","In-sen"],["pelog","Pelog"],["wholetone","Whole"],["chromatic","Chrom"]];
const SCALE_F={majpent:"major pentatonic",minpent:"minor pentatonic",ionian:"major",aeolian:"minor",dorian:"dorian",lydian:"lydian",mixo:"mixolydian",phrygian:"phrygian",harmmin:"harmonic minor",blues:"blues",hirajoshi:"hirajoshi",insen:"in-sen",pelog:"pelog",wholetone:"whole tone",chromatic:"chromatic"};
const PROG_L=[["classic","I–vi–IV–V"],["minor","Minor turn"],["modal","Modal"],["rising","Rising"],["drone","Drone"],["kp","Follows Kp"]];
const ROOM_L=[["hall","Hall"],["plate","Plate"],["room","Room"],["cathedral","Cathedral"],["cave","Cave"],["space","Deep space"]];
const DT_L=[["0.25","1/8"],["0.375","1/8 dot"],["0.5","1/4"],["0.75","1/4 dot"]];
const SIZE={compact:[120,110],roomy:[380,210]};

const css=`
html.cns-on,html.cns-on body{overflow:hidden!important;overscroll-behavior:none}
.cns{position:fixed;inset:0;z-index:78;display:flex;flex-direction:column;background:radial-gradient(120% 60% at 50% -10%,#0d1620,#05070a 60%);color:var(--fg);
 padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);
 -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;--fh:240px;--mh:150px;animation:cnsIn .35s cubic-bezier(.2,.8,.2,1)}
.cns[hidden]{display:none}
@keyframes cnsIn{from{opacity:0;transform:scale(.985)}}
.cns button{touch-action:manipulation;font-family:var(--mono)}
.cns .sic{width:18px;height:18px}
/* top bar */
.cns-top{flex:none;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);background:rgba(5,7,10,.7);position:relative}
.cns-top::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,var(--q),var(--s),var(--k),var(--o),var(--x),var(--c));opacity:.7}
.cns-top h2{margin:0 6px 0 2px;font:800 17px var(--disp);letter-spacing:-.01em;white-space:nowrap}
.cns-top h2 small{display:block;font:500 9.5px var(--mono);color:var(--mute);letter-spacing:.06em;text-transform:uppercase}
.cns-play{width:52px;height:44px;flex:none;border-radius:12px;display:grid;place-items:center;background:#e6edf3;color:#05070a;border:0;padding:0}
.cns-play i{width:0;height:0;border-left:15px solid currentColor;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:4px}
.cns-play.on{background:var(--k);box-shadow:0 0 22px color-mix(in srgb,var(--k) 55%,transparent)}
.cns-play.on i{width:14px;height:14px;border:0;background:currentColor;border-radius:2px;margin:0}
.cns-seg{display:flex;border:1px solid var(--line2);border-radius:12px;overflow:hidden;flex:none}
.cns-seg button{height:42px;padding:0 13px;border:0;border-radius:0;background:#0a0f15;color:var(--mute);font:600 12px var(--mono)}
.cns-seg button[aria-pressed="true"]{background:var(--fg);color:#05070a}
.cns-rd{display:flex;gap:6px;align-items:center;min-width:0;overflow:hidden;font:600 11px var(--mono)}
.cns-rd span{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line2);border-radius:999px;padding:5px 10px;background:#0a0f15;white-space:nowrap}
.cns-rd b{font-variant-numeric:tabular-nums;min-width:4ch;text-align:right;color:var(--q)}
.cns-sp{flex:1}
.cns-tb{height:42px;display:inline-flex;align-items:center;gap:7px;padding:0 12px;border-radius:12px;background:#0a0f15;color:var(--fg);border:1px solid var(--line2);font:600 12px var(--mono);flex:none}
.cns-tb[aria-pressed="true"]{border-color:var(--k);color:var(--k);background:color-mix(in srgb,var(--k) 10%,#0a0f15)}
.cns-tb.x{width:44px;padding:0;justify-content:center}
/* layout tray (edit mode) */
.cns-tray{display:none;flex:none;gap:10px 18px;flex-wrap:wrap;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--k) 5%,#070b10);font:11.5px var(--mono);color:var(--mute)}
.cns.edit .cns-tray{display:flex}
.cns-tray>div{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cns-tray em{font-style:normal;color:var(--fg);font-weight:600}
.cns-tray button{height:36px;padding:0 11px;border-radius:10px;background:#0a0f15;color:var(--fg);border:1px solid var(--line2);font:600 11px var(--mono)}
.cns-tray button[aria-pressed="true"]{background:var(--k);color:#05070a;border-color:var(--k)}
.cns-tray .rest{border-style:dashed;color:var(--mute)}
.cns-tray .rest::before{content:"+ "}
/* body: sections flow, Channels takes a full row */
.cns-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-wrap:wrap;align-content:flex-start;gap:10px;padding:10px 12px 14px}
.cx{--ac:var(--fg);position:relative;flex:1 1 0;min-width:min(280px,100%);border:1px solid color-mix(in srgb,var(--ac) 18%,var(--line));border-radius:16px;padding:10px 12px 12px;background:radial-gradient(90% 60% at 0% 0%,color-mix(in srgb,var(--ac) 9%,transparent),transparent 70%),#0a0f15;overflow:hidden}
.cx::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--ac),transparent 75%);opacity:.8}
.cx.ch{flex-basis:100%}
.cx.master{flex-grow:1.5;min-width:min(350px,100%)}
.cx.pulse.dim .cx-h small{display:none}
.cx-h{display:flex;align-items:center;gap:9px;margin:0 0 8px;font:700 12px var(--disp);letter-spacing:.08em;text-transform:uppercase}
.cx-h small{font:500 10.5px var(--mono);letter-spacing:0;text-transform:none;color:var(--mute)}
.cx-ed{display:none;margin-left:auto;gap:4px}
.cns.edit .cx-ed{display:flex}
.cx-ed button,.cs-ed button{width:38px;height:34px;padding:0;display:grid;place-items:center;border-radius:9px;background:#0d141b;color:var(--fg);border:1px solid var(--line2);font:700 14px var(--mono)}
.cx-ed button:disabled,.cs-ed button:disabled{opacity:.3}
.cns.edit .cx{outline:1px dashed color-mix(in srgb,var(--k) 45%,transparent);outline-offset:-5px}
/* faders */
.cf{--p:0;--a:0;--b:0;--lv:0;--pk:0;position:relative;touch-action:none;cursor:grab;outline:none;-webkit-tap-highlight-color:transparent}
.cf:focus-visible .cf-tr{box-shadow:0 0 0 2px var(--ac)}
.cf-tr{position:relative;border-radius:10px;background:#0d141b;border:1px solid var(--line2);overflow:visible}
.cf.v .cf-tr{width:100%;height:var(--fh)}
.cf.v .cf-tr::before{content:"";position:absolute;left:50%;top:10px;bottom:10px;width:4px;margin-left:-2px;border-radius:4px;background:#05070a;box-shadow:inset 0 0 0 1px #1c2833}
.cf-fl{position:absolute;border-radius:4px;background:linear-gradient(0deg,color-mix(in srgb,var(--ac) 35%,transparent),var(--ac));box-shadow:0 0 12px color-mix(in srgb,var(--ac) 45%,transparent)}
.cf.v .cf-fl{left:50%;width:4px;margin-left:-2px;bottom:calc(10px + var(--a)*(100% - 20px));height:calc((var(--b) - var(--a))*(100% - 20px))}
.cf-cap{position:absolute;display:block;border-radius:7px;background:linear-gradient(#f4f8fb,#c6d0da);border:1px solid #05070a;box-shadow:0 3px 10px rgba(0,0,0,.6),0 0 0 2px color-mix(in srgb,var(--ac) 55%,transparent);transition:box-shadow .15s,transform .1s}
.cf-cap::after{content:"";position:absolute;left:18%;right:18%;top:50%;height:2px;margin-top:-1px;background:var(--ac);border-radius:2px}
.cf.v .cf-cap{left:4px;right:4px;height:30px;bottom:calc(10px + var(--p)*(100% - 20px));transform:translateY(50%)}
.cf.on .cf-cap{box-shadow:0 3px 14px rgba(0,0,0,.6),0 0 0 3px var(--ac),0 0 22px var(--ac)}
.cf.v.on .cf-cap{transform:translateY(50%) scale(1.06)}
.cf-mt{position:absolute;left:5px;width:5px;bottom:10px;top:10px;border-radius:3px;background:#101820;overflow:hidden}
.cf-mt::after{content:"";position:absolute;left:0;right:0;bottom:0;height:100%;transform-origin:bottom;transform:scaleY(var(--lv));background:linear-gradient(0deg,var(--ac) 0%,var(--ac) 70%,#fff 100%);box-shadow:0 0 8px var(--ac)}
.cf-pk{position:absolute;left:4px;width:7px;height:2px;border-radius:1px;background:#fff;bottom:calc(10px + var(--pk)*(100% - 20px));opacity:calc(var(--pk)*4)}
.cf.v .cf-mt+.cf-pk+.cf-cap{left:14px}
.cf.h .cf-tr{height:var(--hh,40px);width:100%}
.cf.h .cf-tr::before{content:"";position:absolute;top:50%;left:10px;right:10px;height:4px;margin-top:-2px;border-radius:4px;background:#05070a;box-shadow:inset 0 0 0 1px #1c2833}
.cf.h .cf-fl{top:50%;height:4px;margin-top:-2px;left:calc(10px + var(--a)*(100% - 20px));width:calc((var(--b) - var(--a))*(100% - 20px))}
.cf.h .cf-cap{top:4px;bottom:4px;width:22px;left:calc(10px + var(--p)*(100% - 20px));transform:translateX(-50%)}
.cf.h .cf-cap::after{left:50%;right:auto;top:20%;bottom:20%;width:2px;height:auto;margin:0 0 0 -1px}
.cf.h.mini{--hh:30px}.cf.h.mini .cf-cap{width:16px;border-radius:5px}
.cf.auto .cf-cap{background:linear-gradient(#d9dce6,#9aa5b1);box-shadow:0 3px 10px rgba(0,0,0,.6),0 0 0 2px #d9dce6}
.cf.auto .cf-fl{background:#d9dce6;box-shadow:0 0 12px #d9dce6aa}
/* channel strips */
.strips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;-webkit-overflow-scrolling:touch}
.cs{--lv:0;flex:1 0 62px;min-width:62px;max-width:150px;display:flex;flex-direction:column;gap:6px;padding:8px 6px 6px;border-radius:12px;position:relative;
 border:1px solid color-mix(in srgb,var(--c) calc(16% + var(--lv)*55%),var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--c) calc(6% + var(--lv)*14%),#0a0f15),#080c11 55%);box-shadow:0 0 calc(var(--lv)*22px) color-mix(in srgb,var(--c) 28%,transparent);transition:opacity .2s}
.cs::before{content:"";position:absolute;left:8px;right:8px;top:0;height:3px;border-radius:0 0 3px 3px;background:var(--c);box-shadow:0 0 calc(4px + var(--lv)*16px) var(--c)}
.cs.off{opacity:.45}
.cs.solo{border-color:var(--s);box-shadow:0 0 0 1px var(--s) inset,0 0 18px color-mix(in srgb,var(--s) 30%,transparent)}
.cs-h{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-height:42px}
.cs-ic{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#070b10);border:1px solid color-mix(in srgb,var(--c) 32%,transparent);transform:scale(calc(1 + var(--lv)*.12))}
.cs-ic .sic{width:15px;height:15px}
.cs-h b{font:700 10.5px var(--mono);line-height:1.1;letter-spacing:.01em;word-break:break-word}
.cs-snd{display:flex;flex-direction:column;gap:1px}
.cs-snd small{font:600 8.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);text-align:center}
.cs-v{font:700 12px var(--mono);text-align:center;color:var(--c);font-variant-numeric:tabular-nums;min-height:1.2em}
.cs-ms{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.cs-ms button{height:44px;padding:0;border-radius:9px;background:#0d141b;border:1px solid var(--line2);color:var(--mute);font:800 13px var(--mono)}
.cs-ms button[data-cm][aria-pressed="true"]{background:#ff5a3c;border-color:#ff5a3c;color:#05070a;box-shadow:0 0 12px #ff5a3c88}
.cs-ms button[data-cs][aria-pressed="true"]{background:var(--s);border-color:var(--s);color:#05070a;box-shadow:0 0 12px color-mix(in srgb,var(--s) 55%,transparent)}
.cs-ed{display:none;justify-content:space-between;gap:3px}
.cs-ed button{width:auto;flex:1;height:32px;font-size:13px}
.cns.edit .cs-ed{display:flex}
/* chips, piano, rows */
.cg{margin:8px 0 0}
.cg>label,.cg>.lb{display:flex;justify-content:space-between;gap:8px;font:600 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 5px}
.cg>.lb output{color:var(--ac);text-transform:none;letter-spacing:0;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chips.scroll{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px;-webkit-overflow-scrolling:touch}
.chips button{min-height:38px;padding:0 11px;border-radius:10px;background:#0d141b;color:var(--mute);border:1px solid var(--line2);font:600 11.5px var(--mono);white-space:nowrap;flex:none}
.chips button[aria-pressed="true"]{color:#05070a;background:var(--fc,var(--ac));border-color:var(--fc,var(--ac));box-shadow:0 0 14px color-mix(in srgb,var(--fc,var(--ac)) 40%,transparent)}
.chips.gen button{border-color:color-mix(in srgb,var(--fc) 35%,var(--line2));color:color-mix(in srgb,var(--fc) 55%,var(--fg))}
.chips.gen button[aria-pressed="true"]{color:#05070a}
.cpiano{position:relative;display:grid;grid-template-columns:repeat(7,1fr);height:76px}
.cpiano button{padding:0 0 6px;border-radius:0 0 9px 9px;font:700 11px var(--mono);display:flex;align-items:flex-end;justify-content:center}
.cpiano .w{background:linear-gradient(#cfd8e2,#eef3f7);color:#3a4652;border:1px solid #05070a;height:76px}
.cpiano .b{position:absolute;top:0;height:46px;width:calc(100%/7*.62);background:linear-gradient(#1b2530,#0b1016);color:#7d8b99;border:1px solid #05070a;z-index:2;font-size:9.5px;padding-bottom:4px}
.cpiano .w.sc{background:linear-gradient(color-mix(in srgb,var(--ac) 32%,#cfd8e2),#eef3f7)}
.cpiano .b.sc{background:linear-gradient(color-mix(in srgb,var(--ac) 55%,#1b2530),#0b1016);color:#fff}
.cpiano button[aria-pressed="true"]{background:var(--ac)!important;color:#05070a!important;box-shadow:0 0 18px var(--ac)}
.hrow{display:grid;grid-template-columns:minmax(84px,auto) minmax(0,1fr) 52px;gap:8px;align-items:center;margin:6px 0}
.hrow span{font:600 11px var(--mono);color:#c9d4de;white-space:nowrap}
.hrow output{font:700 11.5px var(--mono);color:var(--ac);text-align:right;font-variant-numeric:tabular-nums}
.stp2{display:inline-flex;align-items:center;gap:4px}
.stp2 button{width:44px;height:38px;padding:0;border-radius:10px;background:#0d141b;color:var(--fg);border:1px solid var(--line2);font:700 16px var(--mono)}
.stp2 b{min-width:3ch;text-align:center;font:700 14px var(--mono);color:var(--ac)}
.pbig{display:flex;gap:10px;align-items:stretch;margin-bottom:8px}
.pbig .bpm{display:flex;flex-direction:column;justify-content:center}
.krow{display:flex;gap:8px;align-items:stretch}.krow .cpiano{flex:1;min-width:0}
.octv{flex:none;width:52px;display:flex;flex-direction:column;align-items:stretch;gap:2px;text-align:center}
.octv button{flex:1;min-height:0;padding:0;border-radius:9px;background:#0d141b;color:var(--fg);border:1px solid var(--line2);font:700 16px var(--mono)}
.octv b{font:700 13px/1 var(--mono);color:var(--ac)}.octv small{font:600 8.5px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.pbig .bpm{flex:none;padding:6px 12px;border-radius:12px;background:#070b10;border:1px solid color-mix(in srgb,var(--ac) 25%,var(--line))}
.pbig .bpm b{display:block;font:700 30px/1 var(--mono);color:var(--ac);font-variant-numeric:tabular-nums;text-shadow:0 0 16px color-mix(in srgb,var(--ac) 50%,transparent)}
.pbig .bpm small{font:600 9.5px var(--mono);letter-spacing:.1em;color:var(--mute)}
.pbig .pr{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.pbig .grd{min-width:0;padding:6px 8px;border-radius:12px;background:#070b10;border:1px solid var(--line)}
.pbig .grd svg{display:block;width:100%;height:auto}
.pbig .grd .gn{display:flex;justify-content:space-between;font:10px var(--mono);color:var(--mute);margin-top:3px}
.cx.pulse.dim .pbody{opacity:.55}
.pnote{font:11px var(--mono);color:var(--mute);margin:4px 0 0}
.cx-h .pgo{margin-left:auto;height:30px;padding:0 10px;border-radius:9px;background:var(--q);color:#05070a;border:0;font:700 11px var(--mono);letter-spacing:0;text-transform:none}
.cns.edit .cx-h .pgo{display:none}
.pnote button{min-height:32px;padding:0 10px;border-radius:9px;margin-left:6px;background:var(--q);color:#05070a;border:0;font:700 11px var(--mono)}
/* master */
.mfs{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch}
.mf{flex:1 0 54px;min-width:54px;display:flex;flex-direction:column;gap:5px;align-items:stretch;text-align:center}
.mf>span{font:700 10px var(--mono);letter-spacing:.04em;color:#c9d4de;white-space:nowrap}
.mf output{font:700 11px var(--mono);color:var(--ac);font-variant-numeric:tabular-nums;min-height:1.2em}
.mf .cf.v .cf-tr{height:var(--mh)}
.mf.vol{flex:1.4 0 74px;--ac:#f4f8fb}
.mf.vol>span{color:#fff}
.mf .moon{height:30px;padding:0;border-radius:8px;background:#0d141b;border:1px solid var(--line2);color:var(--mute);font:700 10px var(--mono)}
.mf .moon[aria-pressed="true"]{background:#d9dce6;color:#05070a;border-color:#d9dce6}
.mrow{display:flex;gap:10px 16px;flex-wrap:wrap}
.mrow .cg{flex:1 1 170px;min-width:0}
/* entry points */
#bCon{position:relative}
#bCon.nudge::after{content:"";position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:var(--k);box-shadow:0 0 10px var(--k);animation:bl 1.2s infinite}
.pro h2 .cns-go{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:10px;font:600 12px var(--mono);letter-spacing:0;text-transform:none;background:#0a0f15;border:1px solid color-mix(in srgb,var(--k) 45%,var(--line2));color:var(--fg)}
.pro h2 .cns-go:hover{border-color:var(--k)}
.pro h2 .cns-go .sic{width:16px;height:16px;color:var(--k)}
/* tight: when the desk would overflow, chip rows scroll sideways and everything packs closer so the faders keep their throw */
.cns.tight .cx{padding:8px 10px 10px}.cns.tight .cx-h{margin-bottom:4px}
.cns.tight .cg{margin-top:5px}.cns.tight .cg>.lb{margin-bottom:3px}
.cns.tight .chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.cns.tight .chips::-webkit-scrollbar{display:none}
.cns.tight .chips button{min-height:36px}
.cns.tight .cpiano,.cns.tight .cpiano .w{height:64px}.cns.tight .cpiano .b{height:38px}
.cns.tight .hrow{margin:2px 0}.cns.tight .hrow .cf{--hh:32px}
.cns.tight .pbig .grd svg{height:40px;aspect-ratio:auto!important}.cns.tight .pbig .grd .gn{display:none}.cns.tight .pbig .bpm{padding:4px 10px}
.cns.tight .pbig .bpm b{font-size:24px}
.cns.tight .mfs{gap:5px}.cns.tight .mf{flex-basis:40px;min-width:40px}.cns.tight .mf.vol{flex-basis:54px;min-width:54px}.cns.tight .mf>span{font-size:9.5px;letter-spacing:0}
.cns.tight .cs{gap:4px;padding-top:6px}.cns.tight .cs-h{min-height:36px}.cns.tight .cs-ms button{height:40px}
@media (max-width:900px){.cs{flex-basis:54px;min-width:54px;padding-left:4px;padding-right:4px}.cs-ms{grid-template-columns:1fr}.cs-ms button,.cns.tight .cs-ms button{height:36px}.cs-h b{font-size:9.5px}}
@media (max-width:820px){.cns-top h2 small,.cns-rd .rk{display:none}.cns-tb .lbl{display:none}.cns-tb{width:44px;padding:0;justify-content:center}}
@media (max-width:560px){.cns-top{flex-wrap:wrap}.cns-rd{order:9;flex-basis:100%}.cns-top h2{display:none}.cs{flex-basis:58px;min-width:58px}}
@media (prefers-reduced-motion:reduce){.cns,#bCon.nudge::after{animation:none}}
`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

/* ---------- layout, saved per browser ---------- */
let L=load();
function load(){const d=clone(DEFL);try{const j=JSON.parse(localStorage.getItem(LS)||"null");if(!j)return d;
  const keep=(a,all)=>Array.isArray(a)?[...new Set(a.filter(x=>all.includes(x)))]:[];
  d.order=keep(j.order,DEFL.order);DEFL.order.forEach(k=>{if(!d.order.includes(k))d.order.push(k)});
  d.hide=keep(j.hide,DEFL.order);d.chOrder=keep(j.chOrder,PAN_KEYS);PAN_KEYS.forEach(k=>{if(!d.chOrder.includes(k))d.chOrder.push(k)});
  d.chHide=keep(j.chHide,PAN_KEYS);if(["auto","compact","roomy"].includes(j.size))d.size=j.size}catch(_){}return d}
function save(){try{localStorage.setItem(LS,JSON.stringify(L))}catch(_){}}

/* ---------- helpers ---------- */
const ic=k=>STUDIO.ic(k),svg=b=>`<svg class="sic" viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
const pct=v=>Math.round(v*100)+"%",db=v=>(v>0?"+":"")+(+v).toFixed(1),hz=v=>v>=1000?(v/1000).toFixed(v>=10000?0:1)+"k":String(Math.round(v)),sgn=v=>(v>0?"+":"")+v;
const moonRev=()=>{try{return +map(moon(Date.now()).illum,0,1,.38,.85).toFixed(2)}catch(_){return .6}};
const FD={};
function fd(k,o){FD[k]=Object.assign({k,step:.01},o);
  return `<div class="cf ${o.h?"h":"v"}${o.cls?" "+o.cls:""}" data-f="${k}" role="slider" tabindex="0" aria-label="${o.aria||o.lab}" aria-orientation="${o.h?"horizontal":"vertical"}" aria-valuemin="${o.min}" aria-valuemax="${o.max}"><div class="cf-tr"><i class="cf-fl"></i>${o.meter?'<i class="cf-mt"></i><i class="cf-pk"></i>':""}<i class="cf-cap"></i></div></div>`}
const getV=d=>d.k==="_vol"?+(($("vol")||{}).value??.8):d.k==="rev"?(+CFG.rev<0?moonRev():+CFG.rev):+getP(CFG,d.k);
const toP=(d,v)=>d.log?Math.log(Math.max(v,d.min)/d.min)/Math.log(d.max/d.min):(v-d.min)/(d.max-d.min);
const fromP=(d,p)=>{p=clamp(p,0,1);let v=d.log?d.min*Math.pow(d.max/d.min,p):d.min+p*(d.max-d.min);v=Math.round(v/d.step)*d.step;return +clamp(v,d.min,d.max).toFixed(4)};
function paint(d,v){if(!d.el)return;const p=clamp(toP(d,v),0,1),z=d.bi?clamp(toP(d,0),0,1):0,s=d.el.style;
  s.setProperty("--p",p.toFixed(4));s.setProperty("--a",Math.min(p,z).toFixed(4));s.setProperty("--b",Math.max(p,z).toFixed(4));
  const t=d.fmt?d.fmt(v):String(v);d.el.setAttribute("aria-valuenow",v);d.el.setAttribute("aria-valuetext",t);if(d.out&&d.out.textContent!==t)d.out.textContent=t;d.v=v;
  if(d.k==="rev")d.el.classList.toggle("auto",+CFG.rev<0)}
function setV(d,v){
  if(d.k==="_vol"){const el=$("vol");if(el){el.value=v;el.dispatchEvent(new Event("input"))}}
  else{setP(CFG,d.k,v);if(d.k==="bpmMin"&&+CFG.bpmMax<v)CFG.bpmMax=v;if(d.k==="bpmMax"&&+CFG.bpmMin>v)CFG.bpmMin=v;
    const el=$("p_"+d.k.replace(".","_"));if(el&&el.type==="range"){el.value=v;const o=$(el.id+"_o");if(o)o.textContent=v}afterCFG(true);dirty=true}
  paint(d,v)}
const defOf=d=>d.k==="_vol"?.8:d.k==="rev"?-1:+getP(DEF,d.k);
function reset(d){const v=defOf(d);if(d.k==="rev"){CFG.rev=-1;afterCFG(true);dirty=true;paint(d,getV(d))}else setV(d,v)}

/* ---------- sections ---------- */
function head(id){const extra=id==="pulse"?`<button type="button" class="pgo" id="cnPNote" data-style="pulse" hidden title="The groove rests in Ambient">Switch to Pulse</button>`:"";const m=SECS[id],i=L.order.filter(k=>!L.hide.includes(k)).indexOf(id),n=L.order.filter(k=>!L.hide.includes(k)).length;
  return `<header class="cx-h"><span class="gi">${ic(m.i)}</span>${m.n}<small>${m.s}</small>${extra}<span class="cx-ed"><button data-smv="-1" data-sec="${id}" aria-label="Move ${m.n} earlier"${i<=0?" disabled":""}>↑</button><button data-smv="1" data-sec="${id}" aria-label="Move ${m.n} later"${i>=n-1?" disabled":""}>↓</button><button data-shide="${id}" aria-label="Hide ${m.n}">${eye}</button></span></header>`}
const eye=svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>');
function secCh(){const ks=L.chOrder.filter(k=>!L.chHide.includes(k));
  return `<section class="cx ch" style="--ac:var(--o)">${head("ch")}<div class="strips">${ks.map((k,i)=>{const col=COLS[k],nm=LNAME[k];
    return `<div class="cs" data-k="${k}" style="--c:${col};--ac:${col}" title="${nm}">
     <div class="cs-ed"><button data-cmv="-1" data-ck="${k}" aria-label="Move ${nm} left"${i===0?" disabled":""}>‹</button><button data-chide="${k}" aria-label="Hide ${nm}">${eye}</button><button data-cmv="1" data-ck="${k}" aria-label="Move ${nm} right"${i===ks.length-1?" disabled":""}>›</button></div>
     <div class="cs-h"><span class="cs-ic">${svg(STUDIO.LIC[k]||"")}</span><b>${TINY[k]||nm}</b></div>
     <div class="cs-snd"><small>verb</small>${fd("send."+k,{lab:"Send",min:0,max:1,step:.01,h:1,cls:"mini",fmt:pct,aria:nm+" reverb send"})}</div>
     ${fd("vol."+k,{lab:"Level",min:0,max:1.5,step:.01,meter:1,fmt:v=>String(Math.round(v*100)),aria:nm+" level"})}
     <output class="cs-v" data-o="vol.${k}"></output>
     <div class="cs-ms"><button data-cm="${k}" aria-pressed="${!!S.mute[k]}" aria-label="Mute ${nm}">M</button><button data-cs="${k}" aria-pressed="${S.solo===k}" aria-label="Solo ${nm}">S</button></div></div>`}).join("")||`<p class="pnote">Every channel is hidden. Open Layout to bring some back.</p>`}</div></section>`}
const chips=(k,list,cls="")=>`<div class="chips ${cls}" data-c="${k}" role="group">${list.map(([v,n])=>`<button type="button" data-v="${v}" aria-pressed="false">${n}</button>`).join("")}</div>`;
function hrow(k,lab,o){return `<div class="hrow"><span>${lab}</span>${fd(k,Object.assign({lab,h:1},o))}<output data-o="${k}"></output></div>`}
const vcol=(k,lab,o,extra="")=>`<div class="mf"><span>${lab}</span>${fd(k,Object.assign({lab},o))}<output data-o="${k}"></output>${extra}</div>`;
function secSound(){const W=[0,2,4,5,7,9,11],B={1:0,3:1,6:3,8:4,10:5};
  return `<section class="cx sound" style="--ac:var(--c)">${head("sound")}
   <div class="cg"><div class="lb">Key<output id="cnKey"></output></div><div class="krow"><div class="cpiano" data-c="key" role="group" aria-label="Key">${W.map(n=>`<button type="button" class="w" data-v="${n}" aria-pressed="false">${KEYS[n]}</button>`).join("")}${Object.entries(B).map(([n,wi])=>`<button type="button" class="b" data-v="${n}" aria-pressed="false" style="left:calc(100%/7*${+wi+1} - 100%/7*.31)">${KEYS[n]}</button>`).join("")}</div>
    <span class="octv" role="group" aria-label="Octave"><button type="button" data-oct="1" aria-label="Octave up">+</button><b id="cnOct">0</b><small>oct</small><button type="button" data-oct="-1" aria-label="Octave down">−</button></span></div></div>
   <div class="cg"><div class="lb">Scale</div>${chips("scale",SCALE_L)}</div>
   <div class="cg"><div class="lb">Pad progression</div>${chips("prog",PROG_L)}</div></section>`}
function secPulse(){const fams=GENRES.map(([fam,Lg])=>{const c=(STUDIO.FAM[fam]||{}).c||"#fff";return Lg.map(([id,n])=>[id,n,c])}).flat();
  return `<section class="cx pulse" style="--ac:var(--q)">${head("pulse")}<div class="pbody">
   <div class="pbig"><div class="bpm"><b id="cnBpm">–</b><small>BPM</small></div><div class="pr"><div class="grd"><div id="cnGrid"></div><div class="gn"><span id="cnGName"></span><span id="cnGState"></span></div></div>
    <div class="chips scroll gen" data-c="genre" role="group" aria-label="Genre">${fams.map(([id,n,c])=>`<button type="button" data-v="${id}" aria-pressed="false" style="--fc:${c}">${n}</button>`).join("")}</div></div></div>
   <div class="mfs">${vcol("swing","Swing",{min:0,max:.5,step:.01,fmt:pct})}${vcol("humanize","Human",{min:0,max:1,step:.05,fmt:pct,aria:"Humanize"})}${vcol("hats","Hats ×",{min:0,max:2,step:.1,fmt:v=>v.toFixed(1),aria:"Hi-hat density"})}${vcol("duck","Duck",{min:0,max:.9,step:.05,fmt:pct,aria:"Sidechain duck"})}${vcol("bpmLock","Lock",{min:0,max:180,step:1,fmt:v=>v>0?String(v):"off",aria:"Lock tempo"})}</div></div></section>`}
function secMaster(){const col=(k,lab,o,extra)=>vcol(k,lab,Object.assign({aria:"Master "+lab},o),extra);
  return `<section class="cx master" style="--ac:var(--s)">${head("master")}<div class="mfs">
   ${col("rev","Reverb",{min:0,max:1,step:.01,fmt:pct},`<button type="button" class="moon" id="cnMoon" aria-pressed="false" title="Let the moon's illumination set the reverb level">Moon</button>`)}
   ${col("dfb","Delay",{min:0,max:.85,step:.01,fmt:pct})}
   ${col("drive","Tape",{min:0,max:1,step:.05,fmt:pct})}
   ${col("lowEq","Low",{min:-12,max:12,step:.5,bi:1,fmt:db})}
   ${col("highEq","Air",{min:-12,max:12,step:.5,bi:1,fmt:db})}
   ${col("hpf","HPF",{min:20,max:400,step:1,log:1,fmt:hz})}
   ${col("mlp","LPF",{min:300,max:20000,step:50,log:1,fmt:hz})}
   <div class="mf vol"><span>VOLUME</span>${fd("_vol",{lab:"Volume",min:0,max:1,step:.01,fmt:pct,aria:"Master volume"})}<output data-o="_vol"></output></div></div>
   <div class="mrow"><div class="cg"><div class="lb">Reverb room</div>${chips("revType",ROOM_L)}</div><div class="cg"><div class="lb">Delay time</div>${chips("dtime",DT_L)}</div></div></section>`}
const SEC={ch:secCh,sound:secSound,pulse:secPulse,master:secMaster};

/* ---------- build ---------- */
let root=null,body=null,open_=false,dirty=false;
function build(){Object.keys(FD).forEach(k=>delete FD[k]);
  const fsOK=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
  const hidden=L.hide.map(k=>`<button type="button" class="rest" data-sshow="${k}">${SECS[k].n}</button>`).join("")||"<span>none</span>";
  const hch=L.chHide.map(k=>`<button type="button" class="rest" data-cshow="${k}">${TINY[k]}</button>`).join("")||"<span>none</span>";
  root.innerHTML=`<div class="cns-top">
    <button type="button" class="cns-play${S.on?" on":""}" id="cnPlay" aria-label="Play or stop"><i></i></button>
    <div class="cns-seg" role="group" aria-label="Style"><button type="button" data-style="ambient" aria-pressed="${S.style==="ambient"}">Ambient</button><button type="button" data-style="pulse" aria-pressed="${S.style==="pulse"}">Pulse</button></div>
    <h2>Console<small>13 layers · touch mix</small></h2>
    <div class="cns-rd" id="cnRd" aria-live="off"></div><span class="cns-sp"></span>
    <button type="button" class="cns-tb" id="cnEdit" aria-pressed="false" title="Rearrange or hide sections and channels">${ic("presets")}<span class="lbl">Layout</span></button>
    ${fsOK?`<button type="button" class="cns-tb" id="cnFs" title="Full screen">${svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}<span class="lbl">Full screen</span></button>`:""}
    <button type="button" class="cns-tb x" id="cnX" aria-label="Close console" title="Close (Esc)">${ic("x")}</button></div>
   <div class="cns-tray"><div><em>Hidden sections</em>${hidden}</div><div><em>Hidden channels</em>${hch}</div>
    <div><em>Fader size</em>${["compact","auto","roomy"].map(s=>`<button type="button" data-size="${s}" aria-pressed="${L.size===s}">${s==="auto"?"Fit screen":s[0].toUpperCase()+s.slice(1)}</button>`).join("")}</div>
    <div><button type="button" id="cnReset">Reset layout</button><button type="button" id="cnDone" aria-pressed="true">Done</button></div></div>
   <div class="cns-body" id="cnBody">${L.order.filter(k=>!L.hide.includes(k)).map(k=>SEC[k]()).join("")||`<p class="pnote" style="padding:20px">Every section is hidden. Tap a section under Hidden sections to bring it back.</p>`}</div>`;
  body=$("cnBody");
  root.querySelectorAll(".cf").forEach(el=>{const d=FD[el.dataset.f];if(!d)return;d.el=el;d.out=root.querySelector(`output[data-o="${CSS.escape(d.k)}"]`);paint(d,getV(d))});
  if(editing)root.classList.add("edit");$("cnEdit").setAttribute("aria-pressed",editing);
  syncAll(true);fit()}
let editing=false;
/* fader height: fill the screen so the whole desk fits without scrolling when it can */
function fit(){if(!root||root.hidden)return;
  const s=SIZE[L.size];if(s){root.style.setProperty("--fh",s[0]+"px");root.style.setProperty("--mh",s[1]+"px");root.classList.remove("tight");if(body&&body.scrollHeight>body.clientHeight+2)root.classList.add("tight");return}
  const base=200,mh=Math.round(clamp(innerHeight*(innerHeight>innerWidth?.1:innerHeight<800?.13:.15),96,190));root.style.setProperty("--fh",base+"px");root.style.setProperty("--mh",mh+"px");
  if(!body)return;root.classList.remove("tight");if(body.scrollHeight>body.clientHeight+2)root.classList.add("tight");
  if(!body.querySelector(".cx.ch"))return;
  const spare=body.clientHeight-body.scrollHeight;root.style.setProperty("--fh",Math.round(clamp(base+spare-2,130,560))+"px")}

/* ---------- live: meters, readouts, external changes ---------- */
const lv={},pk={};let t0=0,t1=0;
function syncAll(force){
  Object.values(FD).forEach(d=>{if(d.el&&!d.drag){const v=getV(d);if(force||v!==d.v)paint(d,v)}});
  root.querySelectorAll("[data-c]").forEach(g=>{const k=g.dataset.c,cur=k==="genre"?(S.style==="pulse"?CFG.genre:""):String(getP(CFG,k));
    g.querySelectorAll("button").forEach(b=>{const on=b.dataset.v===cur;if(b.getAttribute("aria-pressed")!==String(on)){b.setAttribute("aria-pressed",on);
      if(on&&g.scrollWidth>g.clientWidth){const l=b.offsetLeft-g.offsetLeft;if(l<g.scrollLeft||l+b.offsetWidth>g.scrollLeft+g.clientWidth)g.scrollLeft=l-g.clientWidth/2+b.offsetWidth/2}}})});
  const k=+CFG.key,sc=typeof scaleFor==="function"?scaleFor(S.cur.kp||2):[0,2,4,7,9],set=new Set(sc.map(x=>(x+k)%12));
  root.querySelectorAll(".cpiano button").forEach(b=>b.classList.toggle("sc",set.has(+b.dataset.v)));
  const kn=$("cnKey");if(kn)kn.textContent=`${KEYS[k]} ${scName()} · ${sc.length} notes`;
  const o=$("cnOct");if(o)o.textContent=sgn(+CFG.oct);
  const mn=$("cnMoon");if(mn)mn.setAttribute("aria-pressed",+CFG.rev<0);
  const pl=$("cnPlay");if(pl){pl.classList.toggle("on",!!S.on)}
  const pn=$("cnPNote");if(pn)pn.hidden=S.style==="pulse";const px=root.querySelector(".cx.pulse");if(px)px.classList.toggle("dim",S.style!=="pulse");
  const gg=$("cnGrid");if(gg&&gg._p!==CFG.pattern){gg._p=CFG.pattern;gg.innerHTML=STUDIO.grid(CFG.pattern,1);const gn=$("cnGName");if(gn)gn.textContent=(GROOVES[CFG.pattern]||{}).n||""}
  root.querySelectorAll(".cs").forEach(s=>{const k=s.dataset.k;s.classList.toggle("off",muted(k));s.classList.toggle("solo",S.solo===k);
    const m=s.querySelector("[data-cm]"),so=s.querySelector("[data-cs]");if(m)m.setAttribute("aria-pressed",!!S.mute[k]);if(so)so.setAttribute("aria-pressed",S.solo===k)})}
const scName=()=>CFG.scale==="auto"?kpScaleName(S.cur.kp||2)+" (auto)":SCALE_F[CFG.scale]||CFG.scale;
const curBpm=()=>+CFG.bpmLock>0?+CFG.bpmLock:(S.on&&S.style==="pulse"&&S.bpm)?S.bpm:(TEMPO.bpm||(+CFG.bpmMin+ +CFG.bpmMax)/2);
function loop(now){if(!open_)return;requestAnimationFrame(loop);if(document.hidden||now-t0<33)return;t0=now;const live=S.on;
  root.querySelectorAll(".cs").forEach(s=>{const k=s.dataset.k,h=live&&!muted(k)?Math.min(1,S.hit[k]||0):0,o=lv[k]||0,v=o+(h-o)*(h>o?.6:.14);lv[k]=v;pk[k]=Math.max(v,(pk[k]||0)-.01);
    s.style.setProperty("--lv",v.toFixed(3));const f=s.querySelector(".cf.v");if(f){f.style.setProperty("--lv",v.toFixed(3));f.style.setProperty("--pk",pk[k].toFixed(3))}});
  const gg=$("cnGrid");if(gg){const ph=gg.querySelector(".ph"),pulse=S.style==="pulse",bpm=curBpm();let step;
    if(live&&pulse&&typeof A!=="undefined"&&A&&S.bpm){const stp=60/S.bpm/4,ahead=Math.max(0,Math.ceil((seq.next-A.ctx.currentTime)/stp));step=((seq.step-ahead)%16+16)%16}else step=Math.floor(now/1000*bpm/15)%16;
    if(ph){ph.setAttribute("x",step*4);ph.style.opacity=live&&pulse?.3:.12}}
  if(now-t1<200)return;t1=now;syncAll(false);
  const b=$("cnBpm"),pulse=S.style==="pulse",bpm=curBpm();if(b)b.textContent=bpm.toFixed(1);
  const gs=$("cnGState");if(gs)gs.textContent=live&&pulse?"live":pulse?"press play":"resting";
  const rd=$("cnRd");if(rd){const g=GENRE_BY[CFG.genre],h=`<span class="rk">${KEYS[CFG.key]} ${scName()}</span>${pulse?`<span><b>${bpm.toFixed(1)}</b> BPM</span>${g?`<span class="rk">${g.name}</span>`:""}`:""}<span>${PAN_KEYS.filter(k=>!muted(k)).length}/13 on</span>`;if(rd._h!==h){rd.innerHTML=h;rd._h=h}}}

/* ---------- input ---------- */
const drags=new Map();
function bind(){
  root.addEventListener("pointerdown",e=>{const el=e.target.closest(".cf");if(!el||editing)return;const d=FD[el.dataset.f];if(!d)return;e.preventDefault();
    try{el.setPointerCapture(e.pointerId)}catch(_){}
    const r=el.querySelector(".cf-tr").getBoundingClientRect(),len=Math.max(1,(d.h?r.width:r.height)-20),pos=d.h?(e.clientX-r.left-10)/len:1-(e.clientY-r.top-10)/len;
    const cur=clamp(toP(d,getV(d)),0,1),near=Math.abs(pos-cur)*len<24,now=performance.now();
    if(now-(d.lt||0)<330&&Math.abs(pos-(d.lpos??-9))*len<30){d.lt=0;reset(d);if(d.k!=="_vol")AUD.pick(d.k);return}d.lt=now;d.lpos=pos;
    drags.set(e.pointerId,{d,el,len,x:e.clientX,y:e.clientY,p0:near?cur:clamp(pos,0,1)});d.drag=true;el.classList.add("on");
    if(!near)setV(d,fromP(d,pos));
    if(typeof LEARN!=="undefined"&&LEARN.on&&d.k!=="_vol"){LEARN.armed=d.k;xs(`Move a knob to map it to “${d.k}”`)}});
  root.addEventListener("pointermove",e=>{const g=drags.get(e.pointerId);if(!g)return;const dp=g.d.h?(e.clientX-g.x)/g.len:-(e.clientY-g.y)/g.len;const v=fromP(g.d,g.p0+dp);if(v!==g.d.v)setV(g.d,v)});
  const end=e=>{const g=drags.get(e.pointerId);if(!g)return;drags.delete(e.pointerId);g.d.drag=false;g.el.classList.remove("on");if(/^(snd\.|oct$|chordEvery$)/.test(g.d.k))AUD.pick(g.d.k)};
  ["pointerup","pointercancel","lostpointercapture"].forEach(t=>root.addEventListener(t,end));
  root.addEventListener("keydown",e=>{const el=e.target.closest&&e.target.closest(".cf");if(!el)return;const d=FD[el.dataset.f];if(!d)return;
    const m={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10}[e.key];
    if(m){e.preventDefault();e.stopPropagation();const p=toP(d,getV(d))+m*(e.shiftKey?.1:.02);setV(d,fromP(d,p))}else if(e.key==="Home"||e.key==="End"){e.preventDefault();setV(d,e.key==="Home"?d.min:d.max)}});
  root.addEventListener("wheel",e=>{const el=e.target.closest(".cf");if(!el||editing)return;const d=FD[el.dataset.f];if(!d)return;e.preventDefault();const dl=(Math.abs(e.deltaY)>Math.abs(e.deltaX)?-e.deltaY:e.deltaX)/600;setV(d,fromP(d,toP(d,getV(d))+dl))},{passive:false});
  root.addEventListener("contextmenu",e=>{if(e.target.closest(".cf,.cs-ms"))e.preventDefault()});
  root.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const ds=b.dataset;
    if(b.id==="cnPlay"){startStop();setTimeout(()=>syncAll(false),60);return}
    if(b.id==="cnX"){close();return}
    if(b.id==="cnEdit"||b.id==="cnDone"){editing=!editing;if(b.id==="cnDone")editing=false;root.classList.toggle("edit",editing);$("cnEdit").setAttribute("aria-pressed",editing);fit();return}
    if(b.id==="cnFs"){toggleFs();return}
    if(b.id==="cnReset"){L=clone(DEFL);save();build();return}
    if(b.id==="cnMoon"){CFG.rev=+CFG.rev<0?moonRev():-1;afterCFG(true);dirty=true;syncAll(true);return}
    if(ds.style){setStyle(ds.style);syncAll(false);return}
    if(ds.cm){toggleMute(ds.cm);syncAll(false);return}
    if(ds.cs){toggleSolo(ds.cs);syncAll(false);return}
    if(ds.oct){CFG.oct=clamp(+CFG.oct+ +ds.oct,-2,2);afterCFG(true);dirty=true;AUD.pick("oct");syncAll(false);return}
    if(ds.smv){const i=L.order.indexOf(ds.sec),vis=L.order.filter(k=>!L.hide.includes(k)),j=vis.indexOf(ds.sec)+ +ds.smv;if(j<0||j>=vis.length)return;const o=L.order.indexOf(vis[j]);[L.order[i],L.order[o]]=[L.order[o],L.order[i]];save();build();return}
    if(ds.shide){L.hide.push(ds.shide);save();build();return}
    if(ds.sshow){L.hide=L.hide.filter(k=>k!==ds.sshow);save();build();return}
    if(ds.cmv){const vis=L.chOrder.filter(k=>!L.chHide.includes(k)),j=vis.indexOf(ds.ck)+ +ds.cmv;if(j<0||j>=vis.length)return;const a=L.chOrder.indexOf(ds.ck),o=L.chOrder.indexOf(vis[j]);[L.chOrder[a],L.chOrder[o]]=[L.chOrder[o],L.chOrder[a]];save();build();return}
    if(ds.chide){L.chHide.push(ds.chide);save();build();return}
    if(ds.cshow){L.chHide=L.chHide.filter(k=>k!==ds.cshow);save();build();return}
    if(ds.size){L.size=ds.size;save();root.querySelectorAll("[data-size]").forEach(x=>x.setAttribute("aria-pressed",x===b));fit();return}
    const g=b.closest("[data-c]");if(g&&ds.v!=null){const k=g.dataset.c;
      if(k==="genre"){if(typeof STUDIO.setLast==="function")STUDIO.setLast(null);applyGenre(ds.v);AUD.pick("genre");syncAll(true);return}
      setP(CFG,k,k==="key"?+ds.v:ds.v);afterCFG(true);dirty=true;AUD.pick(k);syncAll(false)}});
}
function toggleFs(){const fe=document.fullscreenElement||document.webkitFullscreenElement;
  try{if(fe)(document.exitFullscreen||document.webkitExitFullscreen).call(document);else{const r=root.requestFullscreen||root.webkitRequestFullscreen;const p=r&&r.call(root);if(p&&p.catch)p.catch(()=>{})}}catch(_){}}

/* MIDI learn: a mapped knob moves a console fader when the Producer panel isn't showing that control */
function cc(k,f){const d=FD[k];if(!open_||!d)return false;setV(d,fromP(d,f));return true}

/* ---------- open / close ---------- */
function open(){if(!root){root=document.createElement("div");root.className="cns";root.id="console";root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Console");root.hidden=true;document.body.appendChild(root);bind()}
  editing=false;root.classList.remove("edit");root.hidden=false;open_=true;document.documentElement.classList.add("cns-on");build();
  try{localStorage.setItem(SEEN,"1")}catch(_){}document.querySelectorAll("#bCon").forEach(b=>{b.classList.remove("nudge");b.setAttribute("aria-expanded","true")});
  try{if(location.hash!=="#console")history.replaceState(null,"","#console")}catch(_){}
  requestAnimationFrame(loop);setTimeout(fit,60);const pl=$("cnPlay");pl&&pl.focus({preventScroll:true})}
function close(){if(!root||root.hidden)return;open_=false;root.hidden=true;document.documentElement.classList.remove("cns-on");drags.clear();
  if(document.fullscreenElement||document.webkitFullscreenElement)toggleFs();
  document.querySelectorAll("#bCon").forEach(b=>b.setAttribute("aria-expanded","false"));
  try{if(location.hash==="#console")history.replaceState(null,"",location.pathname+location.search)}catch(_){}
  if(dirty){dirty=false;const p=$("pro");if(p&&!p.hidden&&typeof buildPro==="function")buildPro()}}
addEventListener("keydown",e=>{if(e.key==="Escape"&&open_&&!(document.fullscreenElement||document.webkitFullscreenElement)){e.preventDefault();close()}});
addEventListener("resize",()=>{if(open_){clearTimeout(fit._t);fit._t=setTimeout(fit,120)}});
addEventListener("hashchange",()=>{if(location.hash==="#console")open()});

/* entry points: bar button, a button in the Producer header, #console. Tablets get a one-time dot on the button */
const bc=$("bCon");if(bc)bc.onclick=()=>open_?close():open();
const ph=document.querySelector("#pro h2");if(ph){const b=document.createElement("button");b.type="button";b.className="cns-go";b.innerHTML=`${ic("mixer")}Console`;b.title="Open the full-screen mixing console";b.onclick=open;ph.insertBefore(b,$("pstat"))}
const tablet=matchMedia("(pointer:coarse)").matches&&Math.min(screen.width,screen.height)>=700;
let seen=false;try{seen=!!localStorage.getItem(SEEN)}catch(_){}
if(bc&&tablet&&!seen){bc.classList.add("nudge");bc.title="New: a full-screen mixing console made for touch"}
if(location.hash==="#console")setTimeout(open,350);

return {open,close,cc,get isOpen(){return open_}};
})();
