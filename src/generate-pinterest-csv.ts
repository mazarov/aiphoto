/**
 * Generate CSV file for Pinterest bulk upload.
 * Uses the same board mapping logic as publish-to-pinterest.ts.
 *
 * Usage:
 *   npx tsx src/generate-pinterest-csv.ts --limit 200
 *   npx tsx src/generate-pinterest-csv.ts --limit 200 --output pins-batch-1.csv
 */

import path from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = 200;
  let output = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") {
      const n = Number(args[i + 1]);
      if (!Number.isNaN(n) && n > 0) limit = Math.min(n, 200);
    }
    if (args[i] === "--output") output = args[i + 1] || "";
  }
  if (!output) {
    const ts = new Date().toISOString().slice(0, 10);
    output = `pinterest-pins-${ts}.csv`;
  }
  return { limit, output };
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
    .select("dimension_type, dimension_value, pinterest_board_id, title_ru")
    .eq("page_level", "L1")
    .not("pinterest_board_id", "is", null);

  if (error) throw new Error(`Failed to load board map: ${error.message}`);

  const boardMap: BoardMap = new Map();
  const nameMap: BoardNameMap = new Map();
  for (const row of data || []) {
    const key = `${row.dimension_type}:${row.dimension_value}`;
    boardMap.set(key, row.pinterest_board_id);
    nameMap.set(row.pinterest_board_id, row.title_ru);
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

async function fetchCards(supabase: SupabaseClient, limit: number): Promise<CardRow[]> {
  const { data: publishedIds } = await supabase
    .from("card_distributions")
    .select("card_id")
    .eq("platform", "pinterest");

  const excludeIds = new Set((publishedIds || []).map((r: any) => r.card_id));

  const { data, error } = await supabase
    .from("prompt_cards")
    .select(`
      id, slug, title_en, title_ru, seo_tags,
      prompt_card_media!inner(storage_path),
      prompt_variants(prompt_text_en, prompt_text_ru)
    `)
    .eq("is_published", true)
    .eq("prompt_card_media.is_primary", true)
    .order("source_date", { ascending: false })
    .limit(limit + excludeIds.size);

  if (error) throw new Error(`Failed to fetch cards: ${error.message}`);

  return (data || [])
    .filter((c: any) => !excludeIds.has(c.id))
    .slice(0, limit) as CardRow[];
}

// ── CSV helpers ──

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function buildDescription(card: CardRow, link: string): string {
  const title = card.title_en || card.title_ru;
  const promptText = card.prompt_variants?.[0]?.prompt_text_en
    || card.prompt_variants?.[0]?.prompt_text_ru
    || "";
  const excerpt = promptText.slice(0, 150);

  let desc = `${title}. Ready-to-use AI photo prompt — copy and paste into ChatGPT or Gemini.`;
  if (excerpt) desc += ` "${excerpt}${promptText.length > 150 ? "..." : ""}"`;
  desc += ` Get this prompt and 6000+ more: ${link}`;

  return desc.slice(0, 500);
}

// ── Main ──

async function main() {
  loadEnvFiles();
  const { limit, output } = parseArgs();

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

  const cards = await fetchCards(supabase, limit);
  console.log(`Fetched ${cards.length} unpublished cards (limit=${limit})`);

  if (!cards.length) {
    console.log("Nothing to export.");
    return;
  }

  const header = "Title,Description,Link,Media URL,Pinterest board";
  const rows: string[] = [header];

  const boardCounts = new Map<string, number>();

  for (const card of cards) {
    const boardId = pickBoard(card.seo_tags || {}, boardMap, "");
    const boardName = nameMap.get(boardId) || "AI Photo Prompts";
    const title = (card.title_en || card.title_ru).slice(0, 100);
    const link = `https://${siteDomain}/p/${card.slug}/?utm_source=pinterest&utm_medium=pin`;
    const imageUrl = `${storageUrl}/${card.prompt_card_media[0]?.storage_path}`;
    const description = buildDescription(card, link);

    rows.push([
      escapeCsv(title),
      escapeCsv(description),
      escapeCsv(link),
      escapeCsv(imageUrl),
      escapeCsv(boardName),
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
