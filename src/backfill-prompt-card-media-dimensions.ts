/**
 * Backfill prompt_card_media.width / height from image headers (Storage download).
 *
 * Usage:
 *   npx tsx src/backfill-prompt-card-media-dimensions.ts --dry-run
 *   npx tsx src/backfill-prompt-card-media-dimensions.ts
 *   npx tsx src/backfill-prompt-card-media-dimensions.ts --limit 100
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_*), SUPABASE_SERVICE_ROLE_KEY (from .env / .env.local).
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import imageSize from "image-size";

const PAGE = 200;
const SLEEP_MS = 50;

function loadEnv() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "../.env", "../.env.local"]) {
    const abs = path.resolve(cwd, p);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  let limit = Infinity;
  const li = argv.indexOf("--limit");
  if (li >= 0 && argv[li + 1]) {
    const n = parseInt(argv[li + 1], 10);
    if (Number.isFinite(n) && n > 0) limit = n;
  }
  return { dryRun, limit };
}

type MediaRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

async function main() {
  loadEnv();
  const { dryRun, limit } = parseArgs();

  const supabaseUrl =
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(
    `[backfill-media-dim] dryRun=${dryRun} limit=${limit === Infinity ? "∞" : limit}`,
  );

  let listOffset = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  while (processed < limit) {
    const take = Math.min(PAGE, limit - processed);
    // After real UPDATE, rows no longer match → always read from 0.
    // Dry-run does not update → scan forward with listOffset.
    const rangeStart = dryRun ? listOffset : 0;
    const { data: rows, error } = await supabase
      .from("prompt_card_media")
      .select("id, storage_bucket, storage_path")
      .eq("media_type", "photo")
      .or("width.is.null,height.is.null")
      .order("id", { ascending: true })
      .range(rangeStart, rangeStart + take - 1);

    if (error) {
      console.error("[backfill-media-dim] select error:", error.message);
      process.exit(1);
    }

    if (!rows?.length) break;

    if (dryRun) listOffset += rows.length;

    for (const row of rows as MediaRow[]) {
      if (processed >= limit) break;

      const { id, storage_bucket, storage_path } = row;
      const { data: blob, error: dlErr } = await supabase.storage
        .from(storage_bucket)
        .download(storage_path);

      if (dlErr || !blob) {
        console.warn(`[skip] ${id} download: ${dlErr?.message || "no blob"} :: ${storage_path}`);
        failed++;
        processed++;
        continue;
      }

      const buf = Buffer.from(await blob.arrayBuffer());
      let width: number;
      let height: number;
      try {
        const dim = imageSize(buf);
        width = dim.width ?? 0;
        height = dim.height ?? 0;
      } catch (e) {
        console.warn(`[skip] ${id} image-size: ${(e as Error).message} :: ${storage_path}`);
        failed++;
        processed++;
        continue;
      }

      if (width <= 0 || height <= 0) {
        console.warn(`[skip] ${id} bad dimensions ${width}x${height} :: ${storage_path}`);
        skipped++;
        processed++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] ${id} → ${width}x${height} :: ${storage_path}`);
        updated++;
        processed++;
        continue;
      }

      const { error: upErr } = await supabase
        .from("prompt_card_media")
        .update({ width, height })
        .eq("id", id);

      if (upErr) {
        console.warn(`[fail] ${id} update: ${upErr.message}`);
        failed++;
      } else {
        updated++;
        if (updated % 100 === 0) {
          console.log(`[backfill-media-dim] … ${updated} rows updated`);
        }
      }
      processed++;

      if (SLEEP_MS > 0) await new Promise((r) => setTimeout(r, SLEEP_MS));
    }

    if ((rows as MediaRow[]).length < take) break;
  }

  console.log(
    `[backfill-media-dim] done: updated=${updated} skipped=${skipped} failed=${failed} processed=${processed}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
