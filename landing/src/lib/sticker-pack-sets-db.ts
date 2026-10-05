/**
 * Scene source for a web sticker pack: the bot's `pack_content_sets` (shared Supabase).
 * One active 16-sticker set → 16 scene lines for `buildStickerPackPromptText`.
 * Landing-only (Supabase client); the worker reads scenes back from `prompt_text`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STICKER_PACK_COUNT,
  isStickerPackSetId,
  normalizeStickerPackScenes,
} from "./sticker-pack";

const PACK_SETS_TABLE = "pack_content_sets";

export type StickerPackSet = {
  id: string;
  name: string;
  scenes: string[];
};

export type PackSetRow = {
  id: string;
  name_ru: string | null;
  sticker_count: number | null;
  is_active: boolean | null;
  scene_descriptions: unknown;
};

/** Pure mapper: active, 16 stickers, 16 non-empty scenes. Anything else → null. */
export function stickerPackSetFromRow(row: PackSetRow | null | undefined): StickerPackSet | null {
  if (!row || !row.is_active) return null;
  const id = String(row.id ?? "").trim();
  if (!isStickerPackSetId(id)) return null;
  if (Number(row.sticker_count) !== STICKER_PACK_COUNT) return null;
  const scenes = normalizeStickerPackScenes(row.scene_descriptions);
  if (!scenes) return null;
  return {
    id,
    name: String(row.name_ru ?? "").replace(/\s+/g, " ").trim() || id,
    scenes,
  };
}

/** One set by id for `POST /api/generate`. Lookup error → null (400 for the caller). */
export async function resolveStickerPackSetForEnqueue(
  supabase: SupabaseClient,
  id: unknown,
): Promise<StickerPackSet | null> {
  const key = String(id ?? "").trim();
  if (!isStickerPackSetId(key)) return null;
  const { data, error } = await supabase
    .from(PACK_SETS_TABLE)
    .select("id,name_ru,sticker_count,is_active,scene_descriptions")
    .eq("id", key)
    .maybeSingle();
  if (error) {
    console.error("[sticker-pack-sets] lookup failed", { id: key, error: error.message });
    return null;
  }
  return stickerPackSetFromRow(data as PackSetRow | null);
}
