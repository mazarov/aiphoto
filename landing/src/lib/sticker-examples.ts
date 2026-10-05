/**
 * Example stickers per style from the bot's `stickers` table (`is_example = true`, `public_url` in the
 * public `stickers-examples` bucket). A share of stored URLs point at deleted files, so candidates are
 * HEAD-checked before they reach the catalog; results live in a process cache for 10 minutes.
 * Landing-only (Supabase client); the worker never imports this file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const STICKER_EXAMPLES_PER_STYLE = 3;
/** Newest rows checked per style; the first `STICKER_EXAMPLES_PER_STYLE` that answer 2xx win. */
const CANDIDATES_PER_STYLE = 4;
const ROWS_LIMIT = 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const URL_CHECK_TTL_MS = 60 * 60 * 1000;
const HEAD_TIMEOUT_MS = 3000;
const HEAD_CONCURRENCY = 12;
const PUBLIC_EXAMPLES_PREFIX = "/storage/v1/object/public/stickers-examples/";

type ExampleRow = { style_preset_id: string | null; public_url: string | null; created_at: string | null };

export type StickerExampleMap = Map<string, string[]>;

let cached: { at: number; byStyle: StickerExampleMap } | null = null;
let pending: Promise<StickerExampleMap> | null = null;
const urlChecks = new Map<string, { at: number; ok: boolean }>();

/** Only the bot's public examples bucket; anything else from the row is dropped. */
export function isStickerExampleUrl(value: unknown, supabaseOrigin: string | null): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (supabaseOrigin && url.origin !== supabaseOrigin) return false;
    return url.pathname.startsWith(PUBLIC_EXAMPLES_PREFIX);
  } catch {
    return false;
  }
}

/** Newest first, de-duplicated, at most `perStyle` candidates per style. */
export function groupExampleCandidates(
  rows: readonly ExampleRow[],
  supabaseOrigin: string | null,
  perStyle = CANDIDATES_PER_STYLE,
): StickerExampleMap {
  const byStyle: StickerExampleMap = new Map();
  for (const row of rows) {
    const styleId = String(row.style_preset_id ?? "").trim();
    if (!styleId || !isStickerExampleUrl(row.public_url, supabaseOrigin)) continue;
    const list = byStyle.get(styleId) ?? [];
    if (list.length >= perStyle || list.includes(row.public_url)) continue;
    list.push(row.public_url);
    byStyle.set(styleId, list);
  }
  return byStyle;
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

export async function validateExampleCandidates(
  candidates: StickerExampleMap,
  fetchImpl: typeof fetch,
  now = Date.now(),
  perStyle = STICKER_EXAMPLES_PER_STYLE,
): Promise<StickerExampleMap> {
  const all = [...candidates.values()].flat();
  const unique = [...new Set(all)];
  const results = await mapLimited(unique, HEAD_CONCURRENCY, async (url) => [url, await headOk(url, fetchImpl, now)] as const);
  const okSet = new Set(results.filter(([, ok]) => ok).map(([url]) => url));
  const validated: StickerExampleMap = new Map();
  for (const [styleId, urls] of candidates) {
    const good = urls.filter((url) => okSet.has(url)).slice(0, perStyle);
    if (good.length) validated.set(styleId, good);
  }
  return validated;
}

function supabaseOriginFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL || "";
  try {
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}

async function loadFresh(supabase: SupabaseClient, fetchImpl: typeof fetch): Promise<StickerExampleMap> {
  const { data, error } = await supabase
    .from("stickers")
    .select("style_preset_id,public_url,created_at")
    .eq("is_example", true)
    .not("public_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(ROWS_LIMIT);
  if (error) {
    console.error("[sticker-examples] stickers read failed", { error: error.message });
    return new Map();
  }
  const candidates = groupExampleCandidates((data || []) as ExampleRow[], supabaseOriginFromEnv());
  return validateExampleCandidates(candidates, fetchImpl);
}

/**
 * `styleId → up to 3 live example URLs`. Shared by `/api/sticker-catalog` and the ISR page; one DB read
 * plus bounded HEAD checks per 10 minutes per process. Any failure → empty map (styles render without pictures).
 */
export async function loadStickerExampleUrls(
  supabase: SupabaseClient,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<StickerExampleMap> {
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.byStyle;
  if (pending) return pending;
  pending = loadFresh(supabase, fetchImpl)
    .then((byStyle) => {
      cached = { at: now, byStyle };
      return byStyle;
    })
    .catch((err) => {
      console.error("[sticker-examples] failed", err);
      return cached?.byStyle ?? new Map<string, string[]>();
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Tests only. */
export function resetStickerExamplesCache(): void {
  cached = null;
  pending = null;
  urlChecks.clear();
}
