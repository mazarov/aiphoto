import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

type PromptCardViewModel = {
  id: string;
  datasetSlug: string;
  sourceMessageId: string;
  sourceDate: string | null;
  title: string;
  promptTextsRu: string[];
  promptTextsEn: string[];
  hashtags: string[];
  photoCount: number;
  promptCount: number;
  warnings: string[];
  previewImagePath: string | null;
  previewImagePaths: string[];
  previewStorageBuckets: string[];
  previewStoragePaths: string[];
  beforeImagePath: string | null;
  beforeAfterEnabled: boolean;
};

type Args = {
  outDir: string;
  dataset?: string;
  limit?: number;
  signHours: number;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let outDir = path.resolve(process.cwd(), "export", "prototype", "prompt-cards");
  let dataset: string | undefined;
  let limit: number | undefined;
  let signHours = 24;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--out-dir") {
      const val = args[i + 1];
      if (val) outDir = path.resolve(process.cwd(), val);
    }
    if (token === "--dataset") {
      const val = args[i + 1];
      if (val) dataset = val;
    }
    if (token === "--limit") {
      const val = Number(args[i + 1]);
      if (Number.isFinite(val) && val > 0) limit = val;
    }
    if (token === "--sign-hours") {
      const val = Number(args[i + 1]);
      if (Number.isFinite(val) && val > 0) signHours = val;
    }
  }

  return { outDir, dataset, limit, signHours };
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
    if (existsSync(p)) loadDotenv({ path: p, override: false });
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

type DbCard = {
  id: string;
  title_ru: string;
  hashtags: string[] | null;
  source_dataset_slug: string;
  source_message_id: number;
  source_date: string;
  parse_warnings: unknown;
};

type DbVariant = {
  card_id: string;
  variant_index: number;
  prompt_text_ru: string;
  prompt_text_en: string | null;
};

type DbMedia = {
  card_id: string;
  media_type: "photo" | "video";
  storage_bucket: string;
  storage_path: string;
  is_primary: boolean;
};

type DbBeforeMedia = {
  card_id: string;
  storage_bucket: string;
  storage_path: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSupabaseError(errorMessage: string): boolean {
  return /502|bad gateway|timeout|temporarily unavailable/i.test(errorMessage);
}

function parseWarnings(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (!raw) return [];
  if (typeof raw === "string") return raw ? [raw] : [];
  return [];
}

async function fetchAllCards(
  supabase: ReturnType<typeof createClient>,
  dataset?: string,
  limit?: number,
): Promise<DbCard[]> {
  const pageSize = 1000;
  let from = 0;
  const all: DbCard[] = [];

  while (true) {
    let query = supabase
      .from("prompt_cards")
      .select("id,title_ru,hashtags,source_dataset_slug,source_message_id,source_date,parse_warnings")
      .order("source_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (dataset) query = query.eq("source_dataset_slug", dataset);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch prompt_cards: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...(data as DbCard[]));
    if (typeof limit === "number" && all.length >= limit) {
      return all.slice(0, limit);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchVariantsByCardIds(
  supabase: ReturnType<typeof createClient>,
  cardIds: string[],
): Promise<Map<string, DbVariant[]>> {
  const out = new Map<string, DbVariant[]>();
  const chunkSize = 50;
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize);
    let data: DbVariant[] | null = null;
    let fetchError: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await supabase
        .from("prompt_variants")
        .select("card_id,variant_index,prompt_text_ru,prompt_text_en")
        .in("card_id", chunk)
        .order("variant_index", { ascending: true });
      if (!res.error) {
        data = (res.data || []) as DbVariant[];
        fetchError = null;
        break;
      }
      fetchError = res.error.message;
      if (!isRetryableSupabaseError(fetchError) || attempt >= 3) break;
      await sleep(350 * attempt);
    }
    if (fetchError) throw new Error(`Failed to fetch prompt_variants: ${fetchError}`);
    for (const row of data || []) {
      const arr = out.get(row.card_id) || [];
      arr.push(row);
      out.set(row.card_id, arr);
    }
  }
  return out;
}

async function fetchMediaByCardIds(
  supabase: ReturnType<typeof createClient>,
  cardIds: string[],
): Promise<Map<string, DbMedia[]>> {
  const out = new Map<string, DbMedia[]>();
  const chunkSize = 20;
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize);
    let data: DbMedia[] | null = null;
    let fetchError: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await supabase
        .from("prompt_card_media")
        .select("card_id,media_type,storage_bucket,storage_path,is_primary")
        .in("card_id", chunk)
        .order("is_primary", { ascending: false })
        .order("media_index", { ascending: true });
      if (!res.error) {
        data = (res.data || []) as DbMedia[];
        fetchError = null;
        break;
      }
      fetchError = res.error.message;
      if (!isRetryableSupabaseError(fetchError) || attempt >= 3) break;
      await sleep(350 * attempt);
    }
    if (fetchError) throw new Error(`Failed to fetch prompt_card_media: ${fetchError}`);
    for (const row of data || []) {
      const arr = out.get(row.card_id) || [];
      arr.push(row);
      out.set(row.card_id, arr);
    }
  }
  return out;
}

