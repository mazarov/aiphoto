#!/usr/bin/env node
/**
 * Standalone: hourly popularity score recalculation for prompt_cards.
 * Zero dependencies — Node 20+ built-in fetch only.
 *
 * Usage on DO:
 *   curl -sO https://raw.githubusercontent.com/mazarov/aiphoto/main/src/standalone/recalculate-popularity-scores-standalone.mjs
 *   nohup node recalculate-popularity-scores-standalone.mjs > recalculate-popularity.log 2>&1 &
 *
 * Cron (hourly): 0 * * * * cd /root && node recalculate-popularity-scores-standalone.mjs >> recalculate-popularity.log 2>&1
 *
 * Env (already on DO): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BATCH_SIZE = (() => {
  const i = args.indexOf("--batch-size");
  return i >= 0 ? parseInt(args[i + 1], 10) : 5000;
})();

const SB = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function recalculate() {
  const url = `${SUPABASE_URL}/rest/v1/rpc/recalculate_popularity_scores`;
  const res = await fetch(url, {
    method: "POST",
    headers: SB,
    body: JSON.stringify({ p_batch_size: BATCH_SIZE }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  const started = Date.now();
  console.log(`[${new Date().toISOString()}] recalculate_popularity_scores batch=${BATCH_SIZE} dry_run=${DRY_RUN}`);

  if (DRY_RUN) {
    console.log("Dry run — skipping RPC call");
    return;
  }

  const result = await recalculate();
  const ms = Date.now() - started;
  console.log(`Done in ${ms}ms:`, JSON.stringify(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
