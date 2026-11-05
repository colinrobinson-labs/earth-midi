/* Earth MIDI · Producer studio: the look of the Producer panel.
   Every visual here is drawn from the real settings: the step grids are the actual 16-step grooves the Pulse engine plays,
   the BPM bars are each genre's real tempo range, the tempo icon is the live measurement that drives it, the mix bars on a
   preset are its real layer levels, and the meters ride the live mix (S.hit). Native inputs stay underneath every custom
   control (chips, piano keys, channel steppers), so MIDI learn, saving and sharing work exactly as before. */
"use strict";
const STUDIO=(()=>{
const css=`
.pro{position:relative;overflow:hidden}
.pro::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--q),var(--s),var(--k),var(--o),var(--x),var(--c));opacity:.8}
.pro:not([hidden]){animation:stIn .5s cubic-bezier(.2,.8,.2,1)}
@keyframes stIn{from{opacity:0;transform:translateY(-8px)}}
.sic{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.sic .f{fill:currentColor;stroke:none}
/* header live strip */
.pro h2{flex-wrap:wrap}
.pstat{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font:600 11px var(--mono);margin-left:auto}
.pstat span{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line2);border-radius:999px;padding:4px 10px;background:#0a0f15;color:var(--fg);white-space:nowrap}
.pstat span i{width:7px;height:7px;border-radius:50%;background:var(--pc,var(--mute));box-shadow:0 0 8px var(--pc,transparent)}
.pstat .ps-bpm b{font-variant-numeric:tabular-nums;min-width:4ch;text-align:right}
.pstat .ps-sty[data-s="pulse"]{--pc:var(--q);border-color:color-mix(in srgb,var(--q) 50%,var(--line2))}
.pstat .ps-sty[data-s="ambient"]{--pc:var(--o);border-color:color-mix(in srgb,var(--o) 50%,var(--line2))}
.pro h2>small{flex-basis:100%;order:3;margin-top:-4px}
/* tabs */
#ptabs{gap:6px;padding:2px 2px 4px}
#ptabs button{--tc:var(--fg);display:inline-flex;align-items:center;gap:8px;padding:8px 14px 8px 10px;border-radius:12px;border:1px solid var(--line2);background:#0a0f15;color:var(--mute);transition:color .2s,border-color .2s,background .2s,box-shadow .25s,transform .1s}
#ptabs button .sic{color:var(--tc);opacity:.75;transition:opacity .2s,transform .3s cubic-bezier(.2,1.6,.4,1)}
#ptabs button span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15}
#ptabs button small{font:500 9.5px var(--mono);color:var(--mute);letter-spacing:.02em;opacity:.8}
#ptabs button:hover{color:var(--fg);border-color:color-mix(in srgb,var(--tc) 45%,var(--line2))}
#ptabs button:hover .sic{opacity:1;transform:scale(1.12) rotate(-6deg)}
#ptabs button[aria-selected="true"]{color:var(--fg);border-color:var(--tc);background:linear-gradient(135deg,color-mix(in srgb,var(--tc) 22%,transparent),color-mix(in srgb,var(--tc) 4%,transparent) 70%),#0b1118;box-shadow:0 0 0 1px color-mix(in srgb,var(--tc) 35%,transparent) inset,0 6px 24px color-mix(in srgb,var(--tc) 22%,transparent)}
#ptabs button[aria-selected="true"] .sic{opacity:1}
#ptabs button[aria-selected="true"] small{color:color-mix(in srgb,var(--tc) 70%,var(--fg))}
/* group cards */
.pro .pgrp{--ac:var(--fg);position:relative;overflow:hidden;border-radius:14px;background:radial-gradient(90% 60% at 0% 0%,color-mix(in srgb,var(--ac) 9%,transparent),transparent 70%),#0a0f15;border-color:color-mix(in srgb,var(--ac) 16%,var(--line))}
.pro .pgrp::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--ac),transparent 75%);opacity:.75}
.pro .pgrp>h5,.psh{display:flex;align-items:center;gap:9px;margin:0 0 8px;font:700 12px var(--disp);letter-spacing:.08em;text-transform:uppercase;color:var(--fg)}
.gi{width:28px;height:28px;flex:none;display:grid;place-items:center;border-radius:9px;color:var(--ac);background:color-mix(in srgb,var(--ac) 12%,#070b10);border:1px solid color-mix(in srgb,var(--ac) 30%,transparent);box-shadow:0 0 14px color-mix(in srgb,var(--ac) 14%,transparent)}
.gi .sic{width:16px;height:16px}
.enter>*{animation:stUp .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*55ms)}
@keyframes stUp{from{opacity:0;transform:translateY(12px) scale(.985)}}
/* sliders */
.pro .pc{margin:9px 0}
.pro .pc label{color:#c9d4de}
.pro .pc output{justify-self:end;min-width:0;padding:1px 8px;border-radius:999px;font:600 11px var(--mono);color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,transparent);border:1px solid color-mix(in srgb,var(--ac) 22%,transparent);font-variant-numeric:tabular-nums}
.pro .pc input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;height:24px;margin:0;cursor:pointer;--p:50%}
.pro .pc input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 45%,#0b1016),var(--ac) var(--p),#18222d var(--p))}
.pro .pc input[type=range]::-moz-range-track{height:6px;border-radius:6px;background:#18222d}
.pro .pc input[type=range]::-moz-range-progress{height:6px;border-radius:6px;background:var(--ac)}
.pro .pc input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-5px;border-radius:50%;background:#f4f8fb;border:3px solid var(--ac);box-shadow:0 0 0 4px color-mix(in srgb,var(--ac) 14%,transparent),0 0 12px color-mix(in srgb,var(--ac) 55%,transparent);transition:transform .15s}
.pro .pc input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#f4f8fb;border:3px solid var(--ac)}
.pro .pc input[type=range]:active::-webkit-slider-thumb{transform:scale(1.25)}
.pro .pc select{-webkit-appearance:none;appearance:none;background:#0d141b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%237d8b99' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 11px center/10px;padding:8px 30px 8px 10px;border-radius:10px;border-color:color-mix(in srgb,var(--ac) 18%,var(--line2))}
.pro .pc select:hover{border-color:color-mix(in srgb,var(--ac) 50%,var(--line2))}
/* toggles */
.pro .pc.ck{grid-template-columns:auto 1fr;gap:10px;align-items:center}
.pro .pc.ck input{-webkit-appearance:none;appearance:none;width:38px;height:22px;margin:0;border-radius:999px;background:#18222d;border:1px solid var(--line2);position:relative;cursor:pointer;transition:background .2s,border-color .2s,box-shadow .2s}
.pro .pc.ck input::before{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#7d8b99;transition:transform .25s cubic-bezier(.2,1.5,.4,1),background .2s}
.pro .pc.ck input:checked{background:color-mix(in srgb,var(--ac) 35%,#0b1016);border-color:var(--ac);box-shadow:0 0 12px color-mix(in srgb,var(--ac) 35%,transparent)}
.pro .pc.ck input:checked::before{transform:translateX(16px);background:#fff}
.pro .pc.ck label{font-size:11.5px;line-height:1.35}
/* chips that stand in for short menus */
.segc{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
.segc button{font:600 11px var(--mono);padding:6px 10px;border-radius:9px;background:#0d141b;color:var(--mute);border-color:var(--line2)}
.segc button:hover{color:var(--fg);border-color:color-mix(in srgb,var(--ac) 55%,var(--line2))}
.segc button[aria-pressed="true"]{color:#05070a;background:var(--ac);border-color:var(--ac);box-shadow:0 0 14px color-mix(in srgb,var(--ac) 40%,transparent)}
.pc.has-seg select{display:none}
.pc .ld{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;background:var(--lc);box-shadow:0 0 8px var(--lc);vertical-align:0}
/* piano key picker + scale map */
.piano{grid-column:1/-1;position:relative;display:grid;grid-template-columns:repeat(7,1fr);height:58px;margin-top:4px;user-select:none}
.piano button{padding:0;border-radius:0 0 7px 7px;font:600 9.5px var(--mono);display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;transition:background .15s,box-shadow .2s,color .15s}
.piano .w{background:linear-gradient(#cfd8e2,#eef3f7);color:#3a4652;border:1px solid #05070a;height:58px}
.piano .b{position:absolute;top:0;height:34px;width:calc(100%/7*.62);background:linear-gradient(#1b2530,#0b1016);color:#7d8b99;border:1px solid #05070a;z-index:2;font-size:8px;padding-bottom:3px}
.piano .w.sc{background:linear-gradient(color-mix(in srgb,var(--ac) 30%,#cfd8e2),#eef3f7)}
.piano .b.sc{background:linear-gradient(color-mix(in srgb,var(--ac) 55%,#1b2530),#0b1016);color:#fff}
.piano button[aria-pressed="true"]{background:var(--ac)!important;color:#05070a!important;box-shadow:0 0 18px var(--ac),inset 0 -3px 0 rgba(0,0,0,.25)}
.pc.has-piano select{display:none}
.smap{grid-column:1/-1;display:flex;gap:3px;margin-top:6px}
.smap i{flex:1;height:7px;border-radius:3px;background:#18222d;transition:background .3s,box-shadow .3s}
.smap i.on{background:color-mix(in srgb,var(--ac) 70%,transparent)}
.smap i.rt{background:var(--ac);box-shadow:0 0 8px var(--ac)}
.smapl{grid-column:1/-1;font:10.5px var(--mono);color:var(--mute);margin-top:3px}
/* channel steppers */
.pc.chn{grid-template-columns:1fr auto;margin:3px 0;padding:3px 4px 3px 8px;border-radius:9px;background:#0d141b;border:1px solid var(--line)}
.pc.chn input,.pc.chn output{display:none}
.pc.chn label{font-size:11px;display:flex;align-items:center}
.stp{display:inline-flex;align-items:center;gap:2px}
.stp button{width:24px;height:24px;padding:0;border-radius:7px;font:600 13px var(--mono);line-height:1;color:var(--mute);background:transparent;border-color:transparent}
.stp button:hover{color:var(--fg);border-color:var(--line2)}
.stp b{min-width:26px;text-align:center;font:700 12px var(--mono);color:var(--lc);font-variant-numeric:tabular-nums}
/* tempo readout + groove grid (Rhythm) */
.bpmr{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:end;margin:4px 0 6px;padding:10px 12px;border-radius:12px;background:#070b10;border:1px solid color-mix(in srgb,var(--ac) 25%,var(--line))}
.bpmr b{font:700 34px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--ac);text-shadow:0 0 18px color-mix(in srgb,var(--ac) 55%,transparent)}
.bpmr small{font:600 10px var(--mono);letter-spacing:.1em;color:var(--mute);align-self:end;padding-bottom:4px}
.rbar{grid-column:1/-1;position:relative;height:6px;border-radius:6px;background:#18222d;margin:6px 8px 16px}
.rbar i{position:absolute;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 40%,transparent),var(--ac))}
.rbar em{position:absolute;top:-4px;width:3px;height:14px;margin-left:-1.5px;border-radius:2px;background:#fff;box-shadow:0 0 10px #fff;transition:left .4s}
.rbar span{position:absolute;top:9px;font:9.5px var(--mono);color:var(--mute);transform:translateX(-50%)}
.bigg{margin:6px 0 10px;padding:10px 10px 6px;border-radius:12px;background:#070b10;border:1px solid var(--line)}
.bigg svg{display:block;width:100%;height:auto}
.bigg .gl{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:space-between;font:10px var(--mono);color:var(--mute);margin-top:4px}
.bigg .gl b{color:var(--fg);font-weight:600}
/* step grids */
.sg .c{rx:.6}
.sg .ph{fill:#fff;opacity:.16}
.gt .sg .ph,.fam .sg .ph{opacity:0;animation:sgph var(--dur,2s) steps(16) infinite;animation-play-state:paused}
.gt:hover .sg .ph,.gt.sel .sg .ph{opacity:.2;animation-play-state:running}
@keyframes sgph{to{transform:translateX(64px)}}
/* presets */
.psec{--ac:var(--x);grid-column:1/-1;position:relative;border:1px solid color-mix(in srgb,var(--ac) 16%,var(--line));border-radius:14px;padding:12px;background:radial-gradient(70% 50% at 0% 0%,color-mix(in srgb,var(--ac) 8%,transparent),transparent 70%),#0a0f15}
.psh{flex-wrap:wrap;margin-bottom:12px}
.psh small{font:500 11px var(--mono);letter-spacing:0;text-transform:none;color:var(--mute)}
.psh .sp{flex:1}
.ghost{display:inline-flex;align-items:center;gap:6px;font:600 11px var(--mono);padding:6px 10px;border-radius:9px;background:transparent;color:var(--mute)}
.ghost:hover{color:var(--fg)}.ghost .sic{width:14px;height:14px}
.fams{display:grid;grid-template-columns:1fr;gap:8px}
.pro .pgrid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
@media (min-width:900px){.fam{display:grid;grid-template-columns:200px minmax(0,1fr);gap:12px;align-items:center}.fam header{margin:0;flex-direction:column;align-items:flex-start;gap:8px}.gts{grid-template-columns:repeat(5,minmax(0,1fr))}}
.fam{--fc:#fff;position:relative;border-radius:13px;padding:10px;background:linear-gradient(160deg,color-mix(in srgb,var(--fc) 13%,#0b1118),#080c11 65%);border:1px solid color-mix(in srgb,var(--fc) 26%,var(--line));overflow:hidden}
.fam::after{content:"";position:absolute;right:-40px;top:-40px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--fc) 22%,transparent),transparent 70%);pointer-events:none;animation:famGlow 6s ease-in-out infinite;animation-delay:calc(var(--i,0)*-.9s)}
@keyframes famGlow{50%{transform:translate(-14px,10px) scale(1.15);opacity:.6}}
.fam header{display:flex;align-items:center;gap:10px;margin-bottom:9px;position:relative;z-index:1}
.fam header .fg{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;color:var(--fc);background:color-mix(in srgb,var(--fc) 14%,#070b10);border:1px solid color-mix(in srgb,var(--fc) 40%,transparent)}
.fam header .fg .sic{width:20px;height:20px}
.fam header b{font:800 17px var(--disp);letter-spacing:-.01em}
.fam header small{display:block;font:500 10.5px var(--mono);color:var(--mute)}
.gts{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:6px;position:relative;z-index:1}
.gt{display:flex;flex-direction:column;gap:6px;text-align:left;padding:8px 9px 8px;border-radius:11px;background:rgba(5,7,10,.55);border:1px solid color-mix(in srgb,var(--fc) 18%,var(--line2));color:var(--fg);transition:border-color .2s,background .2s,transform .15s,box-shadow .25s}
.gt:hover{border-color:color-mix(in srgb,var(--fc) 70%,transparent);transform:translateY(-2px);box-shadow:0 8px 22px color-mix(in srgb,var(--fc) 18%,transparent)}
.gt-top{display:flex;justify-content:space-between;align-items:baseline;gap:6px}
.gt-top b{font:700 12px var(--mono);line-height:1.2}
.gt-top em{font:600 10px var(--mono);font-style:normal;color:var(--fc);white-space:nowrap;font-variant-numeric:tabular-nums}
.gt .sg{width:100%;height:auto;display:block}
.gt-foot{display:flex;align-items:center;gap:6px;font:10px var(--mono);color:var(--mute)}
.gt-foot .sic{width:13px;height:13px;color:var(--fc)}
.gt-bpm{position:relative;flex:1;height:3px;border-radius:3px;background:#1a2430;margin-left:auto;max-width:56px}
.gt-bpm i{position:absolute;top:0;bottom:0;border-radius:3px;background:var(--fc);min-width:3px}
.gt.sel{background:linear-gradient(150deg,color-mix(in srgb,var(--fc) 30%,#0b1118),color-mix(in srgb,var(--fc) 8%,#070b10));border-color:var(--fc);box-shadow:0 0 0 1px var(--fc) inset,0 0 26px color-mix(in srgb,var(--fc) 35%,transparent)}
.gt .eq{display:none;gap:2px;align-items:flex-end;height:10px}
.gt.sel .eq{display:inline-flex}
.eq i{width:2px;background:var(--fc);border-radius:1px;animation:eq .9s ease-in-out infinite}
.eq i:nth-child(2){animation-delay:-.3s}.eq i:nth-child(3){animation-delay:-.6s}
@keyframes eq{0%,100%{height:3px}50%{height:10px}}
.gnow{margin:10px 2px 0;font:11.5px var(--mono);color:var(--mute);min-height:1.4em}.gnow b{color:var(--fg);font-weight:600}
.fps{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:8px}
.fpw{position:relative;min-width:0}
.fp{--fc:#fff;width:100%;height:100%;display:grid;grid-template-columns:38px 1fr;grid-template-rows:auto auto auto;gap:6px 10px;text-align:left;padding:10px 11px;border-radius:13px;background:linear-gradient(160deg,color-mix(in srgb,var(--fc) 10%,#0b1118),#080c11 70%);border:1px solid color-mix(in srgb,var(--fc) 20%,var(--line2));color:var(--fg);font-family:var(--body);transition:border-color .2s,transform .15s,box-shadow .25s}
.fp:hover{border-color:color-mix(in srgb,var(--fc) 75%,transparent);transform:translateY(-2px);box-shadow:0 10px 26px color-mix(in srgb,var(--fc) 18%,transparent)}
.fp-ic{grid-row:1/3;width:38px;height:38px;display:grid;place-items:center;border-radius:11px;color:var(--fc);background:color-mix(in srgb,var(--fc) 13%,#070b10);border:1px solid color-mix(in srgb,var(--fc) 35%,transparent);transition:transform .35s cubic-bezier(.2,1.6,.4,1)}
.fp:hover .fp-ic{transform:rotate(-8deg) scale(1.08)}
.fp-ic .sic{width:21px;height:21px}
.fp-t b{display:block;font:700 14px var(--disp);letter-spacing:-.005em}
.fp-t small{display:block;font:11.5px/1.35 var(--body);color:var(--mute);margin-top:1px}
.mixb{grid-column:1/-1;display:flex;align-items:flex-end;gap:2px;height:24px;padding:0 1px}
.mixb i{flex:1;height:calc(var(--h)*100%);min-height:2px;border-radius:2px 2px 0 0;background:var(--c);opacity:.85;transform-origin:bottom;transition:transform .3s}
.fp:hover .mixb i{animation:mixb .8s ease-in-out infinite alternate;animation-delay:calc(var(--j)*-70ms)}
@keyframes mixb{to{transform:scaleY(.55)}}
.fp-tags{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap}
.fp-tags em{font:600 9.5px var(--mono);font-style:normal;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:999px;border:1px solid var(--line2);color:var(--mute)}
.fp-tags em.st{color:var(--fc);border-color:color-mix(in srgb,var(--fc) 45%,transparent)}
.fp.sel{border-color:var(--fc);box-shadow:0 0 0 1px var(--fc) inset,0 0 26px color-mix(in srgb,var(--fc) 30%,transparent)}
.fp.flash{animation:fpFlash .7s ease-out}
@keyframes fpFlash{0%{box-shadow:0 0 0 0 var(--fc)}100%{box-shadow:0 0 0 14px transparent}}
.fpdel{position:absolute;top:6px;right:6px;width:26px;height:26px;padding:0;display:grid;place-items:center;border-radius:8px;background:rgba(5,7,10,.7);color:var(--mute);opacity:0;transition:opacity .2s}
.fpw:hover .fpdel,.fpdel:focus-visible{opacity:1}.fpdel:hover{color:var(--q);border-color:var(--q)}.fpdel .sic{width:14px;height:14px}
@media (hover:none){.fpdel{opacity:1}}
.fpempty{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:14px;border:1px dashed var(--line2);border-radius:13px;color:var(--mute);font:12.5px var(--body)}
.fpempty .sic{color:var(--ac)}
.ptools{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.ptools button,.ptools .btnlike{display:inline-flex;align-items:center;gap:8px;font:600 12px var(--mono);padding:9px 13px;border-radius:11px;background:#0d141b}
.ptools button:hover,.ptools .btnlike:hover{border-color:var(--ac)}
.ptools .sic{width:16px;height:16px;color:var(--ac)}
.ptools .pri{background:var(--ac);color:#05070a;border-color:var(--ac)}.ptools .pri .sic{color:#05070a}
#bLearn .lled{width:8px;height:8px;border-radius:50%;background:#3a4652}
#bLearn[aria-pressed="true"]{border-color:var(--k);color:var(--k);background:color-mix(in srgb,var(--k) 10%,#0d141b)}
#bLearn[aria-pressed="true"] .lled{background:var(--k);box-shadow:0 0 10px var(--k);animation:bl 1s infinite}
.lmap{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:8px;font:11px var(--mono);color:var(--mute)}
.lmap em{font-style:normal;padding:2px 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--k) 40%,transparent);color:var(--k)}
/* mixer */
.mixer .strip{--lv:0;position:relative;overflow:hidden;border-top-width:1px;border-color:color-mix(in srgb,var(--c) calc(18% + var(--lv)*60%),var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--c) calc(6% + var(--lv)*16%),#0a0f15),#0a0f15 60%);transition:opacity .25s;box-shadow:0 0 calc(var(--lv)*26px) color-mix(in srgb,var(--c) 30%,transparent)}
.mixer .strip::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--c);box-shadow:0 0 calc(4px + var(--lv)*18px) var(--c)}
.mixer .strip{--ac:var(--c)}
.mixer .strip>b{display:flex;align-items:center;gap:7px;font:700 12px var(--mono);color:var(--fg)}
.mixer .strip>b i{width:9px;height:9px;border-radius:50%;background:var(--c);box-shadow:0 0 calc(4px + var(--lv)*14px) var(--c);transform:scale(calc(1 + var(--lv)*.5))}
.mtr{display:flex;gap:2px;height:8px;margin:8px 0 2px}
.mtr i{flex:1;border-radius:2px;background:#16202a;transition:background .08s}
.mtr i.on{background:var(--c);box-shadow:0 0 6px var(--c)}
.mtr i.pk{background:#fff}
.mixer .strip .ms button{flex:1;font:700 11px var(--mono)}
.mixer .strip .ms button[aria-pressed="true"][data-m]{background:#2a3440;color:var(--fg);border-color:#4a5866}
.mixer .strip.off{opacity:.42}
/* export panel cards */
#exp .pgrp{--ac:var(--fg);position:relative;overflow:hidden;border-radius:14px;background:radial-gradient(90% 60% at 0% 0%,color-mix(in srgb,var(--ac) 9%,transparent),transparent 70%),#0a0f15;border-color:color-mix(in srgb,var(--ac) 18%,var(--line))}
#exp .pgrp::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,var(--ac),transparent 75%)}
#exp .pgrp>h5{display:flex;align-items:center;gap:9px;color:var(--fg);font-size:12px}
#exp .row button,#exp .row .btnlike{display:inline-flex;align-items:center;gap:7px}
#exp .row .sic{width:15px;height:15px;color:var(--ac)}
#exp .row button.primary .sic{color:#05070a}
#exp .row button:hover,#exp .row .btnlike:hover{border-color:var(--ac)}
#exp .rdot{width:9px;height:9px;border-radius:50%;background:#ff2d55;box-shadow:0 0 8px #ff2d55}
.exph{position:relative}
/* DAW + accuracy info cards */
.info>div{position:relative;border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:radial-gradient(80% 60% at 0% 0%,color-mix(in srgb,var(--ac,var(--o)) 8%,transparent),transparent 70%),var(--panel)}
.info h4{display:flex;align-items:center;gap:10px}
.info ul{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}
.info li{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;margin:0}
.info li .gi{width:30px;height:30px;--ac:var(--lc,var(--o))}
.acc{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
.acc span{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border-radius:11px;background:#0a0f15;border:1px solid var(--line);font:11px/1.35 var(--mono);color:var(--mute)}
.acc span b{font:700 15px var(--mono);color:var(--lc,var(--fg))}
@media (max-width:700px){
 #ptabs button{padding:8px 12px 8px 9px}#ptabs button small{display:none}
 .pstat{margin-left:0}
 .gts{grid-template-columns:repeat(2,minmax(0,1fr))}
 .fps{grid-template-columns:1fr}
 .bpmr b{font-size:28px}
 .piano{height:64px}.piano .w{height:64px}.piano .b{height:38px}
}
@media (prefers-reduced-motion:reduce){.pro:not([hidden]),.enter>*,.fam::after,.gt .sg .ph,.eq i,.fp:hover .mixb i,.fp.flash{animation:none!important}}
`;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

/* ---------- icons ---------- */
const svg=(b,cls="sic")=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
const p=d=>`<path d="${d}"/>`,c=(x,y,r,f)=>`<circle cx="${x}" cy="${y}" r="${r}"${f?' class="f"':""}/>`;
const IC={
 sound:p("M2 12h3l2.5-6 3 12 3-14 3 14 2.5-6H22"),
 mixer:p("M6 4v16M12 4v16M18 4v16")+c(6,14,2.3)+c(12,8,2.3)+c(18,16,2.3),
 rhythm:'<rect x="3" y="3" width="7.5" height="7.5" rx="1.6" class="f"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" class="f"/>',
 master:c(12,13,7.5)+p("M12 13l4.2-4.2M12 2.5v2M3.5 7l1.6 1.2M20.5 7l-1.6 1.2M2.5 15h2M19.5 15h2"),
 midi:c(12,12,9)+c(7.2,12,1.2,1)+c(16.8,12,1.2,1)+c(8.6,8.4,1.2,1)+c(15.4,8.4,1.2,1)+c(12,7,1.2,1)+p("M10 18h4"),
 presets:p("M12 3l9 4.6-9 4.6-9-4.6z")+p("M3 12l9 4.6 9-4.6M3 16.4l9 4.6 9-4.6"),
 note:p("M9 17.5V5.5l11-2.5v12")+c(6.5,17.5,2.6)+c(17.5,15,2.6),
 harmony:p("M3 7h18M3 12h18M3 17h18")+c(8,7,2,1)+c(13,12,2,1)+c(17,17,2,1),
 inst:'<rect x="3" y="5" width="18" height="14" rx="2"/>'+p("M8 5v8M12 5v8M16 5v8M8 13v6M12 13v6M16 13v6"),
 quake:p("M2 12h4l2-5 3 10 2.5-14 3 16 2-7h3.5"),
 genre:c(12,12,9)+c(12,12,3)+c(12,12,.6,1)+p("M17 5.5a9 9 0 0 1 2.5 3"),
 groove:p("M4 19v-4M8 19v-9M12 19v-6M16 19V7M20 19v-3"),
 feel:p("M3 16c3-9 6-9 9 0s6 9 9 0"),
 space:p("M9.5 18a2.5 2.5 0 0 1 5 0M6 18a6 6 0 0 1 12 0M2.5 18a9.5 9.5 0 0 1 19 0"),
 tone:p("M3 15c4 0 4-7 9-7s5 7 9 7M3 20h18"),
 sync:c(12,12,9)+p("M12 7v5l3.5 2"),
 chan:p("M4 6h16M4 12h16M4 18h16")+c(9,6,1.8,1)+c(15,12,1.8,1)+c(7,18,1.8,1),
 save:'<rect x="4" y="4" width="16" height="16" rx="3"/>'+p("M12 8.5v7M8.5 12h7"),
 down:p("M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"),
 up:p("M12 15.5V4.5m0 0L7.5 9M12 4.5L16.5 9M5 19.5h14"),
 knob:c(12,12,7)+p("M12 12V6.5M5 19l1.6-1.6M19 19l-1.6-1.6"),
 reset:p("M4.5 12a7.5 7.5 0 1 0 2.3-5.4M4.5 4v4.5H9"),
 x:p("M6 6l12 12M18 6L6 18"),
 file:p("M7 3h7l5 5v13H7z")+p("M14 3v5h5"),
 doc:p("M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4"),
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/>'+p("M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"),
 zip:'<rect x="5" y="3" width="14" height="18" rx="2"/>'+p("M12 3v2M12 7v2M12 11v2")+'<rect x="10.5" y="14" width="3" height="4" rx="1"/>',
 rec:c(12,12,8)+c(12,12,3.5,1),
 apple:p("M15.5 3.5c-1 1-1.6 2.2-1.5 3.5 1.3.1 2.5-.6 3.2-1.7.6-.9.7-1.8.7-1.8s-1.3-.2-2.4 0z")+p("M12 8c-1-.6-2-.9-3.2-.8C6 7.5 4.5 10 4.8 13c.3 3.4 2.4 7 4.3 7 1 0 1.6-.6 2.9-.6s1.9.6 2.9.6c1.9 0 4-3.4 4.3-6.2-2-.9-2.8-2.6-2.6-4.5.1-1.4 1-2.4 1.6-2.9-1.3-1-2.8-1.3-4.2-.9-.8.2-1.5.6-2 1z"),
 win:p("M3 5.5l7.5-1v7H3zM12.5 4.2L21 3v8.5h-8.5zM3 13h7.5v7L3 19zM12.5 13H21v8l-8.5-1.2z"),
 globe:c(12,12,9)+p("M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"),
 bolt:p("M13 2L5 13h6l-1 9 8-11h-6z"),
 sat:p("M13 7l4 4M4 16l4 4M8.5 11.5l4 4M15 3l6 6-3 3-6-6zM6 13l-3 3 5 5 3-3")
};
const ic=(k,cls)=>svg(IC[k]||"",cls);

/* tempo sources */
const SRC_IC={
 sun:c(12,12,4)+p("M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"),
 wind:p("M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"),
 rain:p("M7 14a4 4 0 1 1 1-7.9A5 5 0 0 1 17.6 8 3 3 0 0 1 17 14H7zM8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3"),
 pressure:p("M4 17a8 8 0 1 1 16 0M12 17l4-5M7.5 17h9"),
 storms:p("M7 13a4 4 0 1 1 1-7.9A5 5 0 0 1 17.6 7 3 3 0 0 1 17 13h-1M13 11l-3 5h4l-3 5"),
 quakes:p("M2 12h4l2-5 3 10 2.5-14 3 16 2-7h3.5"),
 tides:p("M2 10c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1M2 15.5c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-1"),
 kp:p("M6 4v8a6 6 0 0 0 12 0V4M6 8h4M14 8h4"),
 jet:p("M2 9c6-4 12 4 20 0M2 15c6-4 12 4 20 0"),
 temp:p("M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0zM12 11v6")};
const SRC_W={sun:"solar wind",wind:"wind",rain:"rain",pressure:"pressure",storms:"storms",quakes:"quake rate",tides:"tide",kp:"Kp",jet:"jet stream",temp:"temperature"};

/* genre families: a colour and a rhythm motif each */
const FAM={
 "House":{c:"#ff9f43",g:c(3.5,13,2.2,1)+c(9.2,13,2.2,1)+c(14.8,13,2.2,1)+c(20.5,13,2.2,1)+p("M2 7h20")},
 "Techno":{c:"#3cc8ff",g:p("M2 16V8h5v8h5V8h5v8h5")},
 "Breaks + UK":{c:"#c77dff",g:p("M2 15l4-7 3 9 5-11 3 8 5-4")},
 "Drum & bass":{c:"#7cff9e",g:p("M2 12c1.4-5 2.8-5 4.2 0s2.8 5 4.2 0 2.8-5 4.2 0 2.8 5 4.2 0 2.1-3.5 3.2-2")},
 "Hip-hop":{c:"#ffc53d",g:p("M5 19V6M10 19v-5M15 19V9M20 19v-3")},
 "Downtempo":{c:"#4dd6c1",g:p("M2 12c5-9 10 9 20 0")},
 "Latin + Caribbean":{c:"#ff6b9a",g:c(3.5,12,2.2,1)+c(11,12,2.2,1)+c(18.5,12,2.2,1)+p("M3.5 17.5h15")}};

/* the factory presets: a glyph and one honest line each (colour comes from the loudest layer in the preset) */
const PRE={
 "Deep ambient":{i:p("M12 20a2 2 0 0 1 0-4M12 20a6 6 0 0 1 0-12M12 20a10 10 0 0 1 0-20")+p("M12 20a2 2 0 0 0 0-4M12 20a6 6 0 0 0 0-12M12 20a10 10 0 0 0 0-20"),d:"Slow cathedral wash. Only quakes above M1.5 ring through."},
 "Seismic techno":{i:IC.quake,d:"Four on the floor at 124–136, marimba quakes locked to the grid."},
 "Broken planet":{i:c(12,12,8.5)+p("M12 3.5l-2 5 3 3-2.5 4 1.5 5"),d:"Broken beat at 84–96 in Phrygian, swung and tape-driven."},
 "Ring of Fire":{i:c(12,12,7.5)+p("M12 1.5c1.2 1.4 1.2 2.6 0 3.8M22.5 12c-1.4 1.2-2.6 1.2-3.8 0M12 22.5c-1.2-1.4-1.2-2.6 0-3.8M1.5 12c1.4-1.2 2.6-1.2 3.8 0"),d:"Pacific Rim quakes from M2.5, struck as gongs in Hirajoshi."},
 "Space weather":{i:SRC_IC.sun,d:"Solar wind, X-rays, the magnetosphere and the ISS up front."},
 "Ocean & tides":{i:SRC_IC.tides,d:"Swell and tide lead in Dorian, with a long tail."},
 "Dawn chorus":{i:p("M3 17h18M7 17a5 5 0 0 1 10 0M12 6v3M5 9.5l2 2M19 9.5l-2 2M5 21h14"),d:"Sunrise and sunset over 42 cities, warm major pentatonic."},
 "Burning world":{i:p("M12 21c-4 0-6.5-2.6-6.5-6 0-3.8 3.5-5.5 3.5-10 2.6 1.4 4.5 4 4.5 6.5.9-.7 1.4-1.9 1.4-3.2 2.3 1.7 3.6 4.3 3.6 6.7 0 3.4-2.5 6-6.5 6z"),d:"Fires, storms and air quality, harmonic minor, saturated."},
 "Orbit":{i:'<ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>'+c(12,12,3)+c(20,8.5,1.6,1),d:"The space station's orbit in whole tone, extra wide."},
 "California":{i:p("M3 6l4 3-2 4 5 2-1 4 4 2M14 3l2 5 4 1-1 5 2 4"),d:"Every California quake, even the tiny ones, as glass."},
 "Japan":{i:p("M2 20l7.5-12 2.5 3 2.5-3L22 20zM7.6 11.2l1.9 1.3 2.5-1.5 2.5 1.5 1.9-1.3"),d:"Japan's quakes from M1 in In-sen, FM bells on a plate."},
 "Lo-fi Earth":{i:'<rect x="2.5" y="5" width="19" height="14" rx="2"/>'+c(8,11,2)+c(16,11,2)+p("M6 19l1.5-3h9l1.5 3M10 11h4"),d:"Locked at 82 BPM, heavy swing, dusty top end."}};

const SCALE_N={auto:"Auto",majpent:"Major pent",minpent:"Minor pent",ionian:"Major",aeolian:"Minor",dorian:"Dorian",lydian:"Lydian",mixo:"Mixolydian",phrygian:"Phrygian",harmmin:"Harmonic minor",blues:"Blues",hirajoshi:"Hirajoshi",insen:"In-sen",pelog:"Pelog",wholetone:"Whole tone",chromatic:"Chromatic"};
const ROOM_N={hall:"Hall",plate:"Plate",room:"Room",cathedral:"Cathedral",cave:"Cave",space:"Deep space"};

/* tabs + groups */
const TAB={Sound:{c:"var(--c)",i:"sound",s:"key · voices"},Mixer:{c:"var(--o)",i:"mixer",s:"13 layers"},Rhythm:{c:"var(--q)",i:"rhythm",s:"genre · groove"},Master:{c:"var(--s)",i:"master",s:"space · tone"},MIDI:{c:"var(--k)",i:"midi",s:"sync · channels"},Presets:{c:"var(--x)",i:"presets",s:"genres · yours"}};
const GRP={"Key + scale":["var(--c)","note"],"Harmony":["var(--x)","harmony"],"Instruments":["var(--o)","inst"],"Earthquakes":["var(--q)","quake"],"Genre":["var(--q)","genre"],"Pulse groove":["var(--s)","groove"],"Feel":["var(--k)","feel"],"Space":["var(--o)","space"],"Tone":["var(--s)","tone"],"Sync + input":["var(--k)","sync"],"Channels":["#9ad1ff","chan"],"Channels 2":["#9ad1ff","chan"]};
const GROW={K:"#ff5a3c",S:"#ffc53d",H:"#3cc8ff",B:"#7cff9e"};
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

/* 16-step grid as SVG: 4 rows (kick, snare, hats, bass) straight from the groove strings */
function grid(gk,big){const G=GROOVES[gk]||GROOVES.four,rows=[["K",G.k],["S",G.s],["H",G.h],["B",G.b]];let r="";
  rows.forEach(([n,str],y)=>{for(let i=0;i<16;i++){const ch=str[i]||".",on=ch!=="."&&ch!==" ",a=on?(ch==="x"?1:ch==="o"||ch==="f"?.8:.5):0;
    r+=on?`<rect class="c" x="${i*4+.5}" y="${y*4+.5}" width="3" height="3" fill="${GROW[n]}" opacity="${a}"/>`:`<rect class="c" x="${i*4+1.6}" y="${y*4+1.6}" width=".8" height=".8" fill="#2a3644"/>`}});
  for(let b=1;b<4;b++)r+=`<rect x="${b*16-.15}" y="0" width=".3" height="16" fill="#22303d"/>`;
  return `<svg class="sg" viewBox="0 0 64 16" preserveAspectRatio="none"${big?' style="aspect-ratio:64/16"':""} aria-hidden="true">${r}<rect class="ph" x="0" y="0" width="4" height="16"/></svg>`}

function tabs(T,cur){return T.map(([n],i)=>{const m=TAB[n]||{};return `<button role="tab" aria-selected="${i===cur}" data-i="${i}" style="--tc:${m.c}">${ic(m.i)}<span>${n}<small>${m.s||""}</small></span></button>`}).join("")}
function group(t,inner,i){const [col,icn]=GRP[t]||["var(--fg)","sound"];return `<div class="pgrp" style="--ac:${col};--i:${i}"><h5><span class="gi">${ic(icn)}</span>${t}</h5>${inner}</div>`}
function mixer(){return PAN_KEYS.map((k,i)=>`<div class="strip" data-k="${k}" style="--c:${COLS[k]};--i:${i}"><b><i></i>${LNAME[k]}</b><span class="mtr">${"<i></i>".repeat(12)}</span>${ctl("vol."+k,"Level","rng",[0,1.5,.05])}${ctl("send."+k,"Reverb send","rng",[0,1,.05])}
  <div class="ms"><button data-m="${k}" aria-pressed="false">Mute</button><button data-s="${k}" aria-pressed="false">Solo</button></div></div>`).join("")}

/* a preset's look, from its real settings */
function presetLook(cfg,style){const vol={...DEF.vol,...(cfg.vol||{})};if(style!=="pulse")vol.r=0;
  let top="c",tv=-1;PAN_KEYS.forEach(k=>{if(k!=="r"&&vol[k]>tv){tv=vol[k];top=k}});
  const bars=PAN_KEYS.map((k,j)=>`<i style="--h:${Math.min(1,(vol[k]||0)/1.5).toFixed(2)};--c:${COLS[k]};--j:${j}" title="${LNAME[k]} ${(+vol[k]||0).toFixed(2)}"></i>`).join("");
  const tags=[`<em class="st">${style==="pulse"?"Pulse":style==="ambient"?"Ambient":"Any style"}</em>`];
  if(cfg.bpmLock>0)tags.push(`<em>${cfg.bpmLock} BPM</em>`);else if(style==="pulse"&&cfg.bpmMin)tags.push(`<em>${cfg.bpmMin}–${cfg.bpmMax} BPM</em>`);
  if(cfg.scale&&cfg.scale!=="auto")tags.push(`<em>${SCALE_N[cfg.scale]||cfg.scale}</em>`);if(cfg.revType)tags.push(`<em>${ROOM_N[cfg.revType]||cfg.revType}</em>`);
  return {col:COLS[top],bars,tags:tags.join("")}}

let lastPre=null;
function presets(){
  const on=id=>CFG.genre===id&&S.style==="pulse";
  const fams=GENRES.map(([fam,L],fi)=>{const f=FAM[fam]||{c:"#fff",g:""},lo=Math.min(...L.map(x=>x[2].lo)),hi=Math.max(...L.map(x=>x[2].hi));
    return `<section class="fam" style="--fc:${f.c};--i:${fi}"><header><span class="fg">${svg(f.g)}</span><span><b>${fam}</b><small>${L.length} style${L.length>1?"s":""} · ${lo}–${hi} BPM</small></span></header><div class="gts">${
      L.map(([id,n,g])=>`<button class="gt${on(id)?" sel":""}" data-genre="${id}" aria-pressed="${on(id)}" title="${esc(g.tip)}" style="--dur:${(16*15/((g.lo+g.hi)/2)).toFixed(2)}s"><span class="gt-top"><b>${n}</b><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span><em>${g.lo}–${g.hi}</em></span>${grid(g.g)}<span class="gt-foot">${svg(SRC_IC[g.src]||"")}${SRC_W[g.src]||g.src}<span class="gt-bpm" aria-hidden="true"><i style="left:${((g.lo-60)/120*100).toFixed(1)}%;width:${((g.hi-g.lo)/120*100).toFixed(1)}%"></i></span></span></button>`).join("")}</div></section>`}).join("");
  const g=GENRE_BY[CFG.genre];
  const fp=Object.entries(PRESETS).map(([n,cfg],i)=>{const L=presetLook(cfg,cfg.style),m=PRE[n]||{i:IC.presets,d:""};
    return `<div class="fpw" style="--i:${i}"><button class="fp${lastPre===n?" sel":""}" data-fp="${esc(n)}" style="--fc:${L.col}"><span class="fp-ic">${svg(m.i)}</span><span class="fp-t"><b>${esc(n)}</b><small>${m.d}</small></span><span class="mixb" aria-hidden="true">${L.bars}</span><span class="fp-tags">${L.tags}</span></button></div>`}).join("");
  const up=Object.keys(UPRE).map((n,i)=>{const u=UPRE[n],L=presetLook(u.cfg||{},u.style);
    return `<div class="fpw" style="--i:${i}"><button class="fp${lastPre===n?" sel":""}" data-up="${esc(n)}" style="--fc:${L.col}"><span class="fp-ic">${ic("presets")}</span><span class="fp-t"><b>${esc(n)}</b><small>${esc(KEYS[u.cfg?.key??DEF.key])} · ${GENRE_BY[u.cfg?.genre]?.name||"custom groove"}</small></span><span class="mixb" aria-hidden="true">${L.bars}</span><span class="fp-tags">${L.tags}</span></button><button class="fpdel" data-del="${esc(n)}" aria-label="Delete ${esc(n)}">${ic("x")}</button></div>`}).join("");
  const lm=Object.entries(LEARN.map);
  return `<div class="psec" style="--ac:var(--q);--i:0"><div class="psh"><span class="gi">${ic("genre")}</span>Genres<small>${GENRES.reduce((a,[,L])=>a+L.length,0)} styles · each sets its groove, tempo range and the live data that moves the tempo · starts Pulse</small></div>
   <div class="fams">${fams}</div><p class="gnow" id="gnow">${g&&S.style==="pulse"?`<b>${g.name}</b> · ${esc(g.tip)}`:"Tap a style. The grid is the real 16-step groove: kick, snare, hats, bass."}</p></div>
  <div class="psec" style="--ac:var(--o);--i:1"><div class="psh"><span class="gi">${ic("presets")}</span>Factory<small>bars show each preset's layer mix</small><span class="sp"></span><button class="ghost" data-reset>${ic("reset")}Reset all</button></div><div class="fps">${fp}</div></div>
  <div class="psec" style="--ac:var(--k);--i:2"><div class="psh"><span class="gi">${ic("save")}</span>Yours<small>saved in this browser · share them with Share</small></div>
   <div class="fps">${up||`<div class="fpempty">${ic("save")}<span>Nothing saved yet. Dial in a sound, then <b>Save current as preset</b> and it lands here with its own mix bars.</span></div>`}</div>
   <div class="ptools"><button id="bUP" class="pri">${ic("save")}Save current as preset</button><button id="bEP">${ic("down")}Export preset file</button><label class="btnlike">${ic("up")}Import preset<input type="file" accept=".json" hidden id="fPre"></label><button id="bLearn" aria-pressed="${LEARN.on}"><span class="lled"></span>${ic("knob")}MIDI learn ${LEARN.on?"on":"off"}</button></div>
   <div class="lmap">${LEARN.on?"Touch any slider, then move a knob on your controller.":"MIDI learn maps your controller's knobs to any slider."} ${lm.length?"Mapped: "+lm.map(([cc,k])=>`<em>CC${cc} → ${esc(k)}</em>`).join(""):"Nothing mapped yet."}</div></div>`}

/* ---------- enhance native controls after a render ---------- */
const setPct=el=>{const a=+el.min,b=+el.max;el.style.setProperty("--p",((+el.value-a)/(b-a||1)*100).toFixed(1)+"%")};
const INST_L={"inst.q":"q","inst.s":"s","inst.c":"c","inst.i":"i","inst.u":"u"};
function enhance(g){
  g.querySelectorAll('input[type=range]').forEach(el=>{setPct(el);el.addEventListener("input",()=>setPct(el))});
  // short menus become chips (the select stays underneath and receives the change)
  g.querySelectorAll('.pc select[data-t="sel"]').forEach(sel=>{const o=[...sel.options],len=o.reduce((a,x)=>a+x.text.length,0),k=sel.dataset.k;
    if(k==="key"||o.length>6||len>64)return;const pc=sel.closest(".pc");pc.classList.add("has-seg");
    const lk=INST_L[k];if(lk){pc.style.setProperty("--ac",COLS[lk]);pc.querySelector("label").insertAdjacentHTML("afterbegin",`<i class="ld" style="--lc:${COLS[lk]}"></i>`)}
    const w=document.createElement("div");w.className="segc";w.setAttribute("role","group");w.setAttribute("aria-label",pc.querySelector("label").textContent);
    w.innerHTML=o.map(x=>`<button type="button" data-v="${esc(x.value)}" aria-pressed="${x.value===sel.value}">${esc(x.text)}</button>`).join("");pc.appendChild(w);
    w.onclick=e=>{const b=e.target.closest("button");if(!b)return;sel.value=b.dataset.v;sel.dispatchEvent(new Event("change"));w.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b))}});
  // key: a one-octave keyboard, scale notes lit
  const ks=g.querySelector("#p_key");if(ks){const pc=ks.closest(".pc");pc.classList.add("has-piano");const W=[0,2,4,5,7,9,11],B={1:0,3:1,6:3,8:4,10:5};
    const pn=document.createElement("div");pn.className="piano";pn.setAttribute("role","group");pn.setAttribute("aria-label","Key");
    pn.innerHTML=W.map(n=>`<button type="button" class="w" data-n="${n}" aria-pressed="false">${KEYS[n]}</button>`).join("")+Object.entries(B).map(([n,wi])=>`<button type="button" class="b" data-n="${n}" aria-pressed="false" style="left:calc(100%/7*${+wi+1} - 100%/7*.31)">${KEYS[n]}</button>`).join("");
    pc.appendChild(pn);pn.onclick=e=>{const b=e.target.closest("button");if(!b)return;ks.value=b.dataset.n;ks.dispatchEvent(new Event("change"));paintKey()};
    const sc=g.querySelector("#p_scale");if(sc){const pc2=sc.closest(".pc");pc2.insertAdjacentHTML("beforeend",`<div class="smap" id="smap">${"<i></i>".repeat(12)}</div><div class="smapl" id="smapl"></div>`);sc.addEventListener("change",paintKey)}
    paintKey()}
  // MIDI channels: compact steppers in each layer's colour
  g.querySelectorAll('input[data-k^="ch."]').forEach(el=>{const pc=el.closest(".pc"),lk=el.dataset.k.slice(3),col=COLS[lk==="b"||lk==="d"?"r":lk]||"#9ad1ff";pc.classList.add("chn");pc.style.setProperty("--lc",col);
    pc.querySelector("label").insertAdjacentHTML("afterbegin",`<i class="ld" style="--lc:${col}"></i>`);
    const s=document.createElement("span");s.className="stp";s.innerHTML=`<button type="button" aria-label="Channel down">−</button><b>${el.value}</b><button type="button" aria-label="Channel up">+</button>`;pc.appendChild(s);
    const [dn,up]=s.querySelectorAll("button"),out=s.querySelector("b");const step=d=>{el.value=clamp(+el.value+d,1,16);out.textContent=el.value;el.dispatchEvent(new Event("input"))};dn.onclick=()=>step(-1);up.onclick=()=>step(1)});
  // Rhythm: big tempo readout + the groove as a step grid
  const tn=g.querySelector("#tempoNow");if(tn)tn.insertAdjacentHTML("beforebegin",`<div class="bpmr"><b id="stBpm">–</b><small>BPM</small><div class="rbar" aria-hidden="true"><i id="stRng"></i><em id="stMk"></em><span style="left:0">60</span><span style="left:50%">120</span><span style="left:100%">180</span></div></div>`);
  const pat=g.querySelector("#p_pattern");if(pat){const pc=pat.closest(".pc");pc.insertAdjacentHTML("afterend",`<div class="bigg" id="bigg"></div>`);const draw=()=>{$("bigg").innerHTML=grid(CFG.pattern,1)+`<div class="gl"><span><b style="color:${GROW.K}">K</b>ick <b style="color:${GROW.S}">S</b>nare <b style="color:${GROW.H}">H</b>ats <b style="color:${GROW.B}">B</b>ass</span><span id="biggS">preview</span></div>`};draw();pat.addEventListener("change",draw)}
}
function paintKey(){const ks=$("p_key");if(!ks)return;const k=+ks.value;document.querySelectorAll(".piano button").forEach(b=>{const n=+b.dataset.n;b.setAttribute("aria-pressed",n===k)});
  const sc=typeof scaleFor==="function"?scaleFor(S.cur.kp||2):SCALES.majpent,set=new Set(sc.map(x=>(x+k)%12));
  document.querySelectorAll(".piano button").forEach(b=>b.classList.toggle("sc",set.has(+b.dataset.n)));
  const m=$("smap");if(m)[...m.children].forEach((i,n)=>{const pc=(k+n)%12;i.className=n===0?"rt":set.has(pc)?"on":""});
  const l=$("smapl");if(l)l.textContent=`${KEYS[k]} ${CFG.scale==="auto"?kpScaleName(S.cur.kp||2)+" (auto, from Kp "+(+(S.cur.kp||2)).toFixed(1)+")":(SCALE_N[CFG.scale]||CFG.scale).toLowerCase()} · ${sc.length} notes`}

