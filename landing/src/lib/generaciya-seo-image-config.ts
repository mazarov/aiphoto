import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase-server-client";
import {
  GENERACIYA_SEO_IMAGE_FLAG_KEYS,
  GENERACIYA_SEO_IMAGE_FLAGS_OFF,
  parseGeneraciyaSeoImageFlags,
  type GeneraciyaSeoImageFlags,
} from "@/lib/generaciya-seo-image-flags";

const LOGS_TTL_MS = 60_000;

let logsCache: { at: number; value: boolean } | null = null;

export function clearGeneraciyaSeoImageFlagCache(): void {
  logsCache = null;
}

/** Missing row, empty value, or a read error leaves every layer off. */
export const readGeneraciyaSeoImageFlags = cache(
  async (): Promise<GeneraciyaSeoImageFlags> => {
    try {
      const supabase = createSupabaseServer();
      const { data, error } = await supabase
        .from("landing_generation_config")
        .select("key,value")
        .in("key", [...GENERACIYA_SEO_IMAGE_FLAG_KEYS]);
      if (error) {
        console.warn("[generaciya-seo-image] config read failed", {
          message: error.message,
        });
        return GENERACIYA_SEO_IMAGE_FLAGS_OFF;
      }
      return parseGeneraciyaSeoImageFlags(data);
    } catch (error) {
      console.warn("[generaciya-seo-image] config read failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return GENERACIYA_SEO_IMAGE_FLAGS_OFF;
    }
  },
);

/** Image route only. Page SSR reads flags without this delay. */
export async function readGeneraciyaSeoImageLogsEnabled(): Promise<boolean> {
  const now = Date.now();
  if (logsCache && now - logsCache.at < LOGS_TTL_MS) return logsCache.value;
  const flags = await readGeneraciyaSeoImageFlags();
  logsCache = { at: now, value: flags.logs };
  return flags.logs;
}
