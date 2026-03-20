/**
 * Generate CSV file for Pinterest bulk upload.
 * Uses the same board mapping logic as publish-to-pinterest.ts.
 *
 * Usage:
 *   npx tsx src/generate-pinterest-csv.ts --limit 200
 *   npx tsx src/generate-pinterest-csv.ts --limit 200 --output pins-batch-1.csv
 *   npx tsx src/generate-pinterest-csv.ts --limit 1 --board audience:devushka --output pinterest-test.csv
 */

import path from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { TAG_REGISTRY, type Dimension } from "../landing/src/lib/tag-registry";

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "landing/.env.local"]) {
    const abs = path.resolve(cwd, p);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
  }
}

function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  );
}

interface Args {
  limit: number;
  output: string;
  /** e.g. audience:devushka — only cards whose pickBoard() maps to this L1 board */
  boardKey: string | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = 200;
  let output = "";
  let boardKey: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") {
      const n = Number(args[i + 1]);
      if (!Number.isNaN(n) && n > 0) limit = Math.min(n, 200);
    }
    if (args[i] === "--output") output = args[i + 1] || "";
    if (args[i] === "--board") boardKey = (args[i + 1] || "").trim() || null;
  }
  if (!output) {
    const ts = new Date().toISOString().slice(0, 10);
    output = `pinterest-pins-${ts}.csv`;
  }
  return { limit, output, boardKey };
}

/** Must match `create-pinterest-boards.ts` — CSV "Pinterest board" must equal the exact board name on Pinterest. */
const BOARD_NAME_TEMPLATES: Record<string, (label: string) => string> = {
  audience: (l) => `AI Photo: ${l}`,
  style: (l) => `${l} AI Photos`,
  occasion: (l) => `${l} AI Photos`,
  object: (l) => `AI Photos: ${l}`,
  doc_task: (l) => `AI ${l} Photo`,
};

function pinterestBoardDisplayName(row: {
  dimension_type: string;
  title_ru: string;
  title_en: string | null;
}): string {
  const template = BOARD_NAME_TEMPLATES[row.dimension_type];
  const label = row.title_en || row.title_ru;
  return template ? template(label) : label;
}

// ── Board mapping (same as publish-to-pinterest.ts) ──

type BoardMap = Map<string, string>;
type BoardNameMap = Map<string, string>;

const PRIORITY: [string, string][] = [
  ["occasion_tag", "occasion"],
  ["audience_tag", "audience"],
  ["style_tag", "style"],
  ["object_tag", "object"],
  ["doc_task_tag", "doc_task"],
];

async function loadBoardMaps(supabase: SupabaseClient): Promise<{ boardMap: BoardMap; nameMap: BoardNameMap }> {
  const { data, error } = await supabase
    .from("prompt_clusters")
    .select("dimension_type, dimension_value, pinterest_board_id, title_ru, title_en")
    .eq("page_level", "L1")
    .not("pinterest_board_id", "is", null);

  if (error) throw new Error(`Failed to load board map: ${error.message}`);

  const boardMap: BoardMap = new Map();
  const nameMap: BoardNameMap = new Map();
  for (const row of data || []) {
    const key = `${row.dimension_type}:${row.dimension_value}`;
    boardMap.set(key, row.pinterest_board_id);
    nameMap.set(row.pinterest_board_id, pinterestBoardDisplayName(row));
  }
  return { boardMap, nameMap };
}

function pickBoard(
  seoTags: Record<string, string[]>,
  boardMap: BoardMap,
  fallback: string
): string {
  for (const [tagKey, dimType] of PRIORITY) {
    const tags = seoTags[tagKey];
    if (!tags?.length) continue;
    const boardId = boardMap.get(`${dimType}:${tags[0]}`);
    if (boardId) return boardId;
  }
  return fallback;
}

// ── Card fetching ──

interface CardRow {
  id: string;
  slug: string;
  title_en: string | null;
  title_ru: string;
  seo_tags: Record<string, string[]>;
  prompt_card_media: { storage_path: string }[];
  prompt_variants: { prompt_text_en: string | null; prompt_text_ru: string | null }[];
}

