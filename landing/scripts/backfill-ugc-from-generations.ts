/**
 * Backfill `prompt_cards` + `landing_generations.ugc_card_id` for completed web generations
 * that finished before the UGC release.
 *
 * Run from repo root:
 *   npm run backfill:ugc-from-generations:dry
 *   npm run backfill:ugc-from-generations
 *
 * Or from landing/:
 *   npx tsx scripts/backfill-ugc-from-generations.ts --dry-run
 *
 * Args: --dry-run, --limit N, --user-id <uuid>
 * Env: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createUgcCardForCompletedGeneration } from "../src/lib/web-ugc-card";

/** Expect `npm run` with `cd landing` so cwd is the landing app root. */
function loadEnvFiles() {
  const landingRoot = process.cwd();
  const repoRoot = path.resolve(landingRoot, "..");
  const candidates = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(landingRoot, ".env.local"),
    path.join(landingRoot, ".env"),
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
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;
  let limit: number | undefined;
  let userId: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--limit") {
      const n = Number(args[i + 1]);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
    if (args[i] === "--user-id") {
      const id = args[i + 1]?.trim();
      if (id) userId = id;
    }
  }
  return { dryRun, limit, userId };
}

type GenRow = {
  id: string;
  user_id: string;
  prompt_text: string;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
};

async function main() {
  const { dryRun, limit, userId } = parseArgs();
  loadEnvFiles();

  const url = resolveSupabaseUrl();
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing Supabase URL (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)");

  const supabase: SupabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let q = supabase
    .from("landing_generations")
    .select("id,user_id,prompt_text,result_storage_bucket,result_storage_path,ugc_card_id,status")
    .eq("status", "completed")
    .is("ugc_card_id", null)
    .not("result_storage_bucket", "is", null)
    .not("result_storage_path", "is", null)
    .order("created_at", { ascending: true });

  if (userId) q = q.eq("user_id", userId);

  const { data: rows, error } = await q;

  if (error) throw new Error(`Query failed: ${error.message}`);

  const list = (rows || []) as GenRow[];
  const toProcess = limit ? list.slice(0, limit) : list;

  console.log(
    `\n📦 backfill-ugc-from-generations [dryRun=${dryRun}] candidates=${list.length} will_process=${toProcess.length}\n`,
  );

  if (toProcess.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    for (const r of toProcess.slice(0, 20)) {
      console.log(`  would process ${r.id} user=${r.user_id} bucket=${r.result_storage_bucket}`);
    }
    if (toProcess.length > 20) console.log(`  ... and ${toProcess.length - 20} more`);
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const r of toProcess) {
    const result = await createUgcCardForCompletedGeneration(supabase, {
      generationId: r.id,
      userId: r.user_id,
      promptText: r.prompt_text || "",
      resultBucket: r.result_storage_bucket!,
      resultPath: r.result_storage_path!,
    });
    if (result?.cardId) {
      ok += 1;
      console.log(`✓ ${r.id} → card ${result.cardId} slug=${result.slug ?? "?"}`);
    } else {
      fail += 1;
      console.warn(`✗ ${r.id} (no card created — see logs above)`);
    }
  }

  console.log(`\nDone: ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
