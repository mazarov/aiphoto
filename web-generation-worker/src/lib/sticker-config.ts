import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_GPT_IMAGE_QUALITY,
  parseGptImageQuality,
  type GptImageQuality,
} from "../../../landing/src/lib/generation/image-options";
import {
  DEFAULT_STICKER_BG_ROUTE,
  DEFAULT_STICKER_EDGE_MODE,
  STICKER_BG_ROUTE_CONFIG_KEY,
  STICKER_EDGE_MODE_CONFIG_KEY,
  STICKER_IMAGE_QUALITY_CONFIG_KEY,
  parseStickerBgRoute,
  parseStickerEdgeMode,
  type StickerBgRoute,
  type StickerEdgeMode,
} from "../../../landing/src/lib/sticker";

export type StickerWorkerConfig = {
  /** `sticker_bg_route` — chroma key first or always rembg (RGB providers only). */
  bgRoute: StickerBgRoute;
  /** `sticker_image_quality` — GPT Image rendering tier for sticker jobs. */
  imageQuality: GptImageQuality;
  /** `sticker_edge_mode` — keep the soft provider alpha or snap every sticker to a hard edge. */
  edgeMode: StickerEdgeMode;
};

const DEFAULTS: StickerWorkerConfig = {
  bgRoute: DEFAULT_STICKER_BG_ROUTE,
  imageQuality: DEFAULT_GPT_IMAGE_QUALITY,
  edgeMode: DEFAULT_STICKER_EDGE_MODE,
};

const TTL_MS = 60_000;
let cached: { value: StickerWorkerConfig; at: number } | null = null;

/**
 * Sticker knobs from `landing_generation_config`, one query, cached for a minute per process.
 * Read error / missing rows → defaults; flipping a row rolls the behaviour without a redeploy.
 */
export async function getStickerWorkerConfig(supabase: SupabaseClient, now = Date.now()): Promise<StickerWorkerConfig> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  let value: StickerWorkerConfig = { ...DEFAULTS };
  try {
    const { data, error } = await supabase
      .from("landing_generation_config")
      .select("key,value")
      .in("key", [STICKER_BG_ROUTE_CONFIG_KEY, STICKER_IMAGE_QUALITY_CONFIG_KEY, STICKER_EDGE_MODE_CONFIG_KEY]);
    if (!error && Array.isArray(data)) {
      const rows = new Map<string, string | undefined>();
      for (const row of data as { key?: string; value?: string }[]) {
        if (row?.key) rows.set(row.key, row.value);
      }
      value = {
        bgRoute: parseStickerBgRoute(rows.get(STICKER_BG_ROUTE_CONFIG_KEY)),
        imageQuality: parseGptImageQuality(rows.get(STICKER_IMAGE_QUALITY_CONFIG_KEY)),
        edgeMode: parseStickerEdgeMode(rows.get(STICKER_EDGE_MODE_CONFIG_KEY)),
      };
    }
  } catch {
    value = { ...DEFAULTS };
  }
  cached = { value, at: now };
  return value;
}

/** Back-compat shim for callers that only need the route. */
export async function getStickerBgRoute(supabase: SupabaseClient, now = Date.now()): Promise<StickerBgRoute> {
  return (await getStickerWorkerConfig(supabase, now)).bgRoute;
}

/** Tests only. */
export function resetStickerBgRouteCache(): void {
  cached = null;
}