async function fetchCards(
  supabase: SupabaseClient,
  limit: number,
  boardMap: BoardMap,
  boardKey: string | null
): Promise<CardRow[]> {
  const { data: publishedIds } = await supabase
    .from("card_distributions")
    .select("card_id")
    .eq("platform", "pinterest");

  const excludeIds = new Set((publishedIds || []).map((r: any) => r.card_id));

  const select = `
      id, slug, title_en, title_ru, seo_tags,
      prompt_card_media!inner(storage_path),
      prompt_variants(prompt_text_en, prompt_text_ru)
    `;

  if (!boardKey) {
    const { data, error } = await supabase
      .from("prompt_cards")
      .select(select)
      .eq("is_published", true)
      .eq("prompt_card_media.is_primary", true)
      .order("source_date", { ascending: false })
      .limit(limit + excludeIds.size);

    if (error) throw new Error(`Failed to fetch cards: ${error.message}`);

    return (data || [])
      .filter((c: any) => !excludeIds.has(c.id))
      .slice(0, limit) as CardRow[];
  }

  const targetBoardId = boardMap.get(boardKey);
  if (!targetBoardId) {
    throw new Error(
      `Unknown --board "${boardKey}". Use dimension_type:dimension_value from prompt_clusters L1 (e.g. audience:devushka).`
    );
  }

  const out: CardRow[] = [];
  const batchSize = 150;
  let offset = 0;
  const maxScan = 8000;

  while (out.length < limit && offset < maxScan) {
    const { data, error } = await supabase
      .from("prompt_cards")
      .select(select)
      .eq("is_published", true)
      .eq("prompt_card_media.is_primary", true)
      .order("source_date", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(`Failed to fetch cards: ${error.message}`);

    const rows = (data || []).filter((c: any) => !excludeIds.has(c.id)) as CardRow[];
    for (const card of rows) {
      const bid = pickBoard(card.seo_tags || {}, boardMap, "");
      if (bid === targetBoardId) {
        out.push(card);
        if (out.length >= limit) break;
      }
    }

    if (!rows.length) break;
    offset += batchSize;
  }

  return out;
}

// ── Tag label resolver ──

const tagLabelMap = new Map<string, string>();
for (const entry of TAG_REGISTRY) {
  tagLabelMap.set(`${entry.dimension}:${entry.slug}`, entry.labelRu);
}

interface ResolvedLabels {
  audience?: string;
  style?: string;
  occasion?: string;
  object?: string;
  docTask?: string;
}

function resolveTagLabels(seoTags: Record<string, string[]>): ResolvedLabels {
  const get = (dim: Dimension) => {
    const slug = seoTags[dim]?.[0];
    return slug ? tagLabelMap.get(`${dim}:${slug}`) : undefined;
  };
  return {
    audience: get("audience_tag"),
    style: get("style_tag"),
    occasion: get("occasion_tag"),
    object: get("object_tag"),
    docTask: get("doc_task_tag"),
  };
}

// ── CSV helpers ──

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) return cut.slice(0, lastSpace);
  return cut;
}

const TITLE_SUFFIX = " — промт для AI фото";

function buildSeoTitle(card: CardRow): string {
  const labels = resolveTagLabels(card.seo_tags || {});
  const parts: string[] = [];

  if (labels.audience) parts.push(labels.audience);
  if (labels.style) parts.push(labels.style.toLowerCase());
  if (labels.occasion) parts.push(labels.occasion.toLowerCase());
  if (labels.object) parts.push(labels.object.toLowerCase());
  if (labels.docTask && !parts.length) parts.push(labels.docTask);

  const maxBody = 100 - TITLE_SUFFIX.length;

  if (parts.length) {
    let body = parts.join(", ");
    if (body.length > maxBody) {
      body = truncateAtWord(body, maxBody);
    }
    return body + TITLE_SUFFIX;
  }

  const fallback = truncateAtWord(card.title_ru, maxBody);
  return fallback + TITLE_SUFFIX;
}

