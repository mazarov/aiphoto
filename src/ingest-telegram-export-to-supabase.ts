import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  parseDataset,
  type ParsedCard,
  type PromptVariant,
  type MediaItem,
} from "./lib/prompt-export-parser";

interface Args {
  datasetSlug: string;
  dryRun: boolean;
  limit?: number;
  offset: number;
  existingOnly: boolean;
  messageId?: number;
}

const CYR_MAP: Record<string, string> = {
  'щ':'shch','ш':'sh','ч':'ch','ц':'ts','ж':'zh','ё':'yo','э':'e','ю':'yu','я':'ya',
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','з':'z','и':'i','й':'y','к':'k',
  'л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
  'х':'kh','ъ':'','ы':'y','ь':''
};

function translitSlug(text: string): string {
  let s = text.toLowerCase();
  for (const [k, v] of Object.entries(CYR_MAP)) s = s.split(k).join(v);
  s = s.replace(/[^a-z0-9 \-]/g, '').replace(/[\s\-]+/g, '-').replace(/^-|-$/g, '');
  return s.slice(0, 80).replace(/-$/, '');
}

// --- Supplier dedup ---
// Maps legacy dataset slugs to the canonical supplier key.
// New datasets follow format: {SUPPLIER_KEY}_{Source}_{YYYY-MM-DD}
const SUPPLIER_LEGACY_MAP: Record<string, string> = {
  'lexy_15.02.26': 'LEXYGPT',
};

function parseSupplierKey(datasetSlug: string): string {
  if (SUPPLIER_LEGACY_MAP[datasetSlug]) return SUPPLIER_LEGACY_MAP[datasetSlug];
  const match = datasetSlug.match(/^([A-Za-z0-9]+)_\w+_\d{4}-\d{2}-\d{2}$/);
  return match ? match[1] : datasetSlug;
}

async function findSupplierDatasetSlugs(
  supabase: ReturnType<typeof createClient>,
  supplierKey: string,
  currentDatasetSlug: string,
): Promise<string[]> {
  const slugs = new Set<string>();
  slugs.add(currentDatasetSlug);
  for (const [slug, key] of Object.entries(SUPPLIER_LEGACY_MAP)) {
    if (key === supplierKey) slugs.add(slug);
  }
  const { data } = await supabase.from('import_datasets').select('dataset_slug');
  if (data) {
    for (const row of data) {
      if (parseSupplierKey(row.dataset_slug) === supplierKey) {
        slugs.add(row.dataset_slug);
      }
    }
  }
  return Array.from(slugs);
}

async function generateUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  title: string,
  cardId: string,
  splitIndex: number,
  splitTotal: number,
): Promise<string> {
  let base = translitSlug(title);
  if (!base) base = 'promt';
  if (splitTotal > 1) base += '-' + (splitIndex + 1);

  const shortId = cardId.replace(/-/g, '').slice(0, 5);
  const slug = base + '-' + shortId;
  return slug;
}

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(cwd, ".env.local"),
    path.resolve(cwd, "..", ".env"),
    path.resolve(cwd, "..", ".env.local"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadDotenv({ path: p, override: false });
    }
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

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let datasetSlug = "";
  let dryRun = false;
  let limit: number | undefined;
  let offset = 0;
  let existingOnly = false;
  let messageId: number | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--dataset") datasetSlug = args[i + 1] ?? "";
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--existing-only") existingOnly = true;
    if (args[i] === "--message-id") {
      const parsed = Number(args[i + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) messageId = parsed;
    }
    if (args[i] === "--limit") {
      const parsed = Number(args[i + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) limit = parsed;
    }
    if (args[i] === "--offset") {
      const parsed = Number(args[i + 1]);
      if (!Number.isNaN(parsed) && parsed >= 0) offset = parsed;
    }
  }
  if (!datasetSlug) {
    throw new Error("Missing --dataset. Example: --dataset LEXYGPT_ChatExport_2026-03-13");
  }
  return { datasetSlug, dryRun, limit, offset, existingOnly, messageId };
}

async function fetchExistingSourceMessageIds(
  supabase: ReturnType<typeof createClient>,
  datasetSlugs: string[],
): Promise<Set<number>> {
  const pageSize = 1000;
  const ids = new Set<number>();
  for (const slug of datasetSlugs) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("prompt_cards")
        .select("source_message_id")
        .eq("source_dataset_slug", slug)
        .order("source_message_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Failed load existing prompt_cards: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (typeof row.source_message_id === "number") ids.add(row.source_message_id);
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }
  return ids;
}

