/**
 * Translate English-only prompt variants to Russian using Gemini LLM.
 * Targets prompt_variants where prompt_text_ru is empty but prompt_text_en has content.
 *
 * Usage:
 *   npx tsx src/translate-en-prompts.ts --dataset bananogenpromt_ChatExport_2026-03-13
 *   npx tsx src/translate-en-prompts.ts --dataset bananogenpromt_ChatExport_2026-03-13 --dry-run
 *   npx tsx src/translate-en-prompts.ts --dataset bananogenpromt_ChatExport_2026-03-13 --limit 10
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { llmChat, RateLimitError } from "./lib/llm";

type Args = {
  dataset?: string;
  dryRun: boolean;
  limit?: number;
  concurrency: number;
};

type VariantRow = {
  id: string;
  card_id: string;
  prompt_text_en: string;
  prompt_text_ru: string | null;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let dataset: string | undefined;
  let concurrency = 5;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "--dry-run") dryRun = true;
    if (token === "--dataset") dataset = args[i + 1] ?? undefined;
    if (token === "--limit") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) limit = v;
    }
    if (token === "--concurrency") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v > 0) concurrency = v;
    }
  }
  if (!dataset) throw new Error("Missing --dataset");
  return { dataset, dryRun, limit, concurrency };
}

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "landing", ".env.local"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", ".env.local"),
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const SYSTEM_PROMPT = `You are a professional translator for a photo prompt catalog.

Translate the given English photo generation prompt into natural Russian.

Rules:
- Keep the meaning and style instructions intact
- Use natural Russian phrasing, not word-by-word translation
- Preserve technical terms that are commonly used in Russian as-is (e.g. bokeh, HDR)
- Keep formatting: if the original has line breaks or commas separating parts, maintain that structure
- Do NOT add explanations, just return the translated prompt text
- Return ONLY the translated text, nothing else`;

async function translateWithLlm(promptEn: string): Promise<string | null> {
  try {
    const result = await llmChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Translate this photo prompt to Russian:\n\n${promptEn}` },
      ],
      maxTokens: 2048,
      temperature: 0.2,
      timeoutMs: 30_000,
    });
    return result.text.trim() || null;
  } catch (e) {
    if (e instanceof RateLimitError) return null;
    throw e;
  }
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();

  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) throw new Error("Missing Supabase URL env");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Fetch card IDs for dataset
  const cardIds: string[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("prompt_cards")
      .select("id")
      .eq("source_dataset_slug", args.dataset!)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    cardIds.push(...data.map((c) => c.id));
    if (data.length < 1000) break;
    from += 1000;
  }

  // Fetch EN-only variants
  const enOnlyVariants: VariantRow[] = [];
  for (let i = 0; i < cardIds.length; i += 50) {
    const batch = cardIds.slice(i, i + 50);
    const { data } = await supabase
      .from("prompt_variants")
      .select("id, card_id, prompt_text_en, prompt_text_ru")
      .in("card_id", batch)
      .or("prompt_text_ru.is.null,prompt_text_ru.eq.");
    if (data) {
      for (const v of data) {
        if (v.prompt_text_en && v.prompt_text_en.trim()) {
          enOnlyVariants.push(v as VariantRow);
        }
      }
    }
  }

  const toProcess = args.limit ? enOnlyVariants.slice(0, args.limit) : enOnlyVariants;

  // eslint-disable-next-line no-console
  console.log(`\n🔤 translate-en-prompts [dryRun=${args.dryRun}]`);
  // eslint-disable-next-line no-console
  console.log(`   dataset: ${args.dataset}`);
  // eslint-disable-next-line no-console
  console.log(`   EN-only variants: ${enOnlyVariants.length}, processing: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Nothing to translate.");
    return;
  }

  let success = 0;
  let failed = 0;
  let rateLimited = 0;
  const errors: string[] = [];

  const queue = [...toProcess];
  const active = new Set<Promise<void>>();

  const processOne = async (variant: VariantRow) => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const translated = await translateWithLlm(variant.prompt_text_en);

        if (translated === null) {
          rateLimited++;
          const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
          // eslint-disable-next-line no-console
          console.log(`  ⏳ Rate limited, retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }

        if (!args.dryRun) {
          const { error } = await supabase
            .from("prompt_variants")
            .update({
              prompt_text_ru: translated,
              prompt_normalized_ru: translated,
            })
            .eq("id", variant.id);
          if (error) throw new Error(error.message);
        }

        success++;
        if (success <= 3 || success % 50 === 0) {
          const preview = translated.slice(0, 80).replace(/\n/g, " ");
          // eslint-disable-next-line no-console
          console.log(`  ✓ [${success}] ${preview}...`);
        }
        return;
      } catch (err) {
        if (attempt === maxRetries - 1) {
          failed++;
          const msg = (err as Error).message.slice(0, 100);
          errors.push(`${variant.id}: ${msg}`);
          // eslint-disable-next-line no-console
          console.log(`  ✗ ${msg}`);
        } else {
          await sleep(1000 * (attempt + 1));
        }
      }
    }
  };

  for (const variant of queue) {
    if (active.size >= args.concurrency) {
      await Promise.race(active);
    }
    const p = processOne(variant).then(() => { active.delete(p); });
    active.add(p);

    if ((success + failed) > 0 && (success + failed) % 50 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  ⏳ ${success + failed}/${toProcess.length} processed...`);
    }
  }
  await Promise.all(active);

  // eslint-disable-next-line no-console
  console.log(`\n✅ Done!`);
  // eslint-disable-next-line no-console
  console.log(`   Translated: ${success}/${toProcess.length}`);
  // eslint-disable-next-line no-console
  console.log(`   Failed: ${failed}`);
  // eslint-disable-next-line no-console
  console.log(`   Rate limited retries: ${rateLimited}`);
  // eslint-disable-next-line no-console
  console.log(`   Dry run: ${args.dryRun}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
