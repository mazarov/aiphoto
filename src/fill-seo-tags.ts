/**
 * Fill seo_tags for prompt_cards from prompt_text_ru.
 * Source of truth: TAG_REGISTRY from landing/src/lib/tag-registry.ts
 * Output: prompt_cards.seo_tags (jsonb), seo_readiness_score (0-100)
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TAG_REGISTRY, type TagEntry } from "../landing/src/lib/tag-registry";

type Args = {
  dryRun: boolean;
  limit?: number;
  batchSize: number;
  dataset?: string;
  recomputeAll: boolean;
  cardId?: string;
};

type CardRow = {
  id: string;
  title_ru: string | null;
  source_dataset_slug: string | null;
  seo_tags: unknown;
  seo_readiness_score: number | null;
};

type VariantRow = {
  card_id: string;
  prompt_text_ru: string | null;
};

const SLUG_LABELS = Object.fromEntries(
  TAG_REGISTRY.map((t) => [t.slug, { ru: t.labelRu.toLowerCase(), en: t.labelEn.toLowerCase() }])
);

type SeoTags = {
  audience_tag: string[];
  style_tag: string[];
  occasion_tag: string[];
  object_tag: string[];
  doc_task_tag: string[];
  labels: { ru: string[]; en: string[] };
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let batchSize = 200;
  let dataset: string | undefined;
  let recomputeAll = false;
  let cardId: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--dry-run") dryRun = true;
    if (token === "--recompute-all") recomputeAll = true;
    if (token === "--limit") {
      const val = Number(args[i + 1]);
      if (Number.isFinite(val) && val > 0) limit = val;
    }
    if (token === "--batch-size") {
      const val = Number(args[i + 1]);
      if (Number.isFinite(val) && val > 0) batchSize = val;
    }
    if (token === "--dataset") {
      const val = args[i + 1];
      if (val) dataset = val;
    }
    if (token === "--card-id") {
      const val = args[i + 1];
      if (val) cardId = val;
    }
  }

  if (cardId) {
    return { dryRun, limit: 1, batchSize: 1, dataset, recomputeAll: true, cardId };
  }
  return { dryRun, limit, batchSize, dataset, recomputeAll };
}

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", ".env.local"),
    path.resolve(cwd, "..", ".env.test"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) loadDotenv({ path: p, override: false });
  }
}

function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractSeoTags(promptTexts: string[], title: string | null): SeoTags {
  const haystack = `${title || ""}\n${promptTexts.join("\n")}`.toLowerCase();
  const result: SeoTags = {
    audience_tag: [],
    style_tag: [],
    occasion_tag: [],
    object_tag: [],
    doc_task_tag: [],
    labels: { ru: [], en: [] },
  };

  const seen = new Set<string>();
  for (const tag of TAG_REGISTRY) {
    if (tag.patterns.some((p) => p.test(haystack)) && !seen.has(tag.slug)) {
      seen.add(tag.slug);
      result[tag.dimension].push(tag.slug);
    }
  }

  // Generate labels for main combination
  const allSlugs = [
    ...result.audience_tag,
    ...result.style_tag,
    ...result.occasion_tag,
    ...result.object_tag,
    ...result.doc_task_tag,
  ];
  if (allSlugs.length > 0) {
    const ruParts = allSlugs.map((s) => SLUG_LABELS[s]?.ru ?? s).slice(0, 3);
    const enParts = allSlugs.map((s) => SLUG_LABELS[s]?.en ?? s).slice(0, 3);
    result.labels.ru = [`Промт для фото ${ruParts.join(", ")}`];
    result.labels.en = [`Photo prompt: ${enParts.join(", ")}`];
  }

  return result;
}

function computeSeoReadinessScore(seoTags: SeoTags): number {
  let score = 0;
  const dims = [
    seoTags.audience_tag,
    seoTags.style_tag,
    seoTags.occasion_tag,
    seoTags.object_tag,
    seoTags.doc_task_tag,
  ];
  for (const arr of dims) {
    if (arr.length > 0) score += 20;
  }
  return Math.min(100, score);
}

async function fetchCardsToProcess(
  supabase: ReturnType<typeof createClient>,
  batchSize: number,
  limit?: number,
  dataset?: string,
  recomputeAll = false,
  cardId?: string,
): Promise<CardRow[]> {
  if (cardId) {
    const { data, error } = await supabase
      .from("prompt_cards")
      .select("id,title_ru,source_dataset_slug,seo_tags,seo_readiness_score")
      .eq("id", cardId)
      .single();
    if (error || !data) throw new Error(`Card not found: ${cardId}`);
    return [data as CardRow];
  }

  const cards: CardRow[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("prompt_cards")
      .select("id,title_ru,source_dataset_slug,seo_tags,seo_readiness_score")
      .order("source_date", { ascending: false })
      .range(from, from + batchSize - 1);

    if (dataset) query = query.eq("source_dataset_slug", dataset);
    if (!recomputeAll) {
      query = query.eq("seo_readiness_score", 0);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch prompt_cards: ${error.message}`);
    if (!data || data.length === 0) break;

    cards.push(...(data as CardRow[]));
    if (limit && cards.length >= limit) return cards.slice(0, limit);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return cards;
}

async function fetchWithRetry<T>(
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  retries = 3,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const { data, error } = await fn();
    if (!error) return data as T;
    const is502 = String(error.message).includes("502");
    if (is502 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error("Retry exhausted");
}

async function fetchPromptTextsByCardIds(
  supabase: ReturnType<typeof createClient>,
  cardIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const chunks = chunk(cardIds, 20);
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    const data = await fetchWithRetry(() =>
      supabase
        .from("prompt_variants")
        .select("card_id,prompt_text_ru")
        .in("card_id", chunks[i])
        .order("variant_index", { ascending: true }),
    );
    for (const row of (data || []) as VariantRow[]) {
      const text = String(row.prompt_text_ru || "").trim();
      if (!text) continue;
      const arr = out.get(row.card_id) || [];
      arr.push(text);
      out.set(row.card_id, arr);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  loadEnvFiles();

  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl) throw new Error("Missing Supabase URL env");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const cards = await fetchCardsToProcess(
    supabase,
    args.batchSize,
    args.limit,
    args.dataset,
    args.recomputeAll,
    args.cardId,
  );
  if (cards.length === 0) {
    console.log(
      JSON.stringify(
        {
          processed: 0,
          updated: 0,
          dryRun: args.dryRun,
          message: "No cards to process. Use --recompute-all to process all.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const promptMap = await fetchPromptTextsByCardIds(
    supabase,
    cards.map((c) => c.id),
  );

  let updated = 0;
  let skippedNoPrompts = 0;
  const stats = { audience: 0, style: 0, occasion: 0, object: 0, doc_task: 0 };
  const sample: Array<{ id: string; seo_tags: SeoTags; score: number }> = [];

  for (const card of cards) {
    const prompts = promptMap.get(card.id) || [];
    if (prompts.length === 0) {
      skippedNoPrompts += 1;
      continue;
    }

    const seoTags = extractSeoTags(prompts, card.title_ru);
    const score = computeSeoReadinessScore(seoTags);

    if (seoTags.audience_tag.length > 0) stats.audience++;
    if (seoTags.style_tag.length > 0) stats.style++;
    if (seoTags.occasion_tag.length > 0) stats.occasion++;
    if (seoTags.object_tag.length > 0) stats.object++;
    if (seoTags.doc_task_tag.length > 0) stats.doc_task++;

    if (sample.length < 5) sample.push({ id: card.id, seo_tags: seoTags, score });

    if (!args.dryRun) {
      const { error } = await supabase
        .from("prompt_cards")
        .update({ seo_tags: seoTags, seo_readiness_score: score })
        .eq("id", card.id);
      if (error) throw new Error(`Failed update card ${card.id}: ${error.message}`);
    }
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        dataset: args.dataset || null,
        recomputeAll: args.recomputeAll,
        scanned: cards.length,
        updated,
        skippedNoPrompts,
        coverage: stats,
        sample,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
