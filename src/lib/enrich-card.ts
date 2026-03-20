/**
 * Single LLM call to enrich a parsed card with:
 * - SEO titles in ru/en/de
 * - Prompt translations to en/de
 *
 * Used by ingest pipeline to fully prepare a card before DB insert.
 */
import { llmChat, RateLimitError } from "./llm";

export interface EnrichInput {
  titleRu: string;
  promptTextRu: string;
  promptTextEn: string | null;
}

export interface EnrichResult {
  titleRu: string;
  titleEn: string;
  titleDe: string;
  promptEn: string;
  promptDe: string;
}

const TITLE_MAX_LEN = 150;

const SYSTEM_PROMPT = `You are an SEO title writer and professional translator for an AI photo prompt catalog.

Given a photo generation prompt (in Russian and optionally English), return:
1. SEO-friendly titles in 3 languages (ru, en, de)
2. Full prompt translation to English and German

Rules for titles:
- Max 150 chars each, prefer 45-110 chars
- Human-readable, specific, search-friendly
- Describe subject + scene/style
- No technical tokens: 9:16, 8K, f/1.8, RAW, HDR, lens params
- No generation instructions like "не меняй черты лица"
- No quotes or emojis

Rules for prompt translations:
- Keep the meaning and all style instructions intact
- Use natural phrasing, not word-by-word translation
- Preserve technical terms commonly used as-is (e.g. bokeh, HDR)
- Keep formatting: line breaks, comma-separated parts
- Return ONLY the translated text for each field

Return JSON only:
{
  "title_ru": "...",
  "title_en": "...",
  "title_de": "...",
  "prompt_en": "...",
  "prompt_de": "..."
}`;

function stripNoise(s: string): string {
  return s
    .replace(/[""«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX_LEN);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function enrichCard(input: EnrichInput): Promise<EnrichResult | null> {
  const parts: string[] = [];
  parts.push(`Title (RU): ${input.titleRu}`);
  parts.push(`\nPrompt (RU):\n${input.promptTextRu.slice(0, 1500)}`);
  if (input.promptTextEn) {
    parts.push(`\nPrompt (EN, reference):\n${input.promptTextEn.slice(0, 1500)}`);
  }

  try {
    const result = await llmChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: parts.join("\n") },
      ],
      jsonMode: true,
      maxTokens: 2048,
      temperature: 0.2,
      timeoutMs: 45_000,
    });

    const parsed = parseJsonObject(result.text);
    if (!parsed) return null;

    const titleRu = typeof parsed.title_ru === "string" ? stripNoise(parsed.title_ru) : "";
    const titleEn = typeof parsed.title_en === "string" ? stripNoise(parsed.title_en) : "";
    const titleDe = typeof parsed.title_de === "string" ? stripNoise(parsed.title_de) : "";
    const promptEn = typeof parsed.prompt_en === "string" ? parsed.prompt_en.trim() : "";
    const promptDe = typeof parsed.prompt_de === "string" ? parsed.prompt_de.trim() : "";

    if (!titleRu || !titleEn || !titleDe || !promptEn || !promptDe) return null;

    return { titleRu, titleEn, titleDe, promptEn, promptDe };
  } catch (e) {
    if (e instanceof RateLimitError) return null;
    throw e;
  }
}

export async function enrichCardWithRetry(
  input: EnrichInput,
  maxRetries = 3,
): Promise<EnrichResult | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await enrichCard(input);
      if (result !== null) return result;
      const delay = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
      await sleep(delay);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries - 1 && (msg.includes("429") || msg.includes("500") || msg.includes("503"))) {
        const delay = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  return null;
}
