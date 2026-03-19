/**
 * Create Pinterest boards from L1 prompt_clusters.
 *
 * Usage:
 *   npx tsx src/create-pinterest-boards.ts --min-cards 50
 *   npx tsx src/create-pinterest-boards.ts --min-cards 10 --dry-run
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

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
  minCards: number;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let minCards = 10;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--min-cards") {
      const n = Number(args[i + 1]);
      if (!Number.isNaN(n) && n > 0) minCards = n;
    }
    if (args[i] === "--dry-run") dryRun = true;
  }
  return { minCards, dryRun };
}

const BOARD_NAME_TEMPLATES: Record<string, (label: string) => string> = {
  audience: (l) => `AI Photo: ${l}`,
  style: (l) => `${l} AI Photos`,
  occasion: (l) => `${l} AI Photos`,
  object: (l) => `AI Photos: ${l}`,
  doc_task: (l) => `AI ${l} Photo`,
};

const PINTEREST_API = "https://api.pinterest.com/v5";

async function createBoard(
  name: string,
  description: string,
  token: string
): Promise<string> {
  const res = await fetch(`${PINTEREST_API}/boards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description, privacy: "PUBLIC" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pinterest API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.id;
}

async function main() {
  loadEnvFiles();
  const { minCards, dryRun } = parseArgs();

  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pinterestToken = process.env.PINTEREST_ACCESS_TOKEN;
  const siteDomain = process.env.SITE_DOMAIN || "promptshot.app";

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!pinterestToken && !dryRun) {
    console.error("Missing PINTEREST_ACCESS_TOKEN (use --dry-run to preview)");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: clusters, error: clErr } = await supabase
    .from("prompt_clusters")
    .select("slug, dimension_type, dimension_value, title_ru, title_en, pinterest_board_id")
    .eq("page_level", "L1")
    .eq("is_published", true)
    .is("pinterest_board_id", null)
    .order("sort_order");

  if (clErr) {
    console.error("Failed to load clusters:", clErr.message);
    process.exit(1);
  }

  const { data: counts, error: cntErr } = await supabase
    .from("tag_counts_cache")
    .select("dimension, tag_slug, count");

  if (cntErr) {
    console.error("Failed to load tag counts:", cntErr.message);
    process.exit(1);
  }

  const countMap = new Map<string, number>();
  for (const row of counts || []) {
    countMap.set(`${row.dimension}:${row.tag_slug}`, row.count);
  }

  const DIM_TO_TAG: Record<string, string> = {
    audience: "audience_tag",
    style: "style_tag",
    occasion: "occasion_tag",
    object: "object_tag",
    doc_task: "doc_task_tag",
  };

  const eligible = (clusters || []).filter((c) => {
    const tagDim = DIM_TO_TAG[c.dimension_type];
    if (!tagDim) return false;
    const cnt = countMap.get(`${tagDim}:${c.dimension_value}`) || 0;
    return cnt >= minCards;
  });

  console.log(
    `Found ${eligible.length} L1 clusters with >= ${minCards} cards (of ${clusters?.length || 0} without board_id)\n`
  );

  let created = 0;
  for (const cluster of eligible) {
    const template = BOARD_NAME_TEMPLATES[cluster.dimension_type];
    if (!template) continue;

    const label = cluster.title_en || cluster.title_ru;
    const boardName = template(label);
    const cardCount = countMap.get(
      `${DIM_TO_TAG[cluster.dimension_type]}:${cluster.dimension_value}`
    ) || 0;
    const description = `AI photo prompts: ${label}. Ready-to-use prompts for AI photo generation — copy and paste into ChatGPT or Gemini.`;

    if (dryRun) {
      console.log(`[DRY] "${boardName}" (${cardCount} cards) → ${cluster.slug}`);
      created++;
      continue;
    }

    try {
      const boardId = await createBoard(boardName, description, pinterestToken!);
      const { error: upErr } = await supabase
        .from("prompt_clusters")
        .update({ pinterest_board_id: boardId })
        .eq("slug", cluster.slug);

      if (upErr) {
        console.error(`  DB update failed for ${cluster.slug}: ${upErr.message}`);
      } else {
        console.log(`✓ "${boardName}" → board_id=${boardId} (${cardCount} cards)`);
        created++;
      }

      await sleep(2000);
    } catch (err: any) {
      console.error(`✗ "${boardName}": ${err.message}`);
    }
  }

  console.log(`\nDone: ${created} boards ${dryRun ? "would be " : ""}created.`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
