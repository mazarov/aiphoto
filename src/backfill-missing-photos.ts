import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parseDataset, type ParsedCard, type MediaItem } from "./lib/prompt-export-parser";

const DATASET = process.argv[2] || "ii_photolab_ChatExport_2026-03-14";
const UPLOAD_TIMEOUT_MS = 30_000;
const UPLOAD_RETRIES = 3;
const BATCH_SIZE = 50;

function loadEnv() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "../.env", "../.env.local"]) {
    const abs = path.resolve(cwd, p);
    if (existsSync(abs)) loadDotenv({ path: abs, override: false });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function main() {
  loadEnv();
  const supabaseUrl =
    process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE env vars");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Get all published cards for this dataset that have NO media
  console.log(`[1/4] Fetching cards without photos for ${DATASET}...`);
  const pageSize = 1000;
  const allCards: { id: string; source_message_id: number; card_split_index: number }[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("prompt_cards")
      .select("id,source_message_id,card_split_index")
      .eq("source_dataset_slug", DATASET)
      .eq("is_published", true)
      .order("source_message_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    allCards.push(...(data as typeof allCards));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`  Total published cards: ${allCards.length}`);

  // Find which cards have media
  const mediaCardIds = new Set<string>();
  from = 0;
  while (true) {
    const { data } = await supabase
      .from("prompt_card_media")
      .select("card_id")
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const r of data) mediaCardIds.add(r.card_id);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const noPhotoCards = allCards.filter((c) => !mediaCardIds.has(c.id));
  console.log(`  Cards without photos: ${noPhotoCards.length}`);
  if (noPhotoCards.length === 0) { console.log("Nothing to do!"); return; }

  const noPhotoMsgIds = new Set(noPhotoCards.map((c) => c.source_message_id));

  // 2. Parse HTML to get media paths
  console.log(`[2/4] Parsing HTML export...`);
  const parsed = await parseDataset(DATASET);
  const parsedByMsg = new Map<string, ParsedCard>();
  for (const card of parsed.cards) {
    parsedByMsg.set(`${card.sourceMessageId}:${card.cardSplitIndex}`, card);
  }

  // Match DB cards to parsed cards
  const toUpload: { dbCard: typeof noPhotoCards[0]; parsedCard: ParsedCard }[] = [];
  for (const dbCard of noPhotoCards) {
    const key = `${dbCard.source_message_id}:${dbCard.card_split_index}`;
    const pc = parsedByMsg.get(key);
    if (pc && pc.media.length > 0) toUpload.push({ dbCard, parsedCard: pc });
  }
  console.log(`  Matched cards with photos in HTML: ${toUpload.length}`);
  const totalPhotos = toUpload.reduce((s, t) => s + t.parsedCard.media.length, 0);
  console.log(`  Total photos to upload: ${totalPhotos}`);

  // 3. Upload photos
  console.log(`[3/4] Uploading photos...`);
  let uploaded = 0;
  let failed = 0;
  let cardsDone = 0;

  for (const { dbCard, parsedCard } of toUpload) {
    for (const media of parsedCard.media) {
      const ext = path.extname(media.sourceRelativePath) || ".bin";
      const objectPath = `telegram/${DATASET}/${parsedCard.sourceMessageId}/${parsedCard.cardSplitIndex}/${media.mediaIndex}${ext}`;
      const absPath = path.resolve(process.cwd(), "docs", "export", DATASET, media.sourceRelativePath);

      let file: Buffer | null = null;
      try { file = await fs.readFile(absPath); } catch { /* skip */ }
      if (!file) { failed++; continue; }

      let ok = false;
      for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt++) {
        try {
          const { error } = await withTimeout(
            supabase.storage.from("prompt-images").upload(objectPath, file, {
              upsert: true,
              contentType: media.mediaType === "photo" ? "image/jpeg" : "video/mp4",
            }),
            UPLOAD_TIMEOUT_MS,
            objectPath,
          );
          if (!error) { ok = true; break; }
        } catch {
          if (attempt < UPLOAD_RETRIES) await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }

      if (ok) {
        const { error: mediaErr } = await supabase.from("prompt_card_media").insert({
          card_id: dbCard.id,
          media_index: media.mediaIndex,
          media_type: media.mediaType,
          storage_bucket: "prompt-images",
          storage_path: objectPath,
          original_relative_path: media.sourceRelativePath,
          thumb_relative_path: media.thumbRelativePath,
          is_primary: media.isPrimary,
          mime_type: media.mediaType === "photo" ? "image/jpeg" : "video/mp4",
          file_size_bytes: file.byteLength,
        });
        if (!mediaErr) uploaded++;
        else failed++;
      } else {
        failed++;
      }
    }

    cardsDone++;
    if (cardsDone % BATCH_SIZE === 0 || cardsDone === toUpload.length) {
      console.log(`  Progress: ${cardsDone}/${toUpload.length} cards | ${uploaded} uploaded, ${failed} failed`);
    }
  }

  // 4. Summary
  console.log(`\n[4/4] Done!`);
  console.log(`  Cards processed: ${cardsDone}`);
  console.log(`  Photos uploaded: ${uploaded}`);
  console.log(`  Photos failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
