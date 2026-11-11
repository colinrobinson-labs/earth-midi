/* Earth MIDI app bridge. Runs before the site's own scripts (document start) inside the app's web view.
   It adds what Safari can't do on Apple devices and hands it to native code:
   - Web MIDI: a virtual MIDI port (out to GarageBand / Logic / Ableton…, and in for play-along)
   - Saving files (WAV, MIDI, stems, presets) through the share sheet / save panel
   - Play state + every played event, for Lock Screen, Live Activity, widgets and haptics
   The sound engine itself is the site's, unchanged: same reading, same note. */
(function () {
  "use strict";
  var H = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.em;
  if (!H) return;
  var post = function (m) { try { H.postMessage(m) } catch (_) {} };
  document.documentElement.classList.add("in-app");

  /* ---------- Web MIDI → CoreMIDI ---------- */
  var listeners = [];
  var output = {
    id: "earthmidi-virtual", name: "Earth MIDI (to other apps)", manufacturer: "Earth MIDI", type: "output", state: "connected", connection: "open",
    send: function (data, ts) { var d = ts ? Math.max(0, ts - performance.now()) : 0; post({ t: "midi", b: Array.prototype.slice.call(data), d: d }) },
    clear: function () {}, open: function () { return Promise.resolve(output) }, close: function () { return Promise.resolve(output) },
    addEventListener: function () {}, removeEventListener: function () {}
  };
  var input = {
    id: "earthmidi-in", name: "Earth MIDI In", manufacturer: "Earth MIDI", type: "input", state: "connected", connection: "open", onmidimessage: null,
    addEventListener: function (t, f) { if (t === "midimessage") listeners.push(f) },
    removeEventListener: function (t, f) { listeners = listeners.filter(function (x) { return x !== f }) },
    open: function () { return Promise.resolve(input) }, close: function () { return Promise.resolve(input) }
  };
  var access = { inputs: new Map([[input.id, input]]), outputs: new Map([[output.id, output]]), sysexEnabled: false, onstatechange: null,
    addEventListener: function () {}, removeEventListener: function () {} };
  function autoPick() {
    var s = document.getElementById("midiOut");
    if (s && !s.value) { s.value = output.id; s.dispatchEvent(new Event("change")) }
  }
  try {
    Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: function () { setTimeout(autoPick, 0); return Promise.resolve(access) } });
  } catch (_) {}

  /* ---------- native → page ---------- */
  var ready = function (f) { try { return f() } catch (e) { console.error(e) } };
  window.EMNative = {
    midiIn: function (bytes) { var e = { data: new Uint8Array(bytes), timeStamp: performance.now() }; if (input.onmidimessage) input.onmidimessage(e); listeners.forEach(function (f) { f(e) }) },
    play: function () { ready(function () { if (!S.on) startStop() }) },
    stop: function () { ready(function () { if (S.on) startStop() }) },
    toggle: function () { ready(function () { startStop() }) },
    goLive: function () { ready(function () { goLive() }) },
    setStyle: function (s) { ready(function () { setStyle(s) }) },
    state: function () { sendState() },
    // folding phones: where the hinge is, in this view's CSS px, or null when flat (see js/fold.js)
    fold: function (f) { ready(function () { if (typeof FOLD !== "undefined") FOLD.set(f) }) }
  };

  /* ---------- page → native ---------- */
  function sendState() {
    try {
      var c = S.cur || {};
      post({ t: "state", on: !!S.on, live: !!(S.on && (S.mode === 0 || S.liveSince)), kp: +c.kp || 0, sp: +c.sp || 0, bz: +c.bz || 0,
        oh: +c.oh || 0, bpm: +S.bpm || 0, style: S.style || "ambient", scale: typeof kpScaleName === "function" ? kpScaleName(+c.kp || 2) : "" });
    } catch (_) {}
  }
  function wrap() {
    // every event the engine logs (quakes, flares, sunrises, NASA events, planet chord…)
    if (typeof window.logEv === "function" && !window.logEv.__em) {
      var orig = window.logEv;
      window.logEv = function (text, layer, q) {
        var r = orig.apply(this, arguments);
        try {
          var m = /→\s*([A-G]#?-?\d)/.exec(text || "");
          post({ t: "event", text: String(text || "").replace(/<[^>]+>/g, ""), layer: layer || "", note: m ? m[1] : "",
            mag: q && q.mag != null ? +q.mag : null, lat: q && q.lat != null ? +q.lat : null, lon: q && q.lon != null ? +q.lon : null });
        } catch (_) {}
        return r;
      };
      window.logEv.__em = true;
    }
    // files: WAV / MIDI / zip / json / csv go to the share sheet or save panel
    if (typeof window.download === "function" && !window.download.__em) {
      window.download = function (name, blob) {
        var r = new FileReader();
        r.onload = function () { var s = String(r.result || ""); post({ t: "file", name: name, mime: blob.type || "", data: s.slice(s.indexOf(",") + 1) }) };
        r.readAsDataURL(blob);
      };
      window.download.__em = true;
    }
    if (typeof window.startStop === "function" && !window.startStop.__em) {
      var ss = window.startStop;
      window.startStop = function () { var p = ss.apply(this, arguments); setTimeout(sendState, 60); return p };
      window.startStop.__em = true;
    }
    // In the app: no visit counter runs, so say so
    var pv = document.getElementById("privacy");
    if (pv) pv.innerHTML = "<b>Privacy:</b> no accounts, ads, tracking or analytics in the app. Your settings and presets stay on this device. The app reads public sensor data through earthmidi.com and the sources below; like any app that goes online, they see your IP address. <a href=\"https://earthmidi.com/privacy.html\">Privacy policy</a>.";
    // Footer pages (support, press, what's new, privacy) live on earthmidi.com, not inside the app
    var links = document.querySelectorAll("footer a[href$='.html']");
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute("href") || "";
      if (!/^[a-z]+:/i.test(h)) { links[i].href = "https://earthmidi.com/" + h.replace(/^\.?\//, ""); links[i].target = "_blank"; links[i].rel = "noopener" }
    }
    if (navigator.mediaSession) {
      try {
        navigator.mediaSession.setActionHandler("play", function () { window.EMNative.play() });
        navigator.mediaSession.setActionHandler("pause", function () { window.EMNative.stop() });
        navigator.mediaSession.setActionHandler("stop", function () { window.EMNative.stop() });
      } catch (_) {}
    }
    post({ t: "ready" });
    sendState();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wrap); else wrap();
  setInterval(sendState, 2000);
})();
