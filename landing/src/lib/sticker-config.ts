import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase-server-client";
import { STICKER_CONFIG_ENABLED_KEY, isStickerFlagOn } from "@/lib/sticker";

/**
 * Page-side read of `sticker_generation_enabled`. Missing row / read error → off,
 * so `/stiker-iz-foto` renders the locked state and `noindex` instead of a broken studio.
 * `POST /api/generate` reads the same key — one switch for UI and API.
 */
export const readStickerGenerationEnabled = cache(async (): Promise<boolean> => {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("landing_generation_config")
      .select("value")
      .eq("key", STICKER_CONFIG_ENABLED_KEY)
      .maybeSingle();
    if (error) {
      console.warn("[sticker] config read failed", { message: error.message });
      return false;
    }
    return isStickerFlagOn(data?.value as string | undefined);
  } catch (error) {
    console.warn("[sticker] config read failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
});