async function fetchBeforeMediaByCardIds(
  supabase: ReturnType<typeof createClient>,
  cardIds: string[],
): Promise<Map<string, DbBeforeMedia>> {
  const out = new Map<string, DbBeforeMedia>();
  const chunkSize = 20;
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize);
    let data: DbBeforeMedia[] | null = null;
    let fetchError: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await supabase
        .from("prompt_card_before_media")
        .select("card_id,storage_bucket,storage_path")
        .in("card_id", chunk);
      if (!res.error) {
        data = (res.data || []) as DbBeforeMedia[];
        fetchError = null;
        break;
      }
      fetchError = res.error.message;
      if (!isRetryableSupabaseError(fetchError) || attempt >= 3) break;
      await sleep(350 * attempt);
    }
    if (fetchError) throw new Error(`Failed to fetch prompt_card_before_media: ${fetchError}`);
    for (const row of data || []) {
      out.set(row.card_id, row);
    }
  }
  return out;
}

async function createSignedUrlMap(
  supabase: ReturnType<typeof createClient>,
  mediaItems: DbMedia[],
  signHours: number,
): Promise<Map<string, string>> {
  const ttlSeconds = Math.max(1, Math.floor(signHours * 3600));
  const byBucket = new Map<string, string[]>();
  const dedupe = new Set<string>();
  for (const media of mediaItems) {
    const key = `${media.storage_bucket}:${media.storage_path}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    const arr = byBucket.get(media.storage_bucket) || [];
    arr.push(media.storage_path);
    byBucket.set(media.storage_bucket, arr);
  }

  const out = new Map<string, string>();
  for (const [bucket, paths] of byBucket.entries()) {
    const batchSize = 100;
    for (let i = 0; i < paths.length; i += batchSize) {
      const chunk = paths.slice(i, i + batchSize);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(chunk, ttlSeconds);
      if (error) continue;
      for (let j = 0; j < chunk.length; j += 1) {
        const signed = data?.[j]?.signedUrl;
        if (signed) out.set(`${bucket}:${chunk[j]}`, signed);
      }
    }
  }
  return out;
}

function buildHtml(cards: PromptCardViewModel[], supabaseUrl: string, writeKey: string): string {
  const cardsJson = JSON.stringify(cards);
  const supabaseUrlJson = JSON.stringify(supabaseUrl);
  const writeKeyJson = JSON.stringify(writeKey);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Cards Local Prototype</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f6f7f9; color: #15171a; }
    .container { max-width: 1440px; margin: 0 auto; padding: 16px; }
    .toolbar { position: sticky; top: 0; z-index: 5; background: #fff; border: 1px solid #e4e8ef; border-radius: 12px; padding: 12px; display: grid; gap: 10px; grid-template-columns: 220px 1fr auto auto; align-items: center; }
    .toolbar select, .toolbar input[type="text"] { width: 100%; border: 1px solid #c9d2df; border-radius: 8px; padding: 9px 10px; font-size: 14px; }
    .toolbar label { display: inline-flex; gap: 8px; align-items: center; font-size: 14px; color: #2f3847; }
    .counter { font-size: 14px; color: #334; white-space: nowrap; }
    .grid { margin-top: 14px; display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .card { background: #fff; border: 1px solid #e0e6ef; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; min-height: 360px; }
    .preview { position: relative; aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center; background: #eef2f8; border-bottom: 1px solid #e0e6ef; color: #5f6a7c; font-size: 13px; }
    .preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .content { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
    .title { margin: 0; font-size: 16px; line-height: 1.25; }
    .meta { font-size: 12px; color: #576174; }
    .tech-id { font-size: 11px; color: #7a8598; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .thumbs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
    .thumb { border: 1px solid #d2dae7; background: #fff; padding: 0; border-radius: 6px; width: 44px; height: 44px; overflow: hidden; flex: 0 0 auto; cursor: pointer; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb.active { border-color: #4d7cff; box-shadow: 0 0 0 2px rgba(77, 124, 255, 0.2); }
    .before-control { display: flex; gap: 8px; align-items: center; }
    .before-status { font-size: 12px; color: #556178; min-height: 16px; }
    .before-status.ok { color: #1f7a3f; }
    .before-status.err { color: #a03c34; }
    .before-badge { position: absolute; left: 8px; bottom: 8px; width: 64px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.6); box-shadow: 0 2px 8px rgba(0,0,0,0.25); background: rgba(17,23,32,0.7); }
    .before-badge-head { font-size: 10px; color: #fff; text-align: center; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.2); }
    .before-badge-image { aspect-ratio: 1/1; background: #e7edf7; display: flex; align-items: center; justify-content: center; color: #5f6a7c; font-size: 10px; text-align: center; padding: 2px; }
    .before-badge-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge { font-size: 11px; border: 1px solid #d0d8e5; color: #364156; background: #f7f9fc; padding: 3px 7px; border-radius: 999px; }
    .badge.warn { border-color: #f1bc87; background: #fff7ef; color: #8b4d10; }
    .warning-reasons { font-size: 12px; color: #7a4a17; background: #fff8f1; border: 1px solid #f3d4b2; border-radius: 8px; padding: 6px 8px; }
    .prompts { background: #f8fafc; border: 1px solid #e3e8f1; border-radius: 8px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.35; max-height: 170px; overflow: auto; white-space: pre-wrap; }
    .hashtags { font-size: 12px; color: #5a6577; }
    .actions { margin-top: auto; display: flex; gap: 8px; }
    button { border: 1px solid #ccd5e3; background: #fff; border-radius: 8px; padding: 8px 10px; font-size: 13px; cursor: pointer; }
    button:hover { background: #f5f8fe; }
    .load-more { margin: 16px auto 10px; display: block; }
    .state { margin: 16px 0; padding: 16px; border-radius: 10px; background: #fff; border: 1px dashed #ccd4e2; color: #4b5567; }
    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .toolbar { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .toolbar { grid-template-columns: 1fr; position: static; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <select id="datasetFilter"></select>
      <input id="searchInput" type="text" placeholder="Search by title or RU prompts..." />
      <label><input id="warningsOnly" type="checkbox" /> Only problematic (warnings)</label>
      <div class="counter" id="counter"></div>
    </div>
    <div id="state" class="state" style="display:none;"></div>
    <div id="grid" class="grid"></div>
    <button id="loadMoreBtn" class="load-more" type="button">Load more</button>
  </div>

  <script>
    const ALL_CARDS = ${cardsJson};
    const SUPABASE_URL = ${supabaseUrlJson};
    const SUPABASE_WRITE_KEY = ${writeKeyJson};
    const PAGE_SIZE = 60;
    let visibleCount = PAGE_SIZE;

    const datasetFilter = document.getElementById("datasetFilter");
    const searchInput = document.getElementById("searchInput");
    const warningsOnly = document.getElementById("warningsOnly");
    const grid = document.getElementById("grid");
    const counter = document.getElementById("counter");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    const state = document.getElementById("state");

    function esc(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function warningReason(code) {
      const map = {
        missing_date: "Нет даты у исходного сообщения.",
        missing_ru_prompt_text: "В карточке нет RU промпта (только EN или пусто).",
        ambiguous_prompt_photo_mapping: "Связка промпт-фото может быть неоднозначной.",
        split_mapping_no_explicit_markers: "В исходном тексте нет явной разметки Кадр 1/2/3.",
        split_mapping_remainder_distribution: "Фото и промпты делятся неравномерно (распределен остаток).",
        split_mapping_photo_reuse: "Фото меньше, чем промптов; фото переиспользованы.",
        photo_prompt_count_mismatch: "Количество фото и промптов не совпадает.",
      };
      return map[code] || code;
    }

    function cardMatches(card) {
      const selectedDataset = datasetFilter.value;
      const searchTerm = searchInput.value.trim().toLowerCase();
      if (selectedDataset !== "all" && card.datasetSlug !== selectedDataset) return false;
      if (warningsOnly.checked && (!card.warnings || card.warnings.length === 0)) return false;
      if (searchTerm) {
        const haystack = [card.title, ...(card.promptTextsRu || [])].join("\\n").toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    }

    function renderCard(card) {
      const prompts = (card.promptTextsRu && card.promptTextsRu.length > 0)
        ? card.promptTextsRu.join("\\n\\n")
        : "Нет RU промптов";
      const hashtags = (card.hashtags && card.hashtags.length > 0)
        ? card.hashtags.map((t) => "#" + String(t).replace(/^#/, "")).join(" ")
        : "—";
      const warningBadges = (card.warnings || []).map((w) => '<span class="badge warn">' + esc(w) + "</span>").join("");
      const warningCount = (card.warnings || []).length;
      const warningReasons = warningCount > 0
        ? '<div class="warning-reasons">' + (card.warnings || []).map((w) => '• ' + esc(warningReason(w))).join("<br />") + '</div>'
        : '';

      const preview = card.previewImagePath
        ? '<img src="' + esc(card.previewImagePath) + '" alt="preview" data-card-id="' + esc(card.id) + '" />'
        : '<span>No preview image</span>';

      const thumbs = (card.previewImagePaths && card.previewImagePaths.length > 1)
        ? '<div class="thumbs">' + card.previewImagePaths.map((url, idx) =>
            '<button class="thumb' + (idx === 0 ? ' active' : '') + '" type="button" data-thumb-select="' + esc(card.id) + '" data-thumb-index="' + esc(idx) + '" data-thumb-src="' + esc(url) + '" data-thumb-storage-bucket="' + esc(card.previewStorageBuckets[idx] || "") + '" data-thumb-storage-path="' + esc(card.previewStoragePaths[idx] || "") + '">' +
              '<img src="' + esc(url) + '" alt="thumb ' + esc(idx + 1) + '" />' +
            '</button>'
          ).join("") + '</div>'
        : '';
      const beforeControl = card.previewImagePaths && card.previewImagePaths.length > 0
        ? '<div class="before-control">' +
            '<button type="button" data-set-before="' + esc(card.id) + '">Сделать "Было"</button>' +
            '<span class="before-status" data-before-status="' + esc(card.id) + '"></span>' +
          '</div>'
        : "";

      const beforeBadge = card.beforeAfterEnabled
        ? '<div class="before-badge">' +
            '<div class="before-badge-head">Было</div>' +
            '<div class="before-badge-image">' +
              (card.beforeImagePath ? '<img src="' + esc(card.beforeImagePath) + '" alt="before image" />' : '<span>пусто</span>') +
            '</div>' +
          '</div>'
        : "";

      return '<article class="card">' +
        '<div class="preview">' + preview + beforeBadge + '</div>' +
        '<div class="content">' +
          '<h3 class="title">' + esc(card.title) + '</h3>' +
          '<div class="meta">' + esc(card.datasetSlug) + ' · msg ' + esc(card.sourceMessageId) + (card.sourceDate ? ' · ' + esc(card.sourceDate) : '') + '</div>' +
          '<div class="tech-id">id: ' + esc(card.id) + '</div>' +
          thumbs +
          '<div class="badges">' +
            '<span class="badge">photos: ' + esc(card.photoCount) + '</span>' +
            '<span class="badge">prompts: ' + esc(card.promptCount) + '</span>' +
            '<span class="badge' + (warningCount ? ' warn' : '') + '">warnings: ' + esc(warningCount) + '</span>' +
            warningBadges +
          '</div>' +
          warningReasons +
          '<div class="prompts">' + esc(prompts) + '</div>' +
          '<div class="hashtags">' + esc(hashtags) + '</div>' +
          '<div class="actions">' +
            beforeControl +
            '<button type="button" data-copy="' + esc(prompts) + '">Copy RU prompts</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }

    async function upsertBeforeMedia(cardId, storageBucket, storagePath) {
      const response = await fetch(SUPABASE_URL + "/rest/v1/prompt_card_before_media?on_conflict=card_id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_WRITE_KEY,
          Authorization: "Bearer " + SUPABASE_WRITE_KEY,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify([
          {
            card_id: cardId,
            storage_bucket: storageBucket,
            storage_path: storagePath,
            source_rule: "prototype_manual_set",
            updated_at: new Date().toISOString(),
          },
        ]),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error("Supabase update failed: " + response.status + " " + body);
      }
    }

    function render() {
      const filtered = ALL_CARDS.filter(cardMatches);
      const visible = filtered.slice(0, visibleCount);
      counter.textContent = filtered.length + " cards found";

      if (ALL_CARDS.length === 0) {
        state.style.display = "block";
        state.textContent = "No cards loaded from database.";
        grid.innerHTML = "";
        loadMoreBtn.style.display = "none";
        return;
      }

      if (filtered.length === 0) {
        state.style.display = "block";
        state.textContent = "No cards match current filters.";
        grid.innerHTML = "";
        loadMoreBtn.style.display = "none";
        return;
      }

      state.style.display = "none";
      grid.innerHTML = visible.map(renderCard).join("");
      loadMoreBtn.style.display = filtered.length > visible.length ? "block" : "none";
    }

    function resetAndRender() {
      visibleCount = PAGE_SIZE;
      render();
    }

    function fillDatasetFilter() {
      const datasets = [...new Set(ALL_CARDS.map((c) => c.datasetSlug).filter(Boolean))].sort();
      const options = ['<option value="all">All datasets</option>']
        .concat(datasets.map((d) => '<option value="' + esc(d) + '">' + esc(d) + '</option>'));
      datasetFilter.innerHTML = options.join("");
    }

    document.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const thumbButton = target.closest("button[data-thumb-select]");
      if (thumbButton instanceof HTMLButtonElement) {
        const cardId = thumbButton.getAttribute("data-thumb-select");
        const src = thumbButton.getAttribute("data-thumb-src");
        if (!cardId || !src) return;
        const images = document.querySelectorAll('img[data-card-id="' + cardId.replaceAll('"', '\\"') + '"]');
        images.forEach((img) => { img.src = src; });
        const allThumbs = document.querySelectorAll('button[data-thumb-select="' + cardId.replaceAll('"', '\\"') + '"]');
        allThumbs.forEach((btn) => btn.classList.remove("active"));
        thumbButton.classList.add("active");
        return;
      }
      const setBeforeBtn = target.closest("button[data-set-before]");
      if (setBeforeBtn instanceof HTMLButtonElement) {
        const cardId = setBeforeBtn.getAttribute("data-set-before");
        if (!cardId) return;
        const statusEl = document.querySelector('[data-before-status="' + cardId.replaceAll('"', '\\"') + '"]');
        const activeThumb = document.querySelector('button.thumb.active[data-thumb-select="' + cardId.replaceAll('"', '\\"') + '"]');
        if (!(activeThumb instanceof HTMLButtonElement)) {
          if (statusEl instanceof HTMLElement) {
            statusEl.textContent = "Выбери миниатюру";
            statusEl.classList.remove("ok");
            statusEl.classList.add("err");
          }
          return;
        }
        const storageBucket = activeThumb.getAttribute("data-thumb-storage-bucket");
        const storagePath = activeThumb.getAttribute("data-thumb-storage-path");
        const previewSrc = activeThumb.getAttribute("data-thumb-src");
        if (!storageBucket || !storagePath || !previewSrc) {
          if (statusEl instanceof HTMLElement) {
            statusEl.textContent = "Нет данных для обновления";
            statusEl.classList.remove("ok");
            statusEl.classList.add("err");
          }
          return;
        }
        setBeforeBtn.disabled = true;
        const prevText = setBeforeBtn.textContent;
        setBeforeBtn.textContent = "Сохраняю...";
        if (statusEl instanceof HTMLElement) {
          statusEl.textContent = "";
          statusEl.classList.remove("ok", "err");
        }
        try {
          await upsertBeforeMedia(cardId, storageBucket, storagePath);
          const card = ALL_CARDS.find((c) => c.id === cardId);
          if (card) {
            const nextPaths = [];
            const nextBuckets = [];
            const nextStoragePaths = [];
            for (let i = 0; i < (card.previewImagePaths || []).length; i += 1) {
              const p = card.previewStoragePaths?.[i];
              const b = card.previewStorageBuckets?.[i];
              if (p === storagePath && b === storageBucket) continue;
              nextPaths.push(card.previewImagePaths[i]);
              nextBuckets.push(b);
              nextStoragePaths.push(p);
            }
            card.previewImagePaths = nextPaths;
            card.previewStorageBuckets = nextBuckets;
            card.previewStoragePaths = nextStoragePaths;
            card.previewImagePath = nextPaths[0] || null;
            card.beforeImagePath = previewSrc;
            card.beforeAfterEnabled = true;
          }
          if (statusEl instanceof HTMLElement) {
            statusEl.textContent = "Сохранено";
            statusEl.classList.remove("err");
            statusEl.classList.add("ok");
          }
          render();
        } catch (error) {
          if (statusEl instanceof HTMLElement) {
            statusEl.textContent = "Ошибка сохранения";
            statusEl.classList.remove("ok");
            statusEl.classList.add("err");
          }
          // eslint-disable-next-line no-console
          console.error(error);
        } finally {
          setBeforeBtn.disabled = false;
          setBeforeBtn.textContent = prevText || 'Сделать "Было"';
        }
        return;
      }
      if (target.matches("button[data-copy]")) {
        const text = target.getAttribute("data-copy") || "";
        try {
          await navigator.clipboard.writeText(text);
          target.textContent = "Copied";
          setTimeout(() => { target.textContent = "Copy RU prompts"; }, 1000);
        } catch {
          target.textContent = "Copy failed";
          setTimeout(() => { target.textContent = "Copy RU prompts"; }, 1200);
        }
      }
    });

    datasetFilter.addEventListener("change", resetAndRender);
    searchInput.addEventListener("input", resetAndRender);
    warningsOnly.addEventListener("change", resetAndRender);
    loadMoreBtn.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      render();
    });

    fillDatasetFilter();
    render();
  </script>
</body>
</html>`;
}

async function main() {
  loadEnvFiles();
  const args = parseArgs();
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL env. Expected one of: SUPABASE_SUPABASE_PUBLIC_URL, SUPABASE_URL, SUPABASE_PUBLIC_URL, NEXT_PUBLIC_SUPABASE_URL",
    );
  }
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const dbCards = await fetchAllCards(supabase, args.dataset, args.limit);
  const cardIds = dbCards.map((c) => c.id);
  const variantsByCardId = await fetchVariantsByCardIds(supabase, cardIds);
  const mediaByCardId = await fetchMediaByCardIds(supabase, cardIds);
  const beforeMediaByCardId = await fetchBeforeMediaByCardIds(supabase, cardIds);
  const allMedia = [...mediaByCardId.values()].flat();
  const beforeMedia = [...beforeMediaByCardId.values()].map((m) => ({
    card_id: m.card_id,
    media_type: "photo" as const,
    storage_bucket: m.storage_bucket,
    storage_path: m.storage_path,
    is_primary: false,
  }));
  const signedUrls = await createSignedUrlMap(supabase, [...allMedia, ...beforeMedia], args.signHours);

  const cards: PromptCardViewModel[] = dbCards.map((card) => {
    const variants = variantsByCardId.get(card.id) || [];
    const mediaItems = mediaByCardId.get(card.id) || [];
    const photoMediaItems = mediaItems.filter((m) => m.media_type === "photo");
    const photoCount = photoMediaItems.length;
    const beforeMediaRow = beforeMediaByCardId.get(card.id);
    const filteredPhotoMediaItems = beforeMediaRow
      ? photoMediaItems.filter(
          (m) =>
            !(
              m.storage_bucket === beforeMediaRow.storage_bucket &&
              m.storage_path === beforeMediaRow.storage_path
            ),
        )
      : photoMediaItems;
    const photoPreviews = filteredPhotoMediaItems
      .map((m) => ({
        url: signedUrls.get(`${m.storage_bucket}:${m.storage_path}`) || "",
        storageBucket: m.storage_bucket,
        storagePath: m.storage_path,
      }))
      .filter((m) => Boolean(m.url));
    const photoSignedUrls = photoPreviews.map((m) => m.url);
    const signedUrl = photoSignedUrls[0] || null;
    const beforePhotoSignedUrl = beforeMediaRow
      ? signedUrls.get(`${beforeMediaRow.storage_bucket}:${beforeMediaRow.storage_path}`) || null
      : null;
    return {
      id: card.id,
      datasetSlug: card.source_dataset_slug,
      sourceMessageId: String(card.source_message_id),
      sourceDate: card.source_date || null,
      title: card.title_ru || "(untitled)",
      promptTextsRu: variants.map((v) => v.prompt_text_ru).filter(Boolean),
      promptTextsEn: variants.map((v) => v.prompt_text_en || "").filter(Boolean),
      hashtags: Array.isArray(card.hashtags) ? card.hashtags : [],
      photoCount,
      promptCount: variants.length,
      warnings: parseWarnings(card.parse_warnings),
      previewImagePath: signedUrl,
      previewImagePaths: photoSignedUrls,
      previewStorageBuckets: photoPreviews.map((m) => m.storageBucket),
      previewStoragePaths: photoPreviews.map((m) => m.storagePath),
      beforeImagePath: beforePhotoSignedUrl,
      beforeAfterEnabled: Boolean(beforePhotoSignedUrl),
    };
  });

  const html = buildHtml(cards, supabaseUrl, serviceRoleKey);
  await fs.mkdir(args.outDir, { recursive: true });
  const outputPath = path.join(args.outDir, "index.html");
  await fs.writeFile(outputPath, html, "utf-8");

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        source: "supabase",
        datasetFilter: args.dataset ?? null,
        cards: cards.length,
        outputPath,
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

