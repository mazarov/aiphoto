/**
 * Fill seo_tags for prompt_cards using LLM (Gemini 2.5 Flash) or regex fallback.
 * Source of truth: TAG_REGISTRY from landing/src/lib/tag-registry.ts
 * Output: prompt_cards.seo_tags (jsonb), seo_readiness_score (0-100)
 *
 * Usage:
 *   npx tsx src/fill-seo-tags.ts --recompute-all          # LLM for all cards
 *   npx tsx src/fill-seo-tags.ts --recompute-all --dry-run # Preview without saving
 *   npx tsx src/fill-seo-tags.ts --regex-only              # Regex fallback only
 *   npx tsx src/fill-seo-tags.ts --card-id <uuid>          # Single card
 *   npx tsx src/fill-seo-tags.ts --limit 10 --dry-run      # First 10 cards
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TAG_REGISTRY, type Dimension, type TagEntry } from "../landing/src/lib/tag-registry";
import { llmChat, RateLimitError } from "./lib/llm";

// ── Types ──

type Args = {
  dryRun: boolean;
  limit?: number;
  batchSize: number;
  dataset?: string;
  recomputeAll: boolean;
  cardId?: string;
  regexOnly: boolean;
  concurrency: number;
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

type SeoTags = {
  audience_tag: string[];
  style_tag: string[];
  occasion_tag: string[];
  object_tag: string[];
  doc_task_tag: string[];
  labels: { ru: string[]; en: string[] };
};

type NewTagMeta = {
  slug: string;
  dimension: Dimension;
  labelRu: string;
  labelEn: string;
};

type ClassifyResult = {
  seoTags: SeoTags;
  newTags: NewTagMeta[];
};

const DIMENSIONS: Dimension[] = ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"];

const SLUG_LABELS = Object.fromEntries(
  TAG_REGISTRY.map((t) => [t.slug, { ru: t.labelRu.toLowerCase(), en: t.labelEn.toLowerCase() }])
);

const VALID_SLUGS_BY_DIM = new Map<Dimension, Set<string>>();
for (const dim of DIMENSIONS) {
  VALID_SLUGS_BY_DIM.set(dim, new Set(TAG_REGISTRY.filter((t) => t.dimension === dim).map((t) => t.slug)));
}

// ── CLI args ──

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let batchSize = 200;
  let dataset: string | undefined;
  let recomputeAll = false;
  let cardId: string | undefined;
  let regexOnly = false;
  let concurrency = 5;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--dry-run") dryRun = true;
    if (token === "--recompute-all") recomputeAll = true;
    if (token === "--regex-only") regexOnly = true;
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
    if (token === "--concurrency") {
      const val = Number(args[i + 1]);
      if (Number.isFinite(val) && val > 0) concurrency = val;
    }
  }

  if (cardId) {
    return { dryRun, limit: 1, batchSize: 1, dataset, recomputeAll: true, cardId, regexOnly, concurrency };
  }
  return { dryRun, limit, batchSize, dataset, recomputeAll, regexOnly, concurrency };
}

// ── Env ──

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "landing", ".env.local"),
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

// ── Helpers ──

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Regex extractor (fallback) ──

function extractSeoTagsRegex(promptTexts: string[], title: string | null): SeoTags {
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

  fillLabels(result);
  return result;
}

function fillLabels(tags: SeoTags): void {
  const allSlugs = [
    ...tags.audience_tag,
    ...tags.style_tag,
    ...tags.occasion_tag,
    ...tags.object_tag,
    ...tags.doc_task_tag,
  ];
  if (allSlugs.length > 0) {
    const ruParts = allSlugs.map((s) => SLUG_LABELS[s]?.ru ?? s).slice(0, 3);
    const enParts = allSlugs.map((s) => SLUG_LABELS[s]?.en ?? s).slice(0, 3);
    tags.labels.ru = [`Промт для фото ${ruParts.join(", ")}`];
    tags.labels.en = [`Photo prompt: ${enParts.join(", ")}`];
  }
}

// ── LLM classifier ──

function buildTagListForPrompt(): string {
  const lines: string[] = [];
  for (const dim of DIMENSIONS) {
    const dimTags = TAG_REGISTRY.filter((t) => t.dimension === dim);
    lines.push(`\n${dim}:`);
    for (const t of dimTags) {
      lines.push(`  ${t.slug} — ${t.labelRu} (${t.labelEn})`);
    }
  }
  return lines.join("\n");
}

function buildJsonFormatInstruction(): string {
  return `
Respond with a JSON object (no markdown fences). Schema:
{
  "audience_tag": ["slug1", ...],
  "style_tag": ["slug1", ...],
  "occasion_tag": ["slug1", ...],
  "object_tag": ["slug1", ...],
  "doc_task_tag": ["slug1", ...],
  "new_tags": [{ "slug": "...", "dimension": "...", "labelRu": "...", "labelEn": "..." }, ...]
}`;
}

const SYSTEM_PROMPT = `You are a photo prompt classifier for an SEO-driven photo prompt catalog.

Given a prompt (title + text in Russian), assign ALL relevant tags across 5 dimensions.

STEP 1 — Use KNOWN tags from the list below whenever they match.
STEP 2 — If the prompt describes a scene, location, style, or subject NOT covered by the known tags, CREATE a new tag.

Rules for KNOWN tags:
- A tag is relevant if the prompt EXPLICITLY describes the corresponding scene/object/style/audience/event
- For audience_tag: determine by character descriptions and relationships. Woman = devushka. Man = muzhchina. Two together = para. Family relationships = corresponding tag (s_mamoy, s_dochkoy, etc.)
- For style_tag: determine by shooting technique, visual style, references (portrait, studio, GTA, anime, etc.)
- For object_tag: determine by objects, locations, clothing category, accessories in the scene
- For occasion_tag: determine by mentions of holidays or events
- For doc_task_tag: determine by the purpose of the photo

Rules for NEW tags:
- A good new tag is something a user would SEARCH for: "photo prompt in elevator", "photo prompt at gym", "photo prompt vintage style"
- The slug must be latin snake_case transliteration of the Russian concept (e.g. v_lifte, v_sportale, s_sharami, kinematograficheskoe)
- Provide labelRu (Russian, user-facing, e.g. "В лифте") and labelEn (English, e.g. "In elevator")
- The tag should apply to at least several different prompts, not be unique to one specific photo
- Place new slugs in the corresponding dimension arrays AND in the "new_tags" metadata array

DO NOT create tags for:
- Specific clothing items or colors (chernyy_top, rozovyy_sviter)
- Camera/technical parameters (8k, raw, bokeh, malaya_glubina_rezkosti)
- Generation instructions (bez_retushi, sohranit_vneshnost, bez_stilizatsii)
- Appearance details (raspushchennye_volosy, naturalnyy_makiyazh, siyanie_kozhi)
- Textures and micro-details (pory_dereva, volokna_tkani, pushkovye_voloski)
- Lighting/shadow descriptions (myagkiy_svet, kontrastnyy_svet, glubokie_teni)
- Emotional expressions (spokoynaya_ulybka, zagadochnyy_vzglyad)
- Pose descriptions (ruka_nad_golovoy, vzglyad_v_kameru)

When in doubt — DO NOT add the tag. Precision is more important than recall.
Return an empty array for a dimension if nothing matches.
Return an empty "new_tags" array if all assigned tags are from the known list.

Known tags:
${buildTagListForPrompt()}
${buildJsonFormatInstruction()}`;

async function classifyWithLlm(
  title: string | null,
  promptTexts: string[],
): Promise<ClassifyResult | null> {
  const userText = [
    title ? `Title: ${title}` : "",
    `Prompt:\n${promptTexts.join("\n---\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let result;
  try {
    result = await llmChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      jsonMode: true,
      maxTokens: 1024,
      temperature: 0.1,
      timeoutMs: 30_000,
    });
  } catch (e) {
    if (e instanceof RateLimitError) return null;
    throw e;
  }

  const rawText = result.text;
  if (!rawText) return null;

  let jsonStr = rawText;
  const jsonStart = rawText.indexOf("{");
  const jsonEnd = rawText.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  const result: SeoTags = {
    audience_tag: [],
    style_tag: [],
    occasion_tag: [],
    object_tag: [],
    doc_task_tag: [],
    labels: { ru: [], en: [] },
  };

  const newTagsMeta: NewTagMeta[] = [];
  const newTagSlugsRaw = new Map<string, NewTagMeta>();

  const rawNewTags = parsed["new_tags"];
  if (Array.isArray(rawNewTags)) {
    for (const nt of rawNewTags) {
      if (nt && typeof nt === "object" && typeof nt.slug === "string" && typeof nt.dimension === "string") {
        const dim = nt.dimension as Dimension;
        if (DIMENSIONS.includes(dim)) {
          newTagSlugsRaw.set(`${dim}:${nt.slug}`, {
            slug: nt.slug,
            dimension: dim,
            labelRu: typeof nt.labelRu === "string" ? nt.labelRu : nt.slug,
            labelEn: typeof nt.labelEn === "string" ? nt.labelEn : nt.slug,
          });
        }
      }
    }
  }

  for (const dim of DIMENSIONS) {
    const arr = parsed[dim];
    if (!Array.isArray(arr)) continue;
    const validSet = VALID_SLUGS_BY_DIM.get(dim)!;
    for (const slug of arr) {
      if (typeof slug !== "string" || !slug) continue;
      result[dim].push(slug);
      if (!validSet.has(slug)) {
        const meta = newTagSlugsRaw.get(`${dim}:${slug}`);
        if (meta) {
          newTagsMeta.push(meta);
        } else {
          newTagsMeta.push({ slug, dimension: dim, labelRu: slug, labelEn: slug });
        }
      }
    }
  }

  fillLabels(result);
  return { seoTags: result, newTags: newTagsMeta };
}

async function classifyWithRetry(
  title: string | null,
  promptTexts: string[],
  maxRetries = 3,
): Promise<ClassifyResult | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await classifyWithLlm(title, promptTexts);
      if (result !== null) return result;
      const delay = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`  ⏳ Rate limited, retrying in ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries - 1 && (msg.includes("429") || msg.includes("500") || msg.includes("503"))) {
        const delay = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`  ⏳ Error (${msg.slice(0, 60)}), retrying in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
      } else {
        console.error(`  ✗ LLM failed: ${msg.slice(0, 100)}`);
        return null;
      }
    }
  }
  return null;
}

// ── Concurrency control ──

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// ── Score ──

function computeSeoReadinessScore(seoTags: SeoTags): number {
  let score = 0;
  for (const dim of DIMENSIONS) {
    if (seoTags[dim].length > 0) score += 20;
  }
  return Math.min(100, score);
}

// ── Data fetching ──

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
    const isRetryable = String(error.message).includes("502") || String(error.message).includes("503");
    if (isRetryable && i < retries - 1) {
      await sleep(2000 * (i + 1));
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
    if (i > 0) await sleep(300);
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

// ── Main ──

async function main() {
  const args = parseArgs();
  loadEnvFiles();

  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl) throw new Error("Missing Supabase URL env");

  if (!args.regexOnly && !process.env.OPENAI_API_KEY) {
    console.warn("⚠ OPENAI_API_KEY not set, falling back to regex mode");
    args.regexOnly = true;
  }

  const mode = args.regexOnly ? "regex" : "llm";
  console.log(`\n🏷️  fill-seo-tags [mode=${mode}] [dryRun=${args.dryRun}] [recompute=${args.recomputeAll}]`);
  if (args.dataset) console.log(`   dataset: ${args.dataset}`);
  if (args.cardId) console.log(`   cardId: ${args.cardId}`);
  if (!args.regexOnly) console.log(`   model: ${process.env.LLM_MODEL || "gpt-4.1-mini"}, concurrency: ${args.concurrency}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const cards = await fetchCardsToProcess(
    supabase, args.batchSize, args.limit, args.dataset, args.recomputeAll, args.cardId,
  );
  if (cards.length === 0) {
    console.log("✓ No cards to process. Use --recompute-all to process all.");
    return;
  }
  console.log(`📋 Found ${cards.length} cards to process\n`);

  const promptMap = await fetchPromptTextsByCardIds(supabase, cards.map((c) => c.id));

  let updated = 0;
  let skippedNoPrompts = 0;
  let llmFailed = 0;
  let totalTagCount = 0;
  const stats = { audience: 0, style: 0, occasion: 0, object: 0, doc_task: 0 };
  const sample: Array<{ id: string; title: string | null; seo_tags: SeoTags; score: number }> = [];

  if (args.regexOnly) {
    // Sequential regex processing
    for (const card of cards) {
      const prompts = promptMap.get(card.id) || [];
      if (prompts.length === 0) { skippedNoPrompts++; continue; }

      const seoTags = extractSeoTagsRegex(prompts, card.title_ru);
      const score = computeSeoReadinessScore(seoTags);
      updateStats(stats, seoTags);
      totalTagCount += countTags(seoTags);
      if (sample.length < 5) sample.push({ id: card.id, title: card.title_ru, seo_tags: seoTags, score });

      if (!args.dryRun) {
        const { error } = await supabase
          .from("prompt_cards")
          .update({ seo_tags: seoTags, seo_readiness_score: score })
          .eq("id", card.id);
        if (error) throw new Error(`Failed update card ${card.id}: ${error.message}`);
      }
      updated++;
      if (updated % 50 === 0) console.log(`  ⏳ ${updated}/${cards.length} processed...`);
    }
  } else {
    // LLM with concurrency
    const sem = new Semaphore(args.concurrency);
    let processed = 0;
    const allNewTags = new Map<string, { meta: NewTagMeta; count: number }>();

    const processCard = async (card: CardRow) => {
      const prompts = promptMap.get(card.id) || [];
      if (prompts.length === 0) { skippedNoPrompts++; return; }

      await sem.acquire();
      try {
        const result = await classifyWithRetry(card.title_ru, prompts);
        if (!result) {
          llmFailed++;
          const fallback = extractSeoTagsRegex(prompts, card.title_ru);
          const score = computeSeoReadinessScore(fallback);
          if (!args.dryRun) {
            await supabase.from("prompt_cards")
              .update({ seo_tags: fallback, seo_readiness_score: score })
              .eq("id", card.id);
          }
          updateStats(stats, fallback);
          totalTagCount += countTags(fallback);
          updated++;
          return;
        }

        const { seoTags, newTags } = result;

        for (const nt of newTags) {
          const key = `${nt.dimension}:${nt.slug}`;
          const existing = allNewTags.get(key);
          if (existing) {
            existing.count++;
            if (nt.labelRu !== nt.slug) existing.meta = nt;
          } else {
            allNewTags.set(key, { meta: nt, count: 1 });
          }
        }

        const score = computeSeoReadinessScore(seoTags);
        updateStats(stats, seoTags);
        totalTagCount += countTags(seoTags);
        if (sample.length < 5) sample.push({ id: card.id, title: card.title_ru, seo_tags: seoTags, score });

        if (!args.dryRun) {
          const { error } = await supabase
            .from("prompt_cards")
            .update({ seo_tags: seoTags, seo_readiness_score: score })
            .eq("id", card.id);
          if (error) throw new Error(`Failed update card ${card.id}: ${error.message}`);
        }
        updated++;
      } finally {
        sem.release();
        processed++;
        if (processed % 50 === 0) console.log(`  ⏳ ${processed}/${cards.length} processed...`);
      }
    };

    await Promise.all(cards.map(processCard));

    // Report and auto-append new tags
    const MIN_COUNT_FOR_REGISTRY = 3;
    const qualifiedNewTags = [...allNewTags.entries()]
      .filter(([, v]) => v.count >= MIN_COUNT_FOR_REGISTRY)
      .sort((a, b) => b[1].count - a[1].count);

    if (allNewTags.size > 0) {
      console.log(`\n🆕 New tags discovered: ${allNewTags.size} unique`);
      const sorted = [...allNewTags.entries()].sort((a, b) => b[1].count - a[1].count);
      for (const [key, { meta, count }] of sorted.slice(0, 30)) {
        const marker = count >= MIN_COUNT_FOR_REGISTRY ? "✅" : "  ";
        console.log(`   ${marker} ${String(count).padStart(3)}x  ${key}  "${meta.labelRu}" / "${meta.labelEn}"`);
      }
      if (sorted.length > 30) console.log(`   ... and ${sorted.length - 30} more`);
      console.log(`   Qualified for TAG_REGISTRY (>=${MIN_COUNT_FOR_REGISTRY} cards): ${qualifiedNewTags.length}`);
    }

    if (qualifiedNewTags.length > 0 && !args.dryRun) {
      appendNewTagsToRegistry(qualifiedNewTags.map(([, v]) => v.meta));
    }
  }

  const total = cards.length - skippedNoPrompts;
  console.log(`\n✅ Done!`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Processed: ${updated}/${cards.length} (${skippedNoPrompts} skipped - no prompts)`);
  if (llmFailed > 0) console.log(`   LLM failed (fell back to regex): ${llmFailed}`);
  console.log(`   Avg tags/card: ${total > 0 ? (totalTagCount / total).toFixed(1) : 0}`);
  console.log(`   Coverage:`);
  console.log(`     audience: ${stats.audience}/${total} (${pct(stats.audience, total)})`);
  console.log(`     style:    ${stats.style}/${total} (${pct(stats.style, total)})`);
  console.log(`     occasion: ${stats.occasion}/${total} (${pct(stats.occasion, total)})`);
  console.log(`     object:   ${stats.object}/${total} (${pct(stats.object, total)})`);
  console.log(`     doc_task: ${stats.doc_task}/${total} (${pct(stats.doc_task, total)})`);
  console.log(`   Dry run: ${args.dryRun}`);

  if (sample.length > 0) {
    console.log(`\n📝 Sample results:`);
    for (const s of sample) {
      const dims = DIMENSIONS.map((d) => s.seo_tags[d].length > 0 ? `${d}=[${s.seo_tags[d].join(",")}]` : null).filter(Boolean);
      console.log(`   ${s.title ?? "?"} (score=${s.score}): ${dims.join(" ")}`);
    }
  }
}

// ── Auto-append new tags to TAG_REGISTRY file ──

const URL_PATH_PREFIXES: Record<Dimension, string> = {
  audience_tag: "/promty-dlya-foto-",
  style_tag: "/stil/",
  occasion_tag: "/sobytiya/",
  object_tag: "/",
  doc_task_tag: "/foto-",
};

function slugToUrlPath(dim: Dimension, slug: string): string {
  const prefix = URL_PATH_PREFIXES[dim];
  const urlSlug = slug.replace(/_/g, "-");
  return `${prefix}${urlSlug}`;
}

function appendNewTagsToRegistry(tags: NewTagMeta[]): void {
  const registryPath = path.resolve(process.cwd(), "landing/src/lib/tag-registry.ts");
  const { readFileSync, writeFileSync } = require("node:fs") as typeof import("node:fs");

  const content = readFileSync(registryPath, "utf-8");

  const existingSlugs = new Set(TAG_REGISTRY.map((t) => `${t.dimension}:${t.slug}`));
  const toAdd = tags.filter((t) => !existingSlugs.has(`${t.dimension}:${t.slug}`));

  if (toAdd.length === 0) {
    console.log("   No new tags to append (all already exist).");
    return;
  }

  const grouped = new Map<Dimension, NewTagMeta[]>();
  for (const t of toAdd) {
    const arr = grouped.get(t.dimension) || [];
    arr.push(t);
    grouped.set(t.dimension, arr);
  }

  const newLines: string[] = [];
  newLines.push("\n  // ── LLM-discovered tags ──");
  for (const dim of DIMENSIONS) {
    const dimTags = grouped.get(dim);
    if (!dimTags) continue;
    for (const t of dimTags) {
      const urlPath = slugToUrlPath(dim, t.slug);
      const escapedRu = t.labelRu.replace(/"/g, '\\"');
      const escapedEn = t.labelEn.replace(/"/g, '\\"');
      newLines.push(`  { slug: "${t.slug}", dimension: "${dim}", labelRu: "${escapedRu}", labelEn: "${escapedEn}", urlPath: "${urlPath}", patterns: [] },`);
    }
  }

  const marker = "export const TAG_REGISTRY: TagEntry[] = [";
  const markerIdx = content.indexOf(marker);
  if (markerIdx === -1) {
    console.error("   ✗ Could not find TAG_REGISTRY declaration");
    return;
  }

  const searchFrom = markerIdx + marker.length;
  let depth = 1;
  let insertPoint = -1;
  for (let i = searchFrom; i < content.length; i++) {
    if (content[i] === "[") depth++;
    else if (content[i] === "]") {
      depth--;
      if (depth === 0) { insertPoint = i; break; }
    }
  }
  if (insertPoint === -1) {
    console.error("   ✗ Could not find TAG_REGISTRY closing bracket");
    return;
  }

  const before = content.slice(0, insertPoint);
  const after = content.slice(insertPoint);

  const updated = before + newLines.join("\n") + "\n" + after;
  writeFileSync(registryPath, updated, "utf-8");

  console.log(`\n📝 Appended ${toAdd.length} new tags to TAG_REGISTRY:`);
  for (const t of toAdd) {
    console.log(`   + ${t.dimension}:${t.slug} — "${t.labelRu}" / "${t.labelEn}"`);
  }
}

function countTags(seoTags: SeoTags): number {
  return DIMENSIONS.reduce((sum, dim) => sum + seoTags[dim].length, 0);
}

function updateStats(stats: { audience: number; style: number; occasion: number; object: number; doc_task: number }, seoTags: SeoTags) {
  if (seoTags.audience_tag.length > 0) stats.audience++;
  if (seoTags.style_tag.length > 0) stats.style++;
  if (seoTags.occasion_tag.length > 0) stats.occasion++;
  if (seoTags.object_tag.length > 0) stats.object++;
  if (seoTags.doc_task_tag.length > 0) stats.doc_task++;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
