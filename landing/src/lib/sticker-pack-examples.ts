/**
 * Sticker-pack examples the bot already made, plus the geometry of the bot example grid.
 *
 * The bot paints one 4×4 sheet (2048 px → 512 px cells) and cuts it. The web job
 * paints one 4×4 sheet at 1024 px, scales it to 1512, and cuts 378 px stickers.
 *
 * The pictures on the site are the bot carousel grids: `pack_content_sets` that have
 * `sticker_pack_example/<id>/example.webp` in the public `stickers-examples` bucket.
 * Landing-only (Supabase client); the worker never imports this file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STICKER_PACK_COUNT,
  STICKER_PACK_FIT_MARGIN,
  STICKER_PACK_GRID,
  stickerPackCellBox as packCellBox,
  stickerPackGrid,
  type StickerPackCell,
} from "./sticker-pack";

export { STICKER_PACK_COUNT, STICKER_PACK_FIT_MARGIN, STICKER_PACK_GRID, stickerPackGrid };
export type { StickerPackCell };

/** Bot example sheet: 4×4 at this size → 512 px cells, no upscale into the sticker canvas. */
export const STICKER_PACK_SHEET_PX = 2048;
export const STICKER_PACK_CELL_PX = STICKER_PACK_SHEET_PX / STICKER_PACK_GRID;

export const STICKER_PACK_SHEET_TITLE = "Стикер пак";
export const STICKER_PACK_SHEET_LEAD = "16 стикеров с одного фото";
export const STICKER_PACK_TOOL_LABEL = "Стикер пак";

const PACK_SETS_TABLE = "pack_content_sets";
const EXAMPLES_BUCKET = "stickers-examples";
const EXAMPLE_FOLDER = "sticker_pack_example";
const EXAMPLE_FILE = "example.webp";
const PUBLIC_PACK_PREFIX = `/storage/v1/object/public/${EXAMPLES_BUCKET}/${EXAMPLE_FOLDER}/`;
const PACK_ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const CACHE_TTL_MS = 10 * 60 * 1000;
const URL_CHECK_TTL_MS = 60 * 60 * 1000;
const HEAD_TIMEOUT_MS = 3000;
const HEAD_CONCURRENCY = 8;
const LIST_PAGE = 100;
const LIST_CAP = 500;

export type StickerPackExample = {
  id: string;
  name: string;
  description: string;
  stickerCount: number;
  exampleUrl: string;
};

type PackSetRow = {
  id: string;
  name_ru: string | null;
  carousel_description_ru: string | null;
  sort_order: number | null;
  sticker_count: number | null;
};

let cached: { at: number; packs: StickerPackExample[] } | null = null;
let pending: Promise<StickerPackExample[]> | null = null;
const urlChecks = new Map<string, { at: number; ok: boolean }>();

/** Content box inside a 512 canvas after the margin on every side. 5% → 461 px. */
export function stickerPackContentPx(
  canvasPx = STICKER_PACK_CELL_PX,
  marginRatio = STICKER_PACK_FIT_MARGIN,
): number {
  const margin = Math.min(0.45, Math.max(0, marginRatio));
  return Math.round(canvasPx * (1 - 2 * margin));
}

/**
 * Pixel box of cell `index` (row-major, left to right) on the bot example sheet.
 * `null` when the index is past the sticker count. Cells share edges — no gutter.
 */
export function stickerPackCellBox(
  index: number,
  stickerCount = STICKER_PACK_COUNT,
  sheetPx = STICKER_PACK_SHEET_PX,
): StickerPackCell | null {
  return packCellBox(index, stickerCount, sheetPx);
}

export function isStickerPackId(value: unknown): value is string {
  return typeof value === "string" && PACK_ID_RE.test(value);
}

export function stickerPackExampleUrl(id: string, supabaseOrigin: string): string | null {
  if (!isStickerPackId(id)) return null;
  const origin = supabaseOrigin.replace(/\/+$/, "");
  if (!origin.startsWith("https://")) return null;
  return `${origin}${PUBLIC_PACK_PREFIX}${encodeURIComponent(id)}/${EXAMPLE_FILE}`;
}

