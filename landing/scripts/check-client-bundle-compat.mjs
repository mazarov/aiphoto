/**
 * Browser-support gate for everything we ship to the browser.
 *
 * Contract: `browserslist` in package.json (Safari / iOS 16.0+). SWC lowers syntax
 * to that target, but some constructs are not transpilable and silently reach the
 * bundle. In Safari < 16.4 they are a SyntaxError for the *whole chunk*: if that
 * chunk is shared by the root layout, hydration dies on every page (no search, no
 * modals, no swipe). This script scans built client assets and fails the build.
 *
 * Runs after `next build` via `npm run build`. Standalone: `npm run check:browser-compat`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_DIRS = [
  join(landingRoot, ".next", "static", "chunks"),
  join(landingRoot, "public", "stv-panel"),
];

/**
 * Each rule: a regex over minified source and the minimum Safari version that
 * supports the construct. Keep this list to things SWC/esbuild cannot lower.
 */
const RULES = [
  {
    id: "regexp-lookbehind",
    minSafari: "16.4",
    // `(?<=` / `(?<!` — a syntax error at parse time, not a runtime feature check.
    pattern: /\(\?<[=!]/g,
    hint: "rewrite as (?:^|[^…])… or move the regex to a server-only module",
  },
  {
    id: "class-static-block",
    minSafari: "16.4",
    pattern: /\bstatic\s*\{/g,
    hint: "lower via browserslist/esbuild target or initialize in module scope",
  },
];

function listJsFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (/\.(m?js)$/.test(name)) out.push(full);
  }
  return out;
}

function snippet(src, index, radius = 60) {
  const start = Math.max(0, index - radius);
  const end = Math.min(src.length, index + radius);
  return src.slice(start, end).replace(/\s+/g, " ");
}

const files = SCAN_DIRS.flatMap(listJsFiles);
if (files.length === 0) {
  console.error("[browser-compat] no client bundles found — run `next build` first");
  process.exit(2);
}

const violations = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(src)) !== null) {
      violations.push({ file: relative(landingRoot, file), rule, index: m.index, src });
      if (violations.length > 50) break;
    }
  }
}

if (violations.length > 0) {
  console.error(
    `[browser-compat] ${violations.length} construct(s) unsupported by the browserslist target (Safari >= 16):`
  );
  for (const v of violations) {
    console.error(
      `  - ${v.file}: ${v.rule.id} (needs Safari ${v.rule.minSafari}) — ${v.rule.hint}\n      …${snippet(v.src, v.index)}…`
    );
  }
  process.exit(1);
}

console.log(`[browser-compat] OK — ${files.length} client bundle(s) scanned, no Safari < 16.4 parse breakers`);
