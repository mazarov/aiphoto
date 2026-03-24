/**
 * Runtime SEO tag classification for UGC publish (aligned with src/fill-seo-tags.ts).
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise regex over TAG_REGISTRY.
 */
import { TAG_REGISTRY, type Dimension } from "@/lib/tag-registry";

const DIMENSIONS: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

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

const SLUG_LABELS = Object.fromEntries(
  TAG_REGISTRY.map((t) => [t.slug, { ru: t.labelRu.toLowerCase(), en: t.labelEn.toLowerCase() }])
);

const VALID_SLUGS_BY_DIM = new Map<Dimension, Set<string>>();
for (const dim of DIMENSIONS) {
  VALID_SLUGS_BY_DIM.set(dim, new Set(TAG_REGISTRY.filter((t) => t.dimension === dim).map((t) => t.slug)));
}

const TAG_ALIASES: Record<string, string> = {
  chernо_beloe: "cherno_beloe",
  s_iphone: "iphone",
  s_snegom: "sneg",
  fotorealistichnoe: "fotorealizm",
  s_buketom: "s_cvetami",
};

function normalizeTagSlug(slug: string): string {
  return TAG_ALIASES[slug] ?? slug;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

export function computeSeoReadinessScore(seoTags: SeoTags): number {
  let score = 0;
  for (const dim of DIMENSIONS) {
    if (seoTags[dim].length > 0) score += 20;
  }
  return Math.min(100, score);
}

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
- A good new tag is something a user would SEARCH for on Google/Yandex
- The slug must be latin snake_case transliteration of the Russian concept
- Provide labelRu and labelEn
- Place new slugs in the corresponding dimension arrays AND in the "new_tags" metadata array

DO NOT create tags for: generic clothing, camera params, AI instructions, hair/skin, micro-textures, lighting-only, emotions-only, pose-only.

IMPORTANT — Use existing slugs, do NOT create duplicates (devushka, muzhchina, cherno_beloe, iphone, sneg, etc.).

Precision > recall for new tags.

Known tags:
${buildTagListForPrompt()}
${buildJsonFormatInstruction()}`;

class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
  }
}

async function llmChatJson(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "gpt-4.1-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) throw new RateLimitError("429");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

async function classifyWithLlm(title: string | null, promptTexts: string[]): Promise<ClassifyResult | null> {
  const userText = [
    title ? `Title: ${title}` : "",
    `Prompt:\n${promptTexts.join("\n---\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let rawText: string;
  try {
    rawText = await llmChatJson([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userText },
    ]);
  } catch (e) {
    if (e instanceof RateLimitError) return null;
    throw e;
  }

  if (!rawText) return null;

  let jsonStr = rawText;
  const jsonStart = rawText.indexOf("{");
  const jsonEnd = rawText.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  const seoResult: SeoTags = {
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
      const normalized = normalizeTagSlug(slug);
      if (!seoResult[dim].includes(normalized)) {
        seoResult[dim].push(normalized);
      }
      if (!validSet.has(normalized)) {
        const meta =
          newTagSlugsRaw.get(`${dim}:${slug}`) ?? newTagSlugsRaw.get(`${dim}:${normalized}`);
        if (meta) {
          newTagsMeta.push({ ...meta, slug: normalized });
        } else {
          newTagsMeta.push({
            slug: normalized,
            dimension: dim,
            labelRu: normalized,
            labelEn: normalized,
          });
        }
      }
    }
  }

  fillLabels(seoResult);
  return { seoTags: seoResult, newTags: newTagsMeta };
}

async function classifyWithRetry(
  title: string | null,
  promptTexts: string[],
  maxRetries = 2,
): Promise<ClassifyResult | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await classifyWithLlm(title, promptTexts);
      if (result !== null) return result;
      const delay = 2000 * (attempt + 1);
      await sleep(delay);
    } catch {
      if (attempt === maxRetries - 1) return null;
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

/** Returns JSON-serializable seo_tags + readiness score (same shape as fill-seo-tags DB updates). */
export async function classifySeoTagsForPublish(
  title: string | null,
  promptTexts: string[],
): Promise<{ seo_tags: Record<string, unknown>; seo_readiness_score: number }> {
  if (promptTexts.length === 0) {
    const empty: SeoTags = {
      audience_tag: [],
      style_tag: [],
      occasion_tag: [],
      object_tag: [],
      doc_task_tag: [],
      labels: { ru: [], en: [] },
    };
    return { seo_tags: empty as unknown as Record<string, unknown>, seo_readiness_score: 0 };
  }

  if (!process.env.OPENAI_API_KEY) {
    const regexTags = extractSeoTagsRegex(promptTexts, title);
    return {
      seo_tags: regexTags as unknown as Record<string, unknown>,
      seo_readiness_score: computeSeoReadinessScore(regexTags),
    };
  }

  try {
    const result = await classifyWithRetry(title, promptTexts);
    if (result) {
      return {
        seo_tags: result.seoTags as unknown as Record<string, unknown>,
        seo_readiness_score: computeSeoReadinessScore(result.seoTags),
      };
    }
  } catch (err) {
    console.warn("[seo-tags-classify] LLM failed, regex fallback", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const regexTags = extractSeoTagsRegex(promptTexts, title);
  return {
    seo_tags: regexTags as unknown as Record<string, unknown>,
    seo_readiness_score: computeSeoReadinessScore(regexTags),
  };
}
