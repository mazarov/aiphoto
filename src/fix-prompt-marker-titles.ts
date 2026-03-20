/**
 * Regenerate SEO-friendly titles for ALL prompt cards from prompt text (RU/EN/DE),
 * save localized titles, regenerate slug from title_ru, and create 301 redirects.
 *
 * Usage:
 *   npx tsx src/fix-prompt-marker-titles.ts --dry-run
 *   npx tsx src/fix-prompt-marker-titles.ts --limit 100 --concurrency 4
 *   npx tsx src/fix-prompt-marker-titles.ts --include-unpublished
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { llmChat, RateLimitError } from "./lib/llm";

type Args = {
  dryRun: boolean;
  limit?: number;
  concurrency: number;
  includeUnpublished: boolean;
};

type CardRow = {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  is_published: boolean;
  card_split_index: number | null;
  card_split_total: number | null;
};

type VariantRow = {
  card_id: string;
  prompt_text_ru: string | null;
  prompt_text_en: string | null;
};

type LocalizedTitles = {
  ru: string;
  en: string;
  de: string;
};

const TITLE_MAX_LEN = 120;

const SYSTEM_PROMPT = `You are an SEO title writer for PromptShot — a catalog of ready-made AI photo generation prompts.

Users search Google/Yandex for prompts like:
- "промт девушка на яхте"
- "AI photo prompt couple in Paris"
- "KI Foto Prompt Frau im Regen"

Given the prompt text below, write 3 localized SEO titles.

FORMAT:
- RU: «Кто/Что + Где/Как + Деталь». Пример: «Девушка в вечернем платье на крыше небоскрёба»
- EN: «Who/What + Where/How + Detail». Example: «Woman in evening dress on skyscraper rooftop»
- DE: «Wer/Was + Wo/Wie + Detail». Beispiel: «Frau im Abendkleid auf Wolkenkratzer-Dach»

RULES:
- 50–120 chars each (strict)
- Start with the SUBJECT (person, object, animal)
- Include 1 distinguishing detail (location, style, mood, prop)
- Natural language — as a human would describe the photo
- No technical tokens: aspect ratios, resolution, camera params, lighting terms
- No AI instructions: "сохрани лицо", "не меняй", "create photo of"
- No generic titles: avoid just "Портрет девушки" — add what makes THIS prompt unique
- No quotes, no emojis

Return JSON only:
{"ru": "...", "en": "...", "de": "..."}`;

const CYR_MAP: Record<string, string> = {
  щ: "shch", ш: "sh", ч: "ch", ц: "ts", ж: "zh", ё: "yo", э: "e", ю: "yu", я: "ya",
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ъ: "", ы: "y", ь: "",
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let concurrency = 4;
  let includeUnpublished = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--include-unpublished") includeUnpublished = true;
    if (args[i] === "--limit") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) limit = v;
    }
    if (args[i] === "--concurrency") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) concurrency = v;
    }
  }
  return { dryRun, limit, concurrency, includeUnpublished };
}

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "landing", ".env.local"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", ".env.local"),
  ]) {
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
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function translitSlug(text: string): string {
  let s = text.toLowerCase();
  for (const [k, v] of Object.entries(CYR_MAP)) s = s.split(k).join(v);
  s = s.replace(/[^a-z0-9 \-]/g, "").replace(/[\s\-]+/g, "-").replace(/^-|-$/g, "");
  return s.slice(0, 80).replace(/-$/, "");
}

function stripNoise(s: string): string {
  return s
    .replace(/[“”«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX_LEN);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function firstPrompt(variants: VariantRow[]): string | null {
  for (const v of variants) {
    const ru = (v.prompt_text_ru || "").trim();
    if (ru) return ru;
  }
  for (const v of variants) {
    const en = (v.prompt_text_en || "").trim();
    if (en) return en;
  }
  return null;
}

async function generateLocalizedTitles(promptText: string): Promise<LocalizedTitles | null> {
  try {
    const result = await llmChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Prompt text:\n\n${promptText.slice(0, 1200)}` },
      ],
      jsonMode: true,
      maxTokens: 240,
      temperature: 0.25,
      timeoutMs: 30_000,
    });

    const parsed = parseJsonObject(result.text);
    if (!parsed) return null;

    const ruRaw = typeof parsed.ru === "string" ? parsed.ru : "";
    const enRaw = typeof parsed.en === "string" ? parsed.en : "";
    const deRaw = typeof parsed.de === "string" ? parsed.de : "";
    const ru = stripNoise(ruRaw);
    const en = stripNoise(enRaw);
    const de = stripNoise(deRaw);
    if (!ru || !en || !de) return null;
    return { ru, en, de };
  } catch (e) {
    if (e instanceof RateLimitError) return null;
    throw e;
  }
}

async function generateUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  ruTitle: string,
  cardId: string,
  splitIndex: number,
  splitTotal: number,
): Promise<string> {
  const shortId = cardId.replace(/-/g, "").slice(0, 5);
  let base = translitSlug(ruTitle);
  if (!base) base = "promt";
  if (splitTotal > 1) {
    base = `${base}-${splitIndex + 1}`;
  }
  let slug = `${base}-${shortId}`;
  let counter = 1;
  while (true) {
    const { count } = await supabase
      .from("prompt_cards")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug)
      .neq("id", cardId);
    if (!count || count === 0) break;
    counter++;
    slug = `${base}-${shortId}-${counter}`;
  }
  return slug;
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) throw new Error("Missing Supabase URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const allCards: CardRow[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,title_en,is_published,card_split_index,card_split_total")
      .range(from, from + 499);
    if (!args.includeUnpublished) query = query.eq("is_published", true);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch cards: ${error.message}`);
    if (!data || data.length === 0) break;
    allCards.push(...(data as CardRow[]));
    if (data.length < 500) break;
    from += 500;
  }

  const toProcess = args.limit ? allCards.slice(0, args.limit) : allCards;
  console.log(`\n📝 regenerate-card-seo-titles [dryRun=${args.dryRun}]`);
  console.log(`   cards found: ${allCards.length}, processing: ${toProcess.length}`);
  console.log(`   model: ${process.env.LLM_MODEL || "gpt-4.1-mini"}, concurrency: ${args.concurrency}\n`);
  if (toProcess.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  const promptMap = new Map<string, string>();
  const ids = toProcess.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { data, error } = await supabase
      .from("prompt_variants")
      .select("card_id,prompt_text_ru,prompt_text_en")
      .in("card_id", batch)
      .order("variant_index", { ascending: true });
    if (error) throw new Error(`Failed to fetch variants: ${error.message}`);

    const byCard = new Map<string, VariantRow[]>();
    for (const row of (data || []) as VariantRow[]) {
      const arr = byCard.get(row.card_id) || [];
      arr.push(row);
      byCard.set(row.card_id, arr);
    }
    for (const [cardId, variants] of byCard.entries()) {
      const text = firstPrompt(variants);
      if (text) promptMap.set(cardId, text);
    }
  }

  let success = 0;
  let failed = 0;
  let noPrompt = 0;
  let slugChanged = 0;
  let redirectsWritten = 0;
  const active = new Set<Promise<void>>();

  const processCard = async (card: CardRow) => {
    const promptText = promptMap.get(card.id);
    if (!promptText) {
      noPrompt++;
      return;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const titles = await generateLocalizedTitles(promptText);
        if (titles === null) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }

        const newSlug = await generateUniqueSlug(
          supabase,
          titles.ru,
          card.id,
          card.card_split_index ?? 0,
          card.card_split_total ?? 1,
        );

        if (!args.dryRun) {
          const { error: updateError } = await supabase.rpc("upsert_card_titles_and_slug", {
            p_card_id: card.id,
            p_title_ru: titles.ru,
            p_title_en: titles.en,
            p_title_de: titles.de,
            p_new_slug: newSlug,
          });
          if (updateError) throw new Error(updateError.message);
        }

        success++;
        if (card.slug !== newSlug) {
          slugChanged++;
          redirectsWritten++;
        }
        if (success <= 5 || success % 50 === 0) {
          console.log(`  ✓ [${success}] ${titles.ru}`);
        }
        return;
      } catch (err) {
        if (attempt === 2) {
          failed++;
          console.log(`  ✗ ${(err as Error).message.slice(0, 140)}`);
        } else {
          await sleep(1000 * (attempt + 1));
        }
      }
    }
  };

  for (const card of toProcess) {
    if (active.size >= args.concurrency) await Promise.race(active);
    const p = processCard(card).then(() => active.delete(p));
    active.add(p);
  }
  await Promise.all(active);

  console.log("\n✅ Done!");
  console.log(`   Updated titles: ${success}/${toProcess.length}`);
  console.log(`   No prompt: ${noPrompt}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Slug changed: ${slugChanged}`);
  console.log(`   Redirects upserted: ${redirectsWritten}`);
  console.log(`   Dry run: ${args.dryRun}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
