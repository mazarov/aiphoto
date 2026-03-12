import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

type Args = {
  dryRun: boolean;
  limit?: number;
  batchSize: number;
  dataset?: string;
  recomputeAll: boolean;
};

type CardRow = {
  id: string;
  title_ru: string | null;
  source_dataset_slug: string | null;
  hashtags: string[] | null;
};

type VariantRow = {
  card_id: string;
  prompt_text_ru: string | null;
};

type Rule = {
  tag: string;
  patterns: RegExp[];
};

const MAX_HASHTAGS = 12;
const FALLBACK_TAG = "ai_prompt";

const RULES: Rule[] = [
  // audience
  { tag: "parnyy", patterns: [/пара|парн(ый|ое)|вдвоем|двоих|двумя\s+людьми|оба|вместе/i, /\bcouple|both|two people\b/i] },
  { tag: "zhenskiy", patterns: [/женщин|девуш|женск/i, /\bwoman|female|girl\b/i] },
  { tag: "muzhskoy", patterns: [/мужчин|парень|мужск/i, /\bman|male|boy\b/i] },
  { tag: "semeynyy", patterns: [/семь|семейн/i, /\bfamily\b/i] },
  { tag: "detskiy", patterns: [/детск|ребен/i, /\bchild|kids?\b/i] },

  // style / visuals
  { tag: "portret", patterns: [/портрет/i, /\bportrait\b/i] },
  { tag: "studiynyy", patterns: [/студи/i, /\bstudio\b/i] },
  { tag: "myagkiy_svet", patterns: [/мягк(ий|ого)?\s+свет/i, /\bsoft light\b/i] },
  { tag: "black_white", patterns: [/черно[-\s]?бел|ч[\/\s-]?б|монохром/i, /\bblack\s*and\s*white|monochrome|b\/w\b/i] },
  { tag: "cinematic_portrait", patterns: [/кинематограф|cinematic/i] },
  { tag: "editorial_fashion", patterns: [/фэшн|модн|vogue|editorial|harper/i] },
  { tag: "lifestyle_yacht", patterns: [/яхт|палуб/i, /\byacht|deck\b/i] },

  // events
  { tag: "den_rozhdeniya", patterns: [/день\s+рожден|на\s+др\b/i, /\bbirthday\b/i] },
  { tag: "vosmoe_marta", patterns: [/8\s*март/i] },
  { tag: "valentines_day", patterns: [/14\s*феврал|день\s+влюблен|valentine/i] },
  { tag: "svadba", patterns: [/свадьб/i, /\bwedding\b/i] },

  // objects / use context
  { tag: "s_mashinoy", patterns: [/с\s+машин|авто|тачк/i, /\bcar\b/i] },
  { tag: "s_sobakoy", patterns: [/с\s+собак|пес|питомц/i, /\bdog|pet\b/i] },
  { tag: "s_cvetami", patterns: [/с\s+цвет|цветами|букет/i, /\bflowers?\b/i] },
  { tag: "na_more", patterns: [/море|морск|побереж|пляж/i, /\bsea|ocean|beach|coast\b/i] },
  { tag: "na_yahte", patterns: [/яхт|палуб/i, /\byacht|deck\b/i] },
  { tag: "na_pasport", patterns: [/на\s+паспорт/i, /\bpassport\b/i] },
  { tag: "na_dokumenty", patterns: [/на\s+документ/i, /\bdocuments?\b/i] },
];

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let batchSize = 200;
  let dataset: string | undefined;
  let recomputeAll = false;

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

function extractHashtags(promptTexts: string[], title: string | null): string[] {
  const haystack = `${title || ""}\n${promptTexts.join("\n")}`;
  const tags: string[] = [];
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      tags.push(rule.tag);
    }
  }
  const uniq = Array.from(new Set(tags)).slice(0, MAX_HASHTAGS);
  return uniq.length > 0 ? uniq : [FALLBACK_TAG];
}

async function fetchCardsToProcess(
  supabase: ReturnType<typeof createClient>,
  batchSize: number,
  limit?: number,
  dataset?: string,
  recomputeAll = false,
): Promise<CardRow[]> {
  const cards: CardRow[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("prompt_cards")
      .select("id,title_ru,source_dataset_slug,hashtags")
      .order("source_date", { ascending: false })
      .range(from, from + batchSize - 1);

    if (dataset) query = query.eq("source_dataset_slug", dataset);
    if (!recomputeAll) {
      query = query.or("hashtags.is.null,hashtags.eq.{}");
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

async function fetchPromptTextsByCardIds(
  supabase: ReturnType<typeof createClient>,
  cardIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const ids of chunk(cardIds, 80)) {
    const { data, error } = await supabase
      .from("prompt_variants")
      .select("card_id,prompt_text_ru")
      .in("card_id", ids)
      .order("variant_index", { ascending: true });
    if (error) throw new Error(`Failed to fetch prompt_variants: ${error.message}`);
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

  const cards = await fetchCardsToProcess(supabase, args.batchSize, args.limit, args.dataset, args.recomputeAll);
  if (cards.length === 0) {
    console.log(JSON.stringify({ processed: 0, updated: 0, dryRun: args.dryRun }, null, 2));
    return;
  }

  const promptMap = await fetchPromptTextsByCardIds(
    supabase,
    cards.map((c) => c.id),
  );

  let updated = 0;
  let skippedNoPrompts = 0;
  const sample: Array<{ id: string; hashtags: string[] }> = [];

  for (const card of cards) {
    const prompts = promptMap.get(card.id) || [];
    if (prompts.length === 0) {
      skippedNoPrompts += 1;
      continue;
    }

    const hashtags = extractHashtags(prompts, card.title_ru);
    if (sample.length < 10) sample.push({ id: card.id, hashtags });

    if (!args.dryRun) {
      const { error } = await supabase
        .from("prompt_cards")
        .update({ hashtags })
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