/** Only the bot's public pack-example file. Anything else from storage is dropped. */
export function isStickerPackExampleUrl(value: unknown, supabaseOrigin: string | null): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (supabaseOrigin && url.origin !== supabaseOrigin) return false;
    if (!url.pathname.startsWith(PUBLIC_PACK_PREFIX)) return false;
    return url.pathname.endsWith(`/${EXAMPLE_FILE}`);
  } catch {
    return false;
  }
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Sets that have a folder in `sticker_pack_example/`, in `sort_order`.
 * A row without a folder, or a folder without a row, is omitted.
 */
export function packExamplesFromRows(
  rows: readonly PackSetRow[],
  folderIds: ReadonlySet<string>,
  supabaseOrigin: string | null,
): StickerPackExample[] {
  if (!supabaseOrigin) return [];
  const packs: StickerPackExample[] = [];
  const sorted = [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const row of sorted) {
    const id = cleanText(row.id);
    if (!folderIds.has(id)) continue;
    const name = cleanText(row.name_ru);
    const exampleUrl = stickerPackExampleUrl(id, supabaseOrigin);
    if (!name || !exampleUrl || !isStickerPackExampleUrl(exampleUrl, supabaseOrigin)) continue;
    packs.push({
      id,
      name,
      description: cleanText(row.carousel_description_ru),
      stickerCount: Number(row.sticker_count) > 0 ? Math.floor(Number(row.sticker_count)) : STICKER_PACK_COUNT,
      exampleUrl,
    });
  }
  return packs;
}

function supabaseOriginFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || "";
  try {
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}

async function headOk(url: string, fetchImpl: typeof fetch, now: number): Promise<boolean> {
  const known = urlChecks.get(url);
  if (known && now - known.at < URL_CHECK_TTL_MS) return known.ok;
  let ok = false;
  try {
    const res = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) });
    ok = res.ok;
  } catch {
    ok = false;
  }
  urlChecks.set(url, { at: now, ok });
  return ok;
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function listExampleFolderIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let offset = 0; offset < LIST_CAP; offset += LIST_PAGE) {
    const { data, error } = await supabase.storage.from(EXAMPLES_BUCKET).list(EXAMPLE_FOLDER, {
      limit: LIST_PAGE,
      offset,
    });
    if (error) throw new Error(error.message);
    for (const entry of data ?? []) {
      if (isStickerPackId(entry.name)) ids.add(entry.name);
    }
    if (!data || data.length < LIST_PAGE) break;
  }
  return ids;
}

async function loadFresh(supabase: SupabaseClient, fetchImpl: typeof fetch): Promise<StickerPackExample[]> {
  const origin = supabaseOriginFromEnv();
  const [folderIds, setsRes] = await Promise.all([
    listExampleFolderIds(supabase),
    supabase
      .from(PACK_SETS_TABLE)
      .select("id,name_ru,carousel_description_ru,sort_order,sticker_count")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (setsRes.error) throw new Error(setsRes.error.message);
  const candidates = packExamplesFromRows((setsRes.data ?? []) as PackSetRow[], folderIds, origin);
  const checks = await mapLimited(candidates, HEAD_CONCURRENCY, async (pack) =>
    headOk(pack.exampleUrl, fetchImpl, Date.now()),
  );
  return candidates.filter((_, index) => checks[index]);
}

/**
 * Active packs that still have a live example grid. One storage list + one table read
 * per 10 minutes per process. Failure keeps the previous list, or empty.
 */
export async function loadStickerPackExamples(
  supabase: SupabaseClient,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<StickerPackExample[]> {
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.packs;
  if (pending) return pending;
  pending = loadFresh(supabase, fetchImpl)
    .then((packs) => {
      cached = { at: now, packs };
      return packs;
    })
    .catch((err) => {
      console.error("[sticker-pack-examples] failed", err);
      return cached?.packs ?? [];
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Tests only. */
export function resetStickerPackExamplesCache(): void {
  cached = null;
  pending = null;
  urlChecks.clear();
}
