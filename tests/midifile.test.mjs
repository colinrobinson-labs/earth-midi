// The MIDI files Earth MIDI writes (data pack, performance) must open cleanly in a DAW: every note starts once and
// ends once, in time order. tidyNotes() in js/io.js is the pass that guarantees it.   node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./helpers/engine.mjs";

const E = loadEngine(["feeds", "core", "audio", "io"]);
const tidy = ev => JSON.parse(E.run(`JSON.stringify(tidyNotes(${JSON.stringify(ev)}))`));
const ON = 0x90, OFF = 0x80;

// every note-on is followed by exactly one note-off for that key before the next note-on, and nothing is left open
function check(out) {
  const open = new Set();
  let last = 0;
  for (const [tk, b] of out) {
    assert.ok(tk >= last, "events are in time order");
    last = tk;
    const id = (b[0] & 15) + ":" + b[1];
    if ((b[0] & 0xf0) === ON && b[2]) { assert.ok(!open.has(id), `note ${id} starts twice at tick ${tk}`); open.add(id); }
    else if ((b[0] & 0xf0) === OFF) { assert.ok(open.has(id), `note-off for ${id} with nothing sounding`); open.delete(id); }
  }
  assert.equal(open.size, 0, "no note is left sounding");
}

test("a plain note passes through untouched", () => {
  const ev = [[0, [ON, 60, 90]], [480, [OFF, 60, 0]]];
  assert.deepEqual(tidy(ev), ev);
});

test("two voices on the same pitch at the same instant become one note with the louder velocity", () => {
  const out = tidy([[0, [ON, 62, 60]], [0, [ON, 62, 80]], [1910, [OFF, 62, 0]], [1910, [OFF, 62, 0]]]);
  check(out);
  assert.deepEqual(out, [[0, [ON, 62, 80]], [1910, [OFF, 62, 0]]]);
});

test("a note struck again while it rings is ended first, and the last ending wins", () => {
  const out = tidy([[0, [ON, 50, 70]], [100, [ON, 50, 90]], [300, [OFF, 50, 0]], [400, [OFF, 50, 0]]]);
  check(out);
  assert.deepEqual(out, [[0, [ON, 50, 70]], [100, [OFF, 50, 0]], [100, [ON, 50, 90]], [400, [OFF, 50, 0]]]);
});

test("a held note with no ending is closed at the last event; a stray note-off is dropped", () => {
  const out = tidy([[10, [OFF, 40, 0]], [0, [ON, 45, 60]], [960, [0xb0, 1, 64]]]);
  check(out);
  assert.deepEqual(out, [[0, [ON, 45, 60]], [960, [0xb0, 1, 64]], [960, [OFF, 45, 0]]]);
});

test("an ending and a new start on the same tick: the ending comes first", () => {
  const out = tidy([[480, [ON, 60, 90]], [0, [ON, 60, 90]], [480, [OFF, 60, 0]], [960, [OFF, 60, 0]]]);
  check(out);
  assert.equal(out.length, 4);
});

test("channels are kept apart, fractional ticks are rounded, velocity-0 note-on counts as an ending", () => {
  const out = tidy([[0.4, [ON | 1, 60, 90]], [0, [ON | 2, 60, 90]], [99.6, [ON | 1, 60, 0]], [100, [OFF | 2, 60, 0]]]);
  check(out);
  assert.deepEqual(out.map(e => e[0]), [0, 0, 100, 100]);
});

test("a dense random track comes out clean", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ev = [];
  for (let i = 0; i < 2000; i++) { const t = Math.floor(rnd() * 5000), n = 60 + Math.floor(rnd() * 5); ev.push([t, [ON, n, 1 + Math.floor(rnd() * 126)]], [t + Math.floor(rnd() * 400), [OFF, n, 0]]); }
  check(tidy(ev));
});
