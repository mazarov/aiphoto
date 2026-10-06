/**
 * Example stickers per style. The landing shows a pinned set
 * (`landing_generation_config.sticker_landing_example_ids`: style id → sticker ids, in display order)
 * and ignores `is_example` for those styles — that flag also drives the Telegram bot, so curating the
 * site must not flip it. Styles absent from the pin fall back to the newest `is_example` rows.
 * Files live in the public `stickers-examples` bucket; a share of stored URLs 404, so candidates are
 * HEAD-checked. Results live in a process cache for 10 minutes.
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
const RENDER_EXAMPLES_PREFIX = "/storage/v1/render/image/public/stickers-examples/";

/**
 * Display sizes for example stickers. Files in the bucket are 512×512 WebP
 * (~50–75 KiB). The page paints them at 56–112 CSS px (Lighthouse: 161 device px).
 * `render/image` at these widths, quality 45, `resize=contain` (imgproxy `fit`, not `fill`)
 * is ~8 KiB and stays WebP with alpha. `format=webp` is a 400 on this storage;
 * `format=origin` is accepted and the body stays VP8X+ALPH even when Accept prefers JPEG.
 */
export const STICKER_EXAMPLE_THUMB_PX = {
  sm: 128,
  md: 192,
  lg: 384,
} as const;

export type StickerExampleThumbSize = keyof typeof STICKER_EXAMPLE_THUMB_PX;

/**
 * Thumb URL for a public examples object. Other buckets and non-URLs pass through.
 * Host is unchanged — the catalog already drops foreign origins.
 */
export function stickerExampleThumbUrl(url: string, size: StickerExampleThumbSize): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "https:") return url;
  let objectPath = "";
  if (parsed.pathname.startsWith(PUBLIC_EXAMPLES_PREFIX)) {
    objectPath = parsed.pathname.slice(PUBLIC_EXAMPLES_PREFIX.length);
  } else if (parsed.pathname.startsWith(RENDER_EXAMPLES_PREFIX)) {
    objectPath = parsed.pathname.slice(RENDER_EXAMPLES_PREFIX.length);
  } else {
    return url;
  }
  if (!objectPath || objectPath.includes("..")) return url;
  const thumb = new URL(parsed.origin);
  thumb.pathname = `${RENDER_EXAMPLES_PREFIX}${objectPath}`;
  thumb.searchParams.set("width", String(STICKER_EXAMPLE_THUMB_PX[size]));
  thumb.searchParams.set("resize", "contain");
  thumb.searchParams.set("quality", "45");
  thumb.searchParams.set("format", "origin");
  return thumb.toString();
}

/** Public storage origin for `<link rel="preconnect">`. Empty env → no hint. */
export function stickerExamplesPublicOrigin(): string | null {
  return supabaseOriginFromEnv();
}

/** `landing_generation_config` key: JSON `{ "<styleId>": ["<sticker uuid>", ...] }` in display order. */
export const STICKER_LANDING_EXAMPLES_KEY = "sticker_landing_example_ids";
const STICKER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PinnedExampleRow = { id: string; public_url: string | null };

/**
 * Pinned ids per style. Junk (non-uuid, duplicates, empty styles) is dropped.
 * `null` when the config is missing or holds nothing usable — caller keeps the `is_example` fallback.
 */
export function parseStickerLandingExampleIds(value: unknown): Record<string, string[]> | null {
  let raw: unknown = value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    try {
      raw = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string[]> = {};
  for (const [styleId, ids] of Object.entries(raw as Record<string, unknown>)) {
    const key = styleId.trim();
    if (!key || !Array.isArray(ids)) continue;
    const clean: string[] = [];
    for (const id of ids) {
      const text = String(id ?? "").trim();
      if (!STICKER_ID_RE.test(text) || clean.includes(text)) continue;
      clean.push(text);
      if (clean.length >= STICKER_EXAMPLES_PER_STYLE) break;
    }
    if (clean.length) out[key] = clean;
  }
  return Object.keys(out).length ? out : null;
}

/** URLs in the pinned order. A style with no live public URL is omitted (no fallback mixed in). */
export function pinnedExampleCandidates(
  pins: Readonly<Record<string, readonly string[]>>,
  rows: readonly PinnedExampleRow[],
  supabaseOrigin: string | null,
): StickerExampleMap {
  const byId = new Map(rows.map((row) => [row.id, row.public_url]));
  const out: StickerExampleMap = new Map();
  for (const [styleId, ids] of Object.entries(pins)) {
    const urls: string[] = [];
    for (const id of ids) {
      const url = byId.get(id);
      if (!isStickerExampleUrl(url, supabaseOrigin) || urls.includes(url)) continue;
      urls.push(url);
    }
    if (urls.length) out.set(styleId, urls);
  }
  return out;
}

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
  const origin = supabaseOriginFromEnv();
  const [pinRes, fallbackRes] = await Promise.all([
    supabase.from("landing_generation_config").select("value").eq("key", STICKER_LANDING_EXAMPLES_KEY).maybeSingle(),
    supabase
      .from("stickers")
      .select("style_preset_id,public_url,created_at")
      .eq("is_example", true)
      .not("public_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(ROWS_LIMIT),
  ]);
  if (fallbackRes.error) {
    console.error("[sticker-examples] stickers read failed", { error: fallbackRes.error.message });
  }
  const pins = pinRes.error ? null : parseStickerLandingExampleIds(pinRes.data?.value);
  if (pinRes.error) {
    console.error("[sticker-examples] pin read failed", { error: pinRes.error.message });
  }
  const candidates = groupExampleCandidates((fallbackRes.data || []) as ExampleRow[], origin);
  // A pinned style never falls back to the newest `is_example` rows: those are exactly what the pin replaces.
  if (pins) {
    for (const styleId of Object.keys(pins)) candidates.delete(styleId);
    const ids = [...new Set(Object.values(pins).flat())];
    const { data, error } = await supabase.from("stickers").select("id,public_url").in("id", ids);
    if (error) {
      console.error("[sticker-examples] pinned stickers read failed", { error: error.message });
    } else {
      for (const [styleId, urls] of pinnedExampleCandidates(pins, (data || []) as PinnedExampleRow[], origin)) {
        candidates.set(styleId, urls);
      }
    }
  }
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
