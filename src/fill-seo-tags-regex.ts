/**
 * Regex-based SEO tagger: assigns tags from TAG_REGISTRY by pattern matching
 * against prompt text. No LLM, no new tags — only existing registry entries.
 *
 * Usage:
 *   npx tsx src/fill-seo-tags-regex.ts --dataset ChatBananahMama_ChatExport_2026-03-15
 *   npx tsx src/fill-seo-tags-regex.ts                     # all cards without seo_tags
 *   npx tsx src/fill-seo-tags-regex.ts --force              # re-tag all cards
 *   npx tsx src/fill-seo-tags-regex.ts --dry-run            # preview without writing
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TAG_REGISTRY, type Dimension } from "../landing/src/lib/tag-registry";

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "../.env", "../.env.local"]) {
    const abs = path.resolve(cwd, p);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
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

interface Args {
  dataset?: string;
  dryRun: boolean;
  force: boolean;
  limit?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dataset: string | undefined;
  let dryRun = false;
  let force = false;
  let limit: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dataset") dataset = args[i + 1] ?? undefined;
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--force") force = true;
    if (args[i] === "--limit") {
      const n = Number(args[i + 1]);
      if (!Number.isNaN(n) && n > 0) limit = n;
    }
  }
  return { dataset, dryRun, force, limit };
}

type SeoTags = Record<Dimension, string[]>;

const tagsWithPatterns = TAG_REGISTRY.filter((t) => t.patterns.length > 0);

function matchTags(text: string): SeoTags {
  const result: SeoTags = {
    audience_tag: [],
    style_tag: [],
    occasion_tag: [],
    object_tag: [],
    doc_task_tag: [],
  };

  for (const tag of tagsWithPatterns) {
    const matched = tag.patterns.some((p) => p.test(text));
    if (matched && !result[tag.dimension].includes(tag.slug)) {
      result[tag.dimension].push(tag.slug);
    }
  }

  return result;
}

function isEmptySeoTags(tags: SeoTags): boolean {
  return Object.values(tags).every((arr) => arr.length === 0);
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();

  console.log(`[seo-regex] Tags with patterns: ${tagsWithPatterns.length}/${TAG_REGISTRY.length}`);
  if (args.dataset) console.log(`[seo-regex] Dataset filter: ${args.dataset}`);
  if (args.force) console.log(`[seo-regex] Force mode: re-tagging all cards`);
  if (args.dryRun) console.log(`[seo-regex] Dry run mode`);

  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) throw new Error("Missing Supabase URL env");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const pageSize = 500;
  let from = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalEmpty = 0;

  while (true) {
    let q = supabase
      .from("prompt_cards")
      .select("id, source_dataset_slug, seo_tags")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (args.dataset) q = q.eq("source_dataset_slug", args.dataset);
    if (!args.force) q = q.is("seo_tags", null);

    const { data: cards, error } = await q;
    if (error) throw new Error(`Failed to fetch cards: ${error.message}`);
    if (!cards || cards.length === 0) break;

    const cardIds = cards.map((c) => c.id);
    const variantChunk = 30;
    const variantMap = new Map<string, string>();

    for (let i = 0; i < cardIds.length; i += variantChunk) {
      const batch = cardIds.slice(i, i + variantChunk);
      const { data: variants } = await supabase
        .from("prompt_variants")
        .select("card_id, prompt_text_ru, prompt_text_en")
        .in("card_id", batch);
      if (variants) {
        for (const v of variants) {
          const text = [v.prompt_text_ru, v.prompt_text_en].filter(Boolean).join(" ");
          const existing = variantMap.get(v.card_id);
          variantMap.set(v.card_id, existing ? `${existing} ${text}` : text);
        }
      }
    }

    for (const card of cards) {
      const promptText = variantMap.get(card.id) ?? "";
      if (!promptText) {
        totalSkipped++;
        continue;
      }

      const seoTags = matchTags(promptText);
      if (isEmptySeoTags(seoTags)) {
        totalEmpty++;
        continue;
      }

      if (!args.dryRun) {
        const { error: updateErr } = await supabase
          .from("prompt_cards")
          .update({ seo_tags: seoTags })
          .eq("id", card.id);
        if (updateErr) {
          console.error(`  Update error ${card.id}: ${updateErr.message}`);
          continue;
        }
      }

      totalUpdated++;
    }

    totalProcessed += cards.length;
    console.log(
      `[seo-regex] Progress: ${totalProcessed} processed | ${totalUpdated} tagged | ${totalEmpty} no-match | ${totalSkipped} no-prompt`,
    );

    if (cards.length < pageSize) break;
    if (args.limit && totalProcessed >= args.limit) break;
    from += pageSize;
  }

  console.log(`\n[seo-regex] Done!`);
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Tagged: ${totalUpdated}`);
  console.log(`  No matches: ${totalEmpty}`);
  console.log(`  No prompt text: ${totalSkipped}`);
  console.log(`  Dry run: ${args.dryRun}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
