/**
 * Синхронизация seo-content.ts с TAG_REGISTRY: для каждого slug из реестра,
 * отсутствующего в SEO, добавляет шаблонный блок (buildSeoContentFromTag).
 *
 * Использование:
 *   npx tsx scripts/sync-seo-content.ts --check   # exit 1 если есть пропуски
 *   npx tsx scripts/sync-seo-content.ts --write  # дописать недостающие ключи в seo-content.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import SEO from "../src/lib/seo-content.js";
import { buildSeoContentFromTag } from "../src/lib/seo-content-from-tag.js";
import { TAG_REGISTRY, type TagEntry, type Dimension } from "../src/lib/tag-registry.js";
import type { SeoContent } from "../src/lib/seo-content.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const seoPath = join(root, "src/lib/seo-content.ts");

const DIM_ORDER: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

function emitEntry(slug: string, c: SeoContent): string {
  const faq = c.faqItems
    .map((f) => `      { q: ${JSON.stringify(f.q)}, a: ${JSON.stringify(f.a)} },`)
    .join("\n");
  const how = c.howToSteps.map((s) => `      ${JSON.stringify(s)},`).join("\n");
  return `  ${slug}: {
    h1: ${JSON.stringify(c.h1)},
    metaTitle: ${JSON.stringify(c.metaTitle)},
    metaDescription: ${JSON.stringify(c.metaDescription)},
    intro: ${JSON.stringify(c.intro)},
    faqItems: [
${faq}
    ],
    howToSteps: [
${how}
    ],
  }`;
}

function collectMissing(): TagEntry[] {
  const existing = new Set(Object.keys(SEO));
  const seen = new Set<string>();
  const missing: TagEntry[] = [];
  for (const tag of TAG_REGISTRY) {
    if (existing.has(tag.slug) || seen.has(tag.slug)) continue;
    seen.add(tag.slug);
    missing.push(tag);
  }
  return missing.sort(
    (a, b) =>
      DIM_ORDER.indexOf(a.dimension) - DIM_ORDER.indexOf(b.dimension) ||
      a.slug.localeCompare(b.slug),
  );
}

function patchSeoFile(missing: TagEntry[]) {
  const src = readFileSync(seoPath, "utf8");
  const marker = "\nexport function getSeoContent";
  const idx = src.indexOf(marker);
  if (idx === -1) {
    throw new Error(`Cannot find "${marker.trim()}" in seo-content.ts`);
  }
  const head = src.slice(0, idx);
  const tail = src.slice(idx);

  const lastBrace = head.lastIndexOf("};");
  if (lastBrace === -1) throw new Error("Cannot find closing }; of SEO object");

  const beforeClose = head.slice(0, lastBrace).trimEnd();
  const needComma = !beforeClose.endsWith(",");

  const newBlocks = missing.map((t) => emitEntry(t.slug, buildSeoContentFromTag(t))).join(",\n\n");

  const section = `
  // ═══════════════════════════════════════════
  // Шаблон из TAG_REGISTRY (sync-seo-content.ts)
  // ═══════════════════════════════════════════

${newBlocks}`;

  const insertion = `${needComma ? "," : ""}${section}
`;
  const newHead = head.slice(0, lastBrace) + insertion + "};";
  writeFileSync(seoPath, newHead + tail, "utf8");
}

const missing = collectMissing();

if (process.argv.includes("--check")) {
  if (missing.length > 0) {
    console.error(`seo-content.ts: отсутствуют записи для ${missing.length} slug из TAG_REGISTRY:`);
    for (const t of missing) console.error(`  - ${t.slug} (${t.dimension})`);
    process.exit(1);
  }
  console.log("seo-content.ts покрывает все уникальные slug из TAG_REGISTRY.");
  process.exit(0);
}

if (process.argv.includes("--write")) {
  if (missing.length === 0) {
    console.log("Нечего добавлять: все slug уже в seo-content.ts.");
    process.exit(0);
  }
  patchSeoFile(missing);
  console.log(`Добавлено ${missing.length} шаблонных блок(ов) в seo-content.ts.`);
  process.exit(0);
}

console.log(`Найдено ${missing.length} отсутствующих slug. Запусти с --write или --check.`);
process.exit(missing.length ? 2 : 0);
