/**
 * Sticker catalog from the bot's tables — same Supabase project as photo2sticker.
 * `style_groups` / `style_presets_v2` / `emotion_presets` / `motion_presets` are owned by the bot repo;
 * the landing only reads active rows. Falls back to `STICKER_STYLES` when the read fails.
 * Landing-only (Supabase client); the worker never imports this file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_STICKER_STYLE_ID,
  STICKER_CUSTOM_PRESET_ID,
  STICKER_STYLES,
  type StickerEditAction,
  type StickerPreset,
  type StickerStyle,
  type StickerStyleGroup,
} from "./sticker";
import { loadStickerExampleUrls, type StickerExampleMap } from "./sticker-examples";

export type StickerCatalog = {
  groups: StickerStyleGroup[];
  styles: StickerStyle[];
  emotions: StickerPreset[];
  motions: StickerPreset[];
  /** `false` when styles came from the static fallback. */
  fromDb: boolean;
};

type StyleGroupRow = { id: string; emoji: string | null; name_ru: string | null; sort_order: number | null };
type StylePresetRow = {
  id: string;
  group_id: string | null;
  emoji: string | null;
  name_ru: string | null;
  prompt_hint: string | null;
  description_ru: string | null;
  is_default: boolean | null;
  sort_order: number | null;
};
type PresetRow = { id: string; emoji: string | null; name_ru: string | null; prompt_hint: string | null; sort_order: number | null };

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function mapStyleRows(rows: readonly StylePresetRow[]): StickerStyle[] {
  const styles: StickerStyle[] = [];
  for (const row of rows) {
    const id = cleanText(row.id);
    const prompt = cleanText(row.prompt_hint);
    const label = cleanText(row.name_ru);
    if (!id || !prompt || !label) continue;
    styles.push({
      id,
      label,
      hint: cleanText(row.description_ru) || label,
      prompt,
      groupId: cleanText(row.group_id) || null,
      emoji: cleanText(row.emoji) || null,
      description: cleanText(row.description_ru) || null,
      isDefault: Boolean(row.is_default),
    });
  }
  return styles;
}

export function mapPresetRows(rows: readonly PresetRow[]): StickerPreset[] {
  const presets: StickerPreset[] = [];
  for (const row of rows) {
    const id = cleanText(row.id);
    const hint = cleanText(row.prompt_hint);
    const label = cleanText(row.name_ru);
    // Bot keeps a `custom` row with an empty hint as the free-text entry; the web has its own input for that.
    if (!id || id === STICKER_CUSTOM_PRESET_ID || !hint || !label) continue;
    presets.push({ id, label, emoji: cleanText(row.emoji) || null, hint });
  }
  return presets;
}

export function fallbackStickerCatalog(): StickerCatalog {
  return {
    groups: [],
    styles: STICKER_STYLES.map((style) => ({ ...style, isDefault: style.id === DEFAULT_STICKER_STYLE_ID })),
    emotions: [],
    motions: [],
    fromDb: false,
  };
}

/** Default style id: bot `is_default`, else first row. */
export function defaultStickerStyleId(styles: readonly StickerStyle[]): string {
  return styles.find((style) => style.isDefault)?.id ?? styles[0]?.id ?? DEFAULT_STICKER_STYLE_ID;
}

export function findStickerStyleInCatalog(styles: readonly StickerStyle[], id: unknown): StickerStyle | null {
  const key = cleanText(id);
  if (!key) return null;
  return styles.find((style) => style.id === key) ?? null;
}

export function findStickerPreset(catalog: Pick<StickerCatalog, "emotions" | "motions">, action: StickerEditAction, id: unknown): StickerPreset | null {
  const key = cleanText(id);
  if (!key) return null;
  const list = action === "emotion" ? catalog.emotions : catalog.motions;
  return list.find((preset) => preset.id === key) ?? null;
}

export function attachStickerExamples(styles: readonly StickerStyle[], examples: StickerExampleMap): StickerStyle[] {
  return styles.map((style) => ({ ...style, exampleUrls: examples.get(style.id) ?? [] }));
}

export async function loadStickerCatalog(supabase: SupabaseClient): Promise<StickerCatalog> {
  const [groupsRes, stylesRes, emotionsRes, motionsRes, examples] = await Promise.all([
    supabase.from("style_groups").select("id,emoji,name_ru,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase
      .from("style_presets_v2")
      .select("id,group_id,emoji,name_ru,prompt_hint,description_ru,is_default,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("emotion_presets").select("id,emoji,name_ru,prompt_hint,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("motion_presets").select("id,emoji,name_ru,prompt_hint,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
    loadStickerExampleUrls(supabase),
  ]);
  if (stylesRes.error) {
    console.error("[sticker-catalog] style_presets_v2 read failed", { error: stylesRes.error.message });
  }
  const mapped = mapStyleRows((stylesRes.data || []) as StylePresetRow[]);
  if (!mapped.length) {
    const fallback = fallbackStickerCatalog();
    return {
      ...fallback,
      styles: attachStickerExamples(fallback.styles, examples),
      emotions: mapPresetRows((emotionsRes.data || []) as PresetRow[]),
      motions: mapPresetRows((motionsRes.data || []) as PresetRow[]),
    };
  }
  const styles = attachStickerExamples(mapped, examples);
  const usedGroups = new Set(styles.map((style) => style.groupId).filter(Boolean));
  const groups: StickerStyleGroup[] = ((groupsRes.data || []) as StyleGroupRow[])
    .filter((row) => usedGroups.has(cleanText(row.id)))
    .map((row) => ({ id: cleanText(row.id), label: cleanText(row.name_ru) || cleanText(row.id), emoji: cleanText(row.emoji) || null }));
  return {
    groups,
    styles,
    emotions: mapPresetRows((emotionsRes.data || []) as PresetRow[]),
    motions: mapPresetRows((motionsRes.data || []) as PresetRow[]),
    fromDb: true,
  };
}

/** One style by id for `POST /api/generate`: DB row first, static fallback second. */
export async function resolveStickerStyleForEnqueue(supabase: SupabaseClient, id: unknown): Promise<StickerStyle | null> {
  const key = cleanText(id);
  if (!key) return null;
  const { data, error } = await supabase
    .from("style_presets_v2")
    .select("id,group_id,emoji,name_ru,prompt_hint,description_ru,is_default,sort_order")
    .eq("id", key)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[sticker-catalog] style lookup failed", { id: key, error: error.message });
  }
  const fromDb = data ? mapStyleRows([data as StylePresetRow])[0] : null;
  return fromDb ?? findStickerStyleInCatalog(STICKER_STYLES, key);
}

/** One emotion / motion preset by id for `POST /api/generate`. */
export async function resolveStickerPresetForEnqueue(
  supabase: SupabaseClient,
  action: StickerEditAction,
  id: unknown,
): Promise<StickerPreset | null> {
  const key = cleanText(id);
  if (!key || key === STICKER_CUSTOM_PRESET_ID) return null;
  const table = action === "emotion" ? "emotion_presets" : "motion_presets";
  const { data, error } = await supabase
    .from(table)
    .select("id,emoji,name_ru,prompt_hint,sort_order")
    .eq("id", key)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[sticker-catalog] preset lookup failed", { table, id: key, error: error.message });
    return null;
  }
  return data ? (mapPresetRows([data as PresetRow])[0] ?? null) : null;
}