/* ---------- live loop: meters, tempo, playheads, header strip ---------- */
const lv={},pk={};let t0=0,t1=0;
function loop(now){requestAnimationFrame(loop);const pro=$("pro");if(!pro||pro.hidden||document.hidden||now-t0<33)return;t0=now;const live=S.on;
  document.querySelectorAll("#pgrid .strip").forEach(s=>{const k=s.dataset.k,h=live&&!muted(k)?Math.min(1,S.hit[k]||0):0,o=lv[k]||0,v=o+(h-o)*(h>o?.6:.14);lv[k]=v;pk[k]=Math.max(v,(pk[k]||0)-.012);
    s.style.setProperty("--lv",v.toFixed(3));s.classList.toggle("off",muted(k));const n=Math.round(v*12),p=Math.min(11,Math.round(pk[k]*12)-1);[...s.querySelector(".mtr").children].forEach((i,j)=>{i.className=j<n?"on":j===p&&p>0?"pk":""})});
  const pulse=S.style==="pulse",bpm=+CFG.bpmLock>0?+CFG.bpmLock:(live&&pulse&&S.bpm)?S.bpm:(TEMPO.bpm||(+CFG.bpmMin+ +CFG.bpmMax)/2);
  const big=$("bigg");if(big){const ph=big.querySelector(".ph");let step;
    if(live&&pulse&&typeof A!=="undefined"&&A&&S.bpm){const st=60/S.bpm/4,ahead=Math.max(0,Math.ceil((seq.next-A.ctx.currentTime)/st));step=((seq.step-ahead)%16+16)%16}else step=Math.floor(now/1000*bpm/15)%16;
    if(ph){ph.setAttribute("x",step*4);ph.style.opacity=live&&pulse?.28:.12}const lb=$("biggS");if(lb)lb.textContent=live&&pulse?"live":pulse?"press play to hear it":"switch to Pulse to hear it"}
  if(now-t1<220)return;t1=now;
  const b=$("stBpm");if(b){b.textContent=bpm.toFixed(1);const lo=+CFG.bpmMin,hi=Math.max(lo,+CFG.bpmMax),r=$("stRng"),m=$("stMk");if(r){r.style.left=((lo-60)/120*100)+"%";r.style.width=Math.max(.8,(hi-lo)/120*100)+"%"}if(m)m.style.left=clamp((bpm-60)/120*100,0,100)+"%"}
  const ps=$("pstat");if(ps){const g=GENRE_BY[CFG.genre],sc=CFG.scale==="auto"?kpScaleName(S.cur.kp||2):(SCALE_N[CFG.scale]||CFG.scale).toLowerCase();
    ps.innerHTML=`<span class="ps-sty" data-s="${S.style}"><i></i>${pulse?"Pulse":"Ambient"}</span><span>${KEYS[CFG.key]} ${sc}</span>${pulse?`<span class="ps-bpm"><b>${bpm.toFixed(1)}</b> BPM</span><span>${g?g.name:"custom groove"}</span>`:""}${lastPre?`<span>${esc(lastPre)}</span>`:""}`}
  document.querySelectorAll("#pgrid .gt").forEach(t=>{const on=CFG.genre===t.dataset.genre&&pulse;if(t.classList.contains("sel")!==on){t.classList.toggle("sel",on);t.setAttribute("aria-pressed",on)}});
  if($("smapl")&&CFG.scale==="auto")paintKey()}
requestAnimationFrame(loop);

return {tabs,group,mixer,presets,enhance,setLast:n=>{lastPre=n},IC,ic};
})();
