// Guards on the GitHub workflows themselves.   node --test "tests/*.test.mjs"
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../.github/workflows/", import.meta.url);
const files = readdirSync(DIR).filter(f => f.endsWith(".yml"));
const code = f => readFileSync(new URL(f, DIR), "utf8").split("\n").filter(l => !l.trim().startsWith("#")).join("\n");

// GitHub skips every push-triggered workflow when a commit message carries one of these tags, and a squash merge
// copies the branch's commit titles into the message on main. A bot commit tagged this way once skipped the site deploy.
test("no workflow writes a commit that tells GitHub to skip CI", () => {
  for (const f of files) assert.doesNotMatch(code(f), /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]|skip-checks:/i, f);
});

test("every action is pinned to a full commit", () => {
  for (const f of files) for (const m of code(f).matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `${f}: ${m[1]}`);
});

test("the keeper starts its own successor, and only one runs at a time", () => {
  const k = code("keeper.yml");
  assert.match(k, /gh workflow run keeper\.yml/);
  assert.match(k, /group: keeper\s+cancel-in-progress: false/);
  assert.match(k, /gh workflow run pages\.yml/);
});