function buildSeoDescription(card: CardRow): string {
  const labels = resolveTagLabels(card.seo_tags || {});

  let intro = card.title_ru;
  const dotPos = intro.indexOf(". ");
  if (dotPos > 0 && dotPos < 200) {
    intro = intro.slice(0, dotPos + 1);
  } else {
    intro = truncateAtWord(intro, 200);
    if (!intro.endsWith(".")) intro += ".";
  }

  const chunks: string[] = [intro];
  chunks.push("Готовый промт для AI фото — скопируй и вставь в ChatGPT или Gemini.");

  if (labels.audience) chunks.push(`Тема: ${labels.audience.toLowerCase()}.`);
  if (labels.style) chunks.push(`Стиль: ${labels.style.toLowerCase()}.`);
  if (labels.occasion) chunks.push(`Событие: ${labels.occasion.toLowerCase()}.`);
  if (labels.object) chunks.push(`Детали: ${labels.object.toLowerCase()}.`);
  if (labels.docTask) chunks.push(`Задача: ${labels.docTask.toLowerCase()}.`);

  chunks.push("6000+ промтов для AI фото на PromptShot.");

  let desc = chunks.join(" ");
  if (desc.length > 500) desc = desc.slice(0, 497) + "...";
  return desc;
}

function buildKeywords(card: CardRow): string {
  const seoTags = card.seo_tags || {};
  const kw = new Set<string>(["промт для фото", "AI фото", "нейросеть фото"]);

  const labelsFor = (dim: Dimension): string[] => {
    const slugs = seoTags[dim] || [];
    return slugs
      .map((slug) => tagLabelMap.get(`${dim}:${slug}`))
      .filter((v): v is string => Boolean(v));
  };

  const audience = labelsFor("audience_tag");
  const styles = labelsFor("style_tag");
  const occasions = labelsFor("occasion_tag");
  const objects = labelsFor("object_tag");
  const docTasks = labelsFor("doc_task_tag");

  for (const label of audience) kw.add(`промты для фото ${label.toLowerCase()}`);
  for (const label of styles) kw.add(`${label.toLowerCase()} фото`);
  for (const label of occasions) kw.add(`${label.toLowerCase()} фото`);
  for (const label of objects) kw.add(`фото ${label.toLowerCase()}`);
  for (const label of docTasks) kw.add(`промт для ${label.toLowerCase()}`);

  kw.add("Nano Banana");
  return [...kw].join(", ");
}

// ── Main ──

async function main() {
  loadEnvFiles();
  const { limit, output, boardKey } = parseArgs();

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteDomain = process.env.SITE_DOMAIN || "promptshot.ru";
  const storageUrl = `${supabaseUrl}/storage/v1/object/public/prompt-images`;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { boardMap, nameMap } = await loadBoardMaps(supabase);
  console.log(`Loaded ${boardMap.size} board mappings`);
  if (boardKey) {
    const id = boardMap.get(boardKey);
    const name = id ? nameMap.get(id) : undefined;
    console.log(`Filter --board ${boardKey} → ${name || "?"} (${id || "missing"})`);
  }

  const cards = await fetchCards(supabase, limit, boardMap, boardKey);
  console.log(`Fetched ${cards.length} unpublished cards (limit=${limit}${boardKey ? `, board=${boardKey}` : ""})`);

  if (!cards.length) {
    console.log("Nothing to export.");
    return;
  }

  const header = "Title,Media URL,Pinterest board,Thumbnail,Description,Link,Keywords";
  const rows: string[] = [header];

  const boardCounts = new Map<string, number>();

  for (const card of cards) {
    const boardId = pickBoard(card.seo_tags || {}, boardMap, "");
    const boardName = nameMap.get(boardId) || "AI Photo Prompts";
    const title = buildSeoTitle(card);
    const link = `https://${siteDomain}/p/${card.slug}/?utm_source=pinterest&utm_medium=pin`;
    const imageUrl = `${storageUrl}/${card.prompt_card_media[0]?.storage_path}`;
    const description = buildSeoDescription(card);
    const keywords = buildKeywords(card);

    rows.push([
      escapeCsv(title),
      escapeCsv(imageUrl),
      escapeCsv(boardName),
      "",
      escapeCsv(description),
      escapeCsv(link),
      escapeCsv(keywords),
    ].join(","));

    boardCounts.set(boardName, (boardCounts.get(boardName) || 0) + 1);
  }

  const outputPath = path.resolve(process.cwd(), output);
  writeFileSync(outputPath, rows.join("\n"), "utf-8");

  console.log(`\nCSV saved: ${outputPath} (${cards.length} pins)`);
  console.log("\nDistribution by board:");
  for (const [name, count] of [...boardCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
