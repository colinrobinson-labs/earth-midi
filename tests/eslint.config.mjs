// Lint rules for the site scripts, the build scripts and the tests.
//   (cd tests && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci) && tests/node_modules/.bin/eslint -c tests/eslint.config.mjs .
// The site's js/ files are plain <script> tags that share one global scope (index.html sets the order), so a name
// defined at the top of one file is visible in all the others. ESLint checks one file at a time, so this config
// reads every file first and tells it which names the others define.
import js from "@eslint/js";
import globals from "globals";
import { parse } from "espree";
import { readFileSync, readdirSync } from "node:fs";

const SITE = new URL("../js/", import.meta.url);
const shared = {};
for (const file of readdirSync(SITE).filter(f => f.endsWith(".js"))) {
  const names = n => !n ? [] : n.type === "Identifier" ? [n.name] : n.type === "ObjectPattern" ? n.properties.flatMap(p => names(p.value || p.argument))
    : n.type === "ArrayPattern" ? n.elements.flatMap(names) : n.type === "AssignmentPattern" ? names(n.left) : n.type === "RestElement" ? names(n.argument) : [];
  const src = readFileSync(new URL(file, SITE), "utf8");
  // names a file hands to the others from inside a closure: window.EMRec = {...}
  for (const m of src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) shared[m[1]] = "writable";
  for (const node of parse(src, { ecmaVersion: "latest" }).body) {
    if (node.type === "VariableDeclaration") node.declarations.forEach(d => names(d.id).forEach(n => (shared[n] = "writable")));
    else if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") shared[node.id.name] = "writable";
  }
}

export default [
  { ignores: ["vendor/**", "**/node_modules/**", "_site/**", "apps/apple/.build/**", "**/*.min.js"] },
  js.configs.recommended,
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-assignment": "off",
      // unused names: a warning, and for locals only, because a top-level name in js/ may be used by another file
      "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  {
    files: ["js/**/*.js"],
    languageOptions: { sourceType: "script", ecmaVersion: "latest", globals: { ...globals.browser, ...shared, topojson: "readonly", goatcounter: "readonly", module: "readonly" } },
    rules: {
      // every file re-declares what it defines, which is exactly what `shared` lists
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },
  { files: ["apps/apple/App/Bridge.js"], languageOptions: { sourceType: "script", ecmaVersion: "latest", globals: { ...globals.browser, ...shared } } },
  { files: ["scripts/**/*.js", "apps/apple/scripts/**/*.js"], languageOptions: { sourceType: "commonjs", ecmaVersion: "latest", globals: globals.node } },
  { files: ["**/*.mjs"], languageOptions: { sourceType: "module", ecmaVersion: "latest", globals: globals.node } },
  // these drive a real browser, and the callbacks they hand to it run inside the page
  { files: ["tests/smoke.mjs", "tests/hostile.mjs", "apps/apple/scripts/*.js"], languageOptions: { globals: { ...globals.node, ...globals.browser, ...shared, axe: "readonly" } } },
];
