/* Earth MIDI · the site's own dialogs, in place of the browser's prompt() and confirm().
   Same look as the rest of the rack, and the same behaviour in every browser and inside the apps
   (WKWebView shows no prompt() at all unless the app builds one).
     EMAsk.text({title, label, value, ok, hint})  -> Promise of the typed text, or null if cancelled
     EMAsk.copy({title, text, note})              -> shows text ready to copy when the clipboard is blocked
     EMAsk.confirm({title, body, ok, cancel})     -> Promise of true / false
   Esc and a click on the backdrop cancel. Focus goes back to whatever opened the dialog. */
"use strict";
(()=>{
const css=document.createElement("style");
css.textContent=`
.emd{border:1px solid var(--line2);border-radius:16px;background:var(--sf2);color:var(--fg);padding:18px 18px 14px;width:min(400px,calc(100vw - 32px));box-shadow:0 24px 80px rgba(0,0,0,.6)}
.emd::backdrop{background:rgba(3,5,8,.6);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.emd h3{font:700 17px var(--disp);margin:0 0 6px}
.emd p{font:13.5px/1.5 var(--body);color:var(--mute);margin:0 0 12px}
.emd label{display:block;font:10.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 6px}
.emd input,.emd textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--line2);border-radius:10px;background:var(--sf0);color:var(--fg);font:14px var(--mono);padding:10px 12px;margin:0 0 14px}
.emd input{height:44px}.emd textarea{height:96px;resize:none;line-height:1.45;word-break:break-all}
.emd input:focus-visible,.emd textarea:focus-visible{outline:2px solid var(--o);outline-offset:1px}
.emd .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.emd button{min-height:40px;padding:0 14px;border-radius:10px;font:500 13px var(--body);cursor:pointer;border:1px solid var(--line2);background:transparent;color:var(--fg)}
.emd button.go2{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.emd .said{font:11.5px var(--mono);color:var(--k);margin:0 auto 0 0;align-self:center}.emd .said:empty{display:none}`;
document.head.appendChild(css);

let n=0;
function open(build){return new Promise(res=>{
  const back=document.activeElement,d=document.createElement("dialog"),id="emd"+(++n);
  d.className="emd";d.setAttribute("aria-labelledby",id);
  let out=null,done=false;
  const close=v=>{if(done)return;done=true;out=v;try{d.close()}catch(_){d.removeAttribute("open")}d.remove();if(back&&back.focus&&document.contains(back))back.focus();res(out)};
  const h=document.createElement("h3");h.id=id;d.appendChild(h);
  const focus=build(d,h,close);
  d.addEventListener("cancel",e=>{e.preventDefault();close(null)});
  d.addEventListener("click",e=>{if(e.target===d)close(null)});
  // page shortcuts (space = play, g, f, p, w, z) stay out of the dialog
  d.addEventListener("keydown",e=>{if(e.key!=="Escape")e.stopPropagation()});
  document.body.appendChild(d);
  if(d.showModal)d.showModal();else d.setAttribute("open","");
  if(focus){focus.focus();if(focus.select)focus.select()}})}

const el=(tag,props,text)=>{const e=document.createElement(tag);Object.assign(e,props||{});if(text!=null)e.textContent=text;return e};
const row=(...kids)=>{const r=el("div",{className:"row"});r.append(...kids);return r};

function text({title,label,value="",ok="Save",hint,max=60}){return open((d,h,close)=>{
  h.textContent=title;if(hint)d.appendChild(el("p",null,hint));
  const f=el("form",{method:"dialog"}),i=el("input",{type:"text",value,maxLength:max,autocomplete:"off",spellcheck:false,id:h.id+"i"});
  i.setAttribute("enterkeyhint","done");
  if(label){const l=el("label",null,label);l.htmlFor=i.id;f.appendChild(l)}else i.setAttribute("aria-labelledby",h.id);
  const go=el("button",{type:"submit",className:"go2"},ok);
  f.append(i,row(el("button",{type:"button",onclick:()=>close(null)},"Cancel"),go));
  f.addEventListener("submit",e=>{e.preventDefault();const v=i.value.trim();close(v||null)});
  d.appendChild(f);return i})}

function copy({title="Copy this",text,note}){return open((d,h,close)=>{
  h.textContent=title;
  d.appendChild(el("p",null,note||"This browser blocked the clipboard. Press Copy, or select the text and copy it yourself."));
  const t=el("textarea",{readOnly:true,value:text});t.setAttribute("aria-labelledby",h.id);
  const said=el("span",{className:"said"});said.setAttribute("role","status");
  const cp=el("button",{type:"button",className:"go2"},"Copy");
  cp.onclick=async()=>{t.focus();t.select();let ok=false;
    try{await navigator.clipboard.writeText(text);ok=true}catch(_){try{ok=document.execCommand("copy")}catch(_){}}
    said.textContent=ok?"Copied":"Still blocked. Select the text and copy it by hand"};
  d.append(t,row(said,el("button",{type:"button",onclick:()=>close(true)},"Done"),cp));return t})}

function confirm({title,body,ok="OK",cancel="Cancel"}){return open((d,h,close)=>{
  h.textContent=title;if(body)d.appendChild(el("p",null,body));
  const stay=el("button",{type:"button",onclick:()=>close(false)},cancel);
  d.appendChild(row(stay,el("button",{type:"button",className:"go2",onclick:()=>close(true)},ok)));return stay}).then(v=>v===true)}

window.EMAsk={text,copy,confirm};
})();
