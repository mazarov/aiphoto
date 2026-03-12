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

// ── Gemini LLM classifier ──

const GEMINI_MODEL = "gemini-2.5-flash";

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

function buildResponseSchema(): object {
  const props: Record<string, object> = {};
  for (const dim of DIMENSIONS) {
    const slugs = TAG_REGISTRY.filter((t) => t.dimension === dim).map((t) => t.slug);
    props[dim] = {
      type: "ARRAY",
      items: { type: "STRING", enum: slugs },
    };
  }
  return {
    type: "OBJECT",
    properties: props,
    required: DIMENSIONS,
  };
}

const SYSTEM_PROMPT = `Ты классификатор промтов для фотогенерации.

Дан промт (title + текст). Определи, какие теги подходят.

Правила:
- Выбирай ТОЛЬКО slug'и из списка ниже
- Тег подходит, если промт ЯВНО описывает соответствующую сцену/объект/стиль/аудиторию/событие
- Для audience_tag: определяй по описанию персонажей и их отношений. Если описана женщина — ставь devushka. Если мужчина — muzhchina. Если двое вместе — para. Если описаны родственные отношения (мать+дочь, отец+сын) — ставь соответствующий тег (s_mamoy, s_dochkoy и т.д.)
- Для style_tag: определяй по технике съёмки, визуальному стилю, референсам (портрет, студийное, GTA, аниме и т.д.)
- Для object_tag: определяй по объектам, локациям, одежде, аксессуарам в кадре
- Для occasion_tag: определяй по упоминанию праздников или событий (день рождения, свадьба, 8 марта и т.д.)
- Для doc_task_tag: определяй по назначению фото (на паспорт, на аватарку, на резюме)
- Если сомневаешься — НЕ добавляй тег. Точность важнее полноты.
- Верни пустой массив для измерения, если ничего не подходит.

Доступные теги:
${buildTagListForPrompt()}`;

async function classifyWithGemini(
  apiKey: string,
  title: string | null,
  promptTexts: string[],
): Promise<SeoTags | null> {
  const userText = [
    title ? `Название: ${title}` : "",
    `Промт:\n${promptTexts.join("\n---\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const body = {
    contents: [
      { role: "user", parts: [{ text: userText }] },
    ],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(),
      maxOutputTokens: 512,
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    return null; // caller will retry
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  // Gemini may prefix JSON with thinking text — extract JSON object
  let jsonStr = rawText;
  const jsonStart = rawText.indexOf("{");
  const jsonEnd = rawText.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(jsonStr) as Record<string, string[]>;

  const result: SeoTags = {
    audience_tag: [],
    style_tag: [],
    occasion_tag: [],
    object_tag: [],
    doc_task_tag: [],
    labels: { ru: [], en: [] },
  };

  let invalidCount = 0;
  for (const dim of DIMENSIONS) {
    const arr = parsed[dim];
    if (!Array.isArray(arr)) continue;
    const validSet = VALID_SLUGS_BY_DIM.get(dim)!;
    for (const slug of arr) {
      if (typeof slug === "string" && validSet.has(slug)) {
        result[dim].push(slug);
      } else {
        invalidCount++;
      }
    }
  }

  if (invalidCount > 0) {
    console.warn(`  ⚠ ${invalidCount} invalid slugs filtered from Gemini response`);
  }

  fillLabels(result);
  return result;
}

async function classifyWithRetry(
  apiKey: string,
  title: string | null,
  promptTexts: string[],
  maxRetries = 3,
): Promise<SeoTags | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await classifyWithGemini(apiKey, title, promptTexts);
      if (result !== null) return result;
      // rate limited — wait and retry
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
        console.error(`  ✗ Gemini failed: ${msg.slice(0, 100)}`);
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

  const geminiApiKey = args.regexOnly ? "" : (process.env.GEMINI_API_KEY || "");
  if (!args.regexOnly && !geminiApiKey) {
    console.warn("⚠ GEMINI_API_KEY not set, falling back to regex mode");
    args.regexOnly = true;
  }

  const mode = args.regexOnly ? "regex" : "llm";
  console.log(`\n🏷️  fill-seo-tags [mode=${mode}] [dryRun=${args.dryRun}] [recompute=${args.recomputeAll}]`);
  if (args.dataset) console.log(`   dataset: ${args.dataset}`);
  if (args.cardId) console.log(`   cardId: ${args.cardId}`);
  if (!args.regexOnly) console.log(`   model: ${GEMINI_MODEL}, concurrency: ${args.concurrency}`);

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

    const processCard = async (card: CardRow) => {
      const prompts = promptMap.get(card.id) || [];
      if (prompts.length === 0) { skippedNoPrompts++; return; }

      await sem.acquire();
      try {
        const seoTags = await classifyWithRetry(geminiApiKey, card.title_ru, prompts);
        if (!seoTags) {
          llmFailed++;
          // Fallback to regex
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
