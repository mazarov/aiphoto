/**
 * Re-uploads missing media for cards that were ingested but whose photos
 * failed to upload to Supabase Storage (e.g. due to minio timeouts).
 *
 * Usage:
 *   npx tsx src/reupload-missing-media.ts --dataset ChatBananahMama_ChatExport_2026-03-15
 *   npx tsx src/reupload-missing-media.ts --dataset ChatBananahMama_ChatExport_2026-03-15 --limit 100
 *   npx tsx src/reupload-missing-media.ts --dataset ChatBananahMama_ChatExport_2026-03-15 --dry-run
 */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parseDataset, type ParsedCard, type MediaItem } from "./lib/prompt-export-parser";

const UPLOAD_TIMEOUT_MS = 30_000;
const UPLOAD_RETRIES = 3;
const BATCH_SIZE = 10;

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "../.env", "../.env.local"]) {
    const abs = path.resolve(cwd, p);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

interface Args {
  datasetSlug: string;
  dryRun: boolean;
  limit?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let datasetSlug = "";
  let dryRun = false;
  let limit: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dataset") datasetSlug = args[i + 1] ?? "";
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--limit") {
      const n = Number(args[i + 1]);
      if (!Number.isNaN(n) && n > 0) limit = n;
    }
  }
  if (!datasetSlug) throw new Error("Missing --dataset");
  return { datasetSlug, dryRun, limit };
}

async function fetchAllPages<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select: string,
  filter: (q: any) => any,
): Promise<T[]> {
  const pageSize = 1000;
  const results: T[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    results.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return results;
}

async function fetchCardsWithoutMedia(
  supabase: ReturnType<typeof createClient>,
  datasetSlug: string,
): Promise<Array<{ id: string; source_message_id: number; card_split_index: number }>> {
  const allCards = await fetchAllPages<{ id: string; source_message_id: number; card_split_index: number }>(
    supabase, "prompt_cards", "id, source_message_id, card_split_index",
    (q: any) => q.eq("source_dataset_slug", datasetSlug).order("source_message_id", { ascending: true }),
  );
  console.log(`[reupload] Total cards in DB: ${allCards.length}`);

  const cardIdsWithMedia = new Set<string>();
  const allCardIds = allCards.map((c) => c.id);
  const chunk = 50;
  for (let i = 0; i < allCardIds.length; i += chunk) {
    const batch = allCardIds.slice(i, i + chunk);
    const { data } = await supabase
      .from("prompt_card_media")
      .select("card_id")
      .in("card_id", batch);
    if (data) data.forEach((m: any) => cardIdsWithMedia.add(m.card_id));
  }
  console.log(`[reupload] Cards with media: ${cardIdsWithMedia.size}`);

  return allCards.filter((c) => !cardIdsWithMedia.has(c.id));
}

async function readMediaBuffer(datasetSlug: string, relPath: string): Promise<Buffer | null> {
  const abs = path.resolve(process.cwd(), "docs", "export", datasetSlug, relPath);
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

async function uploadWithRetry(
  supabase: ReturnType<typeof createClient>,
  objectPath: string,
  file: Buffer,
  mimeType: string,
): Promise<boolean> {
  for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt++) {
    try {
      const { error } = await withTimeout(
        supabase.storage.from("prompt-images").upload(objectPath, file, {
          upsert: true,
          contentType: mimeType,
        }),
        UPLOAD_TIMEOUT_MS,
        `upload ${objectPath}`,
      );
      if (!error) return true;
      console.error(`  [attempt ${attempt}] storage error: ${error.message}`);
    } catch (e) {
      console.error(`  [attempt ${attempt}] ${(e as Error).message}`);
    }
    if (attempt < UPLOAD_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return false;
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();

  console.log(`[reupload] Parsing dataset: ${args.datasetSlug}`);
  const parsed = await parseDataset(args.datasetSlug);

  const parsedByKey = new Map<string, ParsedCard>();
  for (const card of parsed.cards) {
    const key = `${card.sourceMessageId}:${card.cardSplitIndex}`;
    parsedByKey.set(key, card);
  }
  console.log(`[reupload] Parsed ${parsed.cards.length} cards from HTML`);

  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) throw new Error("Missing Supabase URL env");
  const supabase = createClient(supabaseUrl, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  console.log(`[reupload] Fetching cards without media from DB...`);
  let cardsWithoutMedia = await fetchCardsWithoutMedia(supabase, args.datasetSlug);
  console.log(`[reupload] Found ${cardsWithoutMedia.length} cards without media`);

  if (args.limit) {
    cardsWithoutMedia = cardsWithoutMedia.slice(0, args.limit);
    console.log(`[reupload] Limited to ${cardsWithoutMedia.length}`);
  }

  if (args.dryRun) {
    console.log(`[reupload] Dry run — exiting`);
    return;
  }

  let uploaded = 0;
  let failed = 0;
  let skippedNoFile = 0;
  let skippedNoParsed = 0;

  for (let i = 0; i < cardsWithoutMedia.length; i++) {
    const dbCard = cardsWithoutMedia[i];
    const key = `${dbCard.source_message_id}:${dbCard.card_split_index}`;
    const parsedCard = parsedByKey.get(key);
    if (!parsedCard) {
      skippedNoParsed++;
      continue;
    }

    const photos = parsedCard.media.filter((m) => m.mediaType === "photo");
    let cardUploaded = false;

    for (const media of photos) {
      const file = await readMediaBuffer(args.datasetSlug, media.sourceRelativePath);
      if (!file) {
        skippedNoFile++;
        continue;
      }

      const ext = path.extname(media.sourceRelativePath) || ".bin";
      const objectPath = `telegram/${args.datasetSlug}/${dbCard.source_message_id}/${dbCard.card_split_index}/${media.mediaIndex}${ext}`;
      const mimeType = "image/jpeg";

      const ok = await uploadWithRetry(supabase, objectPath, file, mimeType);
      if (!ok) {
        failed++;
        continue;
      }

      const { error: mediaErr } = await supabase.from("prompt_card_media").upsert({
        card_id: dbCard.id,
        media_index: media.mediaIndex,
        media_type: media.mediaType,
        storage_bucket: "prompt-images",
        storage_path: objectPath,
        original_relative_path: media.sourceRelativePath,
        thumb_relative_path: media.thumbRelativePath,
        is_primary: media.isPrimary,
        mime_type: mimeType,
        file_size_bytes: file.byteLength,
      }, { onConflict: "card_id,media_index" });
      if (mediaErr) {
        console.error(`  DB insert error for ${key}: ${mediaErr.message}`);
        failed++;
        continue;
      }

      cardUploaded = true;
    }

    if (cardUploaded) uploaded++;

    if ((i + 1) % BATCH_SIZE === 0 || i === cardsWithoutMedia.length - 1) {
      console.log(
        `[reupload] Progress: ${i + 1}/${cardsWithoutMedia.length} | uploaded=${uploaded} failed=${failed} noFile=${skippedNoFile} noParsed=${skippedNoParsed}`,
      );
    }
  }

  console.log(`\n[reupload] Done!`);
  console.log(`  Total cards without media: ${cardsWithoutMedia.length}`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped (no file): ${skippedNoFile}`);
  console.log(`  Skipped (no parsed match): ${skippedNoParsed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