function toIsoFromTelegramDate(raw: string): string {
  // Example: 29.01.2026 16:15:23 UTC+03:00
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{2}):(\d{2})$/);
  if (!m) return new Date(raw).toISOString();
  const [, dd, mm, yyyy, hh, mi, ss, tzH, tzM] = m;
  const date = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${tzH}:${tzM}`;
  return new Date(date).toISOString();
}

async function readMediaBuffer(datasetSlug: string, relPath: string): Promise<Buffer | null> {
  const abs = path.resolve(process.cwd(), "docs", "export", datasetSlug, relPath);
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

async function upsertDataset(supabase: ReturnType<typeof createClient>, datasetSlug: string, channelTitle: string, dryRun: boolean) {
  if (dryRun) return { id: "dry-run-dataset-id" };
  const { data, error } = await supabase
    .from("import_datasets")
    .upsert(
      {
        dataset_slug: datasetSlug,
        channel_title: channelTitle,
        source_type: "telegram_html_export",
        is_active: true,
      },
      { onConflict: "dataset_slug" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed upsert import_datasets: ${error?.message}`);
  return data;
}

async function createRun(
  supabase: ReturnType<typeof createClient>,
  datasetId: string,
  htmlFiles: number,
  groupsTotal: number,
  dryRun: boolean,
) {
  if (dryRun) return { id: "dry-run-run-id" };
  const { data, error } = await supabase
    .from("import_runs")
    .insert({
      dataset_id: datasetId,
      mode: "backfill",
      status: "running",
      html_files_total: htmlFiles,
      groups_total: groupsTotal,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed create import_runs: ${error?.message}`);
  return data;
}

async function finalizeRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  if (dryRun) return;
  const { error } = await supabase.from("import_runs").update(payload).eq("id", runId);
  if (error) throw new Error(`Failed finalize import_runs: ${error.message}`);
}

const UPLOAD_TIMEOUT_MS = 30_000;
const UPLOAD_RETRIES = 3;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function uploadMedia(
  supabase: ReturnType<typeof createClient>,
  card: ParsedCard,
  media: MediaItem,
  dryRun: boolean,
) {
  const ext = path.extname(media.sourceRelativePath) || ".bin";
  const objectPath = `telegram/${card.datasetSlug}/${card.sourceMessageId}/${card.cardSplitIndex}/${media.mediaIndex}${ext}`;
  const mimeType = media.mediaType === "photo" ? "image/jpeg" : "video/mp4";

  if (dryRun) {
    return {
      storageBucket: "prompt-images",
      storagePath: objectPath,
      mimeType,
      fileSizeBytes: 0,
    };
  }

  const file = await readMediaBuffer(card.datasetSlug, media.sourceRelativePath);
  if (!file) {
    return null;
  }

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
      if (error) return null;
      return {
        storageBucket: "prompt-images",
        storagePath: objectPath,
        mimeType,
        fileSizeBytes: file.byteLength,
      };
    } catch {
      if (attempt === UPLOAD_RETRIES) return null;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return null;
}

async function ingestCard(
  supabase: ReturnType<typeof createClient>,
  card: ParsedCard,
  datasetId: string,
  runId: string,
  dryRun: boolean,
) {
  const sourcePublishedIso = toIsoFromTelegramDate(card.sourcePublishedAt);
  const sourceGroupKey = `${card.datasetSlug}:message${card.sourceMessageId}`;

  if (dryRun) return { cardId: "dry-run-card-id", mediaRows: [], variantRows: [] as Array<{ id: string; variant_index: number }> };

  const { data: sourceGroup, error: sourceGroupErr } = await supabase
    .from("source_message_groups")
    .upsert(
      {
        dataset_id: datasetId,
        run_id: runId,
        source_group_key: sourceGroupKey,
        source_message_id: card.sourceMessageId,
        source_message_ids: card.sourceMessageIds,
        source_published_at: sourcePublishedIso,
        raw_text_html: card.rawTextHtml,
        raw_text_plain: card.rawTextPlain,
        raw_payload: {
          parser_version: card.parserVersion,
          parse_warnings: card.parseWarnings,
        },
      },
      { onConflict: "dataset_id,source_message_id" },
    )
    .select("id")
    .single();
  if (sourceGroupErr || !sourceGroup) {
    throw new Error(`Failed upsert source_message_groups: ${sourceGroupErr?.message}`);
  }

  // First upsert without slug to get the card id
  const { data: promptCard, error: cardErr } = await supabase
    .from("prompt_cards")
    .upsert(
      {
        source_group_id: sourceGroup.id,
        card_split_index: card.cardSplitIndex,
        card_split_total: card.cardSplitTotal,
        split_strategy: card.cardSplitStrategy,
        title_ru: card.titleNormalized,
        title_en: null,
        hashtags: [],
        tags: [],
        source_channel: card.channelTitle,
        source_dataset_slug: card.datasetSlug,
        source_message_id: card.sourceMessageId,
        source_date: sourcePublishedIso,
        parse_status: card.parseStatus,
        parse_warnings: card.parseWarnings,
      },
      { onConflict: "source_dataset_slug,source_message_id,card_split_index" },
    )
    .select("id,slug")
    .single();
  if (cardErr || !promptCard) {
    throw new Error(`Failed upsert prompt_cards: ${cardErr?.message}`);
  }

  // Generate slug if missing
  if (!promptCard.slug && card.titleNormalized) {
    const slug = await generateUniqueSlug(
      supabase, card.titleNormalized, promptCard.id,
      card.cardSplitIndex, card.cardSplitTotal,
    );
    await supabase.from("prompt_cards").update({ slug }).eq("id", promptCard.id);
  }

  // Rebuild child rows (idempotent on rerun)
  await supabase.from("prompt_variant_media").delete().in(
    "variant_id",
    (
      await supabase.from("prompt_variants").select("id").eq("card_id", promptCard.id)
    ).data?.map((v) => v.id) ?? ["00000000-0000-0000-0000-000000000000"],
  );
  await supabase.from("prompt_variants").delete().eq("card_id", promptCard.id);
  await supabase.from("prompt_card_media").delete().eq("card_id", promptCard.id);

  const mediaRows: Array<{ id: string; media_index: number }> = [];
  for (const media of card.media) {
    const uploaded = await uploadMedia(supabase, card, media, false);
    if (!uploaded) continue;
    const { data: mediaRow, error: mediaErr } = await supabase
      .from("prompt_card_media")
      .insert({
        card_id: promptCard.id,
        media_index: media.mediaIndex,
        media_type: media.mediaType,
        storage_bucket: uploaded.storageBucket,
        storage_path: uploaded.storagePath,
        original_relative_path: media.sourceRelativePath,
        thumb_relative_path: media.thumbRelativePath,
        is_primary: media.isPrimary,
        mime_type: uploaded.mimeType,
        file_size_bytes: uploaded.fileSizeBytes,
      })
      .select("id, media_index")
      .single();
    if (mediaErr || !mediaRow) continue;
    mediaRows.push(mediaRow);
  }
  // "before" media is managed manually by admin in prompt_card_before_media.
  // Ingestion must not auto-fill or overwrite it.

  const variantRows: Array<{ id: string; variant_index: number }> = [];
  for (const variant of card.variants) {
    const { data: variantRow, error: variantErr } = await supabase
      .from("prompt_variants")
      .insert({
        card_id: promptCard.id,
        variant_index: variant.variantIndex,
        label_raw: variant.labelRaw,
        prompt_text_ru: variant.promptTextRu,
        prompt_text_en: variant.promptTextEn,
        prompt_normalized_ru: variant.promptTextRu,
        prompt_normalized_en: variant.promptTextEn,
        match_strategy: variant.matchStrategy,
      })
      .select("id, variant_index")
      .single();
    if (variantErr || !variantRow) continue;
    variantRows.push(variantRow);
  }

  const variantIdByIndex = new Map<number, string>(variantRows.map((v) => [v.variant_index, v.id]));
  const mediaIdByIndex = new Map<number, string>(mediaRows.map((m) => [m.media_index, m.id]));
  const links = card.variantMediaLinks
    .map((l) => ({
      variant_id: variantIdByIndex.get(l.variantIndex),
      media_id: mediaIdByIndex.get(l.mediaIndex),
    }))
    .filter((x): x is { variant_id: string; media_id: string } => Boolean(x.variant_id && x.media_id));

  if (links.length > 0) {
    const { error: linkErr } = await supabase.from("prompt_variant_media").insert(links);
    if (linkErr) {
      throw new Error(`Failed insert prompt_variant_media: ${linkErr.message}`);
    }
  }

  return { cardId: promptCard.id, mediaRows, variantRows };
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();
  const parsed = await parseDataset(args.datasetSlug);
  parsed.cards.sort((a, b) => a.sourceMessageId - b.sourceMessageId);
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL env. Expected one of: SUPABASE_SUPABASE_PUBLIC_URL, SUPABASE_URL, SUPABASE_PUBLIC_URL, NEXT_PUBLIC_SUPABASE_URL",
    );
  }
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Supplier-aware dedup: find all datasets from the same supplier
  const supplierKey = parseSupplierKey(args.datasetSlug);
  const allSupplierSlugs = await findSupplierDatasetSlugs(supabase, supplierKey, args.datasetSlug);
  const existingSupplierIds = await fetchExistingSourceMessageIds(supabase, allSupplierSlugs);
  // eslint-disable-next-line no-console
  console.log(`[supplier] key=${supplierKey} datasets=[${allSupplierSlugs.join(', ')}] existing=${existingSupplierIds.size}`);

  let selectedCards = parsed.cards;
  if (args.messageId != null) {
    selectedCards = selectedCards.filter((c) => c.sourceMessageId === args.messageId);
  }
  if (args.existingOnly) {
    selectedCards = selectedCards.filter((c) => existingSupplierIds.has(c.sourceMessageId));
  }

  // Auto-dedup: skip cards already imported from ANY supplier dataset
  let skippedDuplicates = 0;
  if (!args.existingOnly) {
    const beforeDedup = selectedCards.length;
    selectedCards = selectedCards.filter((c) => !existingSupplierIds.has(c.sourceMessageId));
    skippedDuplicates = beforeDedup - selectedCards.length;
  }

  // Group by (dataset, messageId) and slice by MESSAGES, never split a group
  const msgKeys = [...new Set(selectedCards.map((c) => `${c.datasetSlug}::${c.sourceMessageId}`))].sort();
  const from = Math.min(args.offset, msgKeys.length);
  const take = typeof args.limit === "number" ? args.limit : msgKeys.length - from;
  const selectedMsgKeys = new Set(msgKeys.slice(from, from + take));
  const cardsToIngest = selectedCards.filter((c) => selectedMsgKeys.has(`${c.datasetSlug}::${c.sourceMessageId}`));
  const channelTitle = parsed.cards[0]?.channelTitle ?? args.datasetSlug;

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          dataset: args.datasetSlug,
          supplierKey,
          supplierDatasets: allSupplierSlugs,
          dryRun: true,
          cardsTotal: parsed.cards.length,
          skippedDuplicates,
          cardsSelected: cardsToIngest.length,
          parsedSuccess: cardsToIngest.length,
          parsedFailed: 0,
          mediaSaved: cardsToIngest.reduce(
            (sum, c) => sum + c.media.filter((m) => m.mediaType === "photo").length,
            0,
          ),
          skippedNoBlockquote: parsed.skippedNoPrompt,
          skippedNoPhoto: parsed.skippedNoPhoto,
          runId: "dry-run-run-id",
        },
        null,
        2,
      ),
    );
    return;
  }

  const dataset = await upsertDataset(supabase, args.datasetSlug, channelTitle, args.dryRun);
  const run = await createRun(supabase, dataset.id, parsed.htmlFiles, cardsToIngest.length, args.dryRun);

  let success = 0;
  let failed = 0;
  let mediaSaved = 0;
  const errors: string[] = [];

  for (const card of cardsToIngest) {
    try {
      const result = await ingestCard(supabase, card, dataset.id, run.id, args.dryRun);
      success += 1;
      mediaSaved += result.mediaRows.length;
    } catch (error) {
      failed += 1;
      errors.push(`${card.sourceMessageId}: ${(error as Error).message}`);
    }
  }

  await finalizeRun(
    supabase,
    run.id,
    {
      status: failed > 0 ? "partial" : "success",
      finished_at: new Date().toISOString(),
      groups_parsed: success,
      groups_failed: failed,
      groups_skipped: parsed.skippedNoPrompt + parsed.skippedNoPhoto,
      error_summary: errors.slice(0, 10).join(" | "),
      meta: {
        skipped_no_blockquote: parsed.skippedNoPrompt,
        skipped_no_photo: parsed.skippedNoPhoto,
        media_saved: mediaSaved,
        dry_run: args.dryRun,
      },
    },
    args.dryRun,
  );

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        dataset: args.datasetSlug,
        supplierKey,
        supplierDatasets: allSupplierSlugs,
        dryRun: args.dryRun,
        cardsTotal: parsed.cards.length,
        skippedDuplicates,
        cardsSelected: cardsToIngest.length,
        parsedSuccess: success,
        parsedFailed: failed,
        mediaSaved,
        skippedNoBlockquote: parsed.skippedNoPrompt,
        skippedNoPhoto: parsed.skippedNoPhoto,
        runId: run.id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

