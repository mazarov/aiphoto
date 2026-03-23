/**
 * Канонические пресеты для промо-фото карточек (листинг, категории, /p/[slug]).
 * @see docs/23-03-canonical-image-presets-requirements.md
 */

/** Пресет A — сетка и мелкие врезки (листинг, поиск, before, миниатюры). */
export const CARD_IMAGE_GRID_MAX_WIDTH_PX = 768;

/** Пресет B — герой страницы карточки (LCP). */
export const CARD_IMAGE_HERO_MAX_WIDTH_PX = 1200;

export const CARD_IMAGE_GRID_QUALITY = 80;
export const CARD_IMAGE_HERO_QUALITY = 82;

/** Единая подсказка `sizes` для пресета A (все сеточные и мелкие врезки). */
export const SIZES_CARD_GRID =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

/**
 * Пресет B — узкий герой на /p/[slug] (max-w 260px / 300px sm+).
 */
export const SIZES_CARD_HERO = "(max-width: 640px) 260px, 300px";

/**
 * Пресет B — полноширинный герой (например `PhotoCarousel`); тот же max width в URL (`hero`).
 */
export const SIZES_CARD_HERO_VIEWPORT =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

export type CardImagePreset = "grid" | "hero";

/**
 * Публичный URL через Storage Image Transformation (`/render/image/public/...`).
 * Включать только при поднятом imgproxy и `ENABLE_IMAGE_TRANSFORMATION` на storage-api.
 */
export function buildStorageRenderImagePublicUrl(
  supabaseOrigin: string,
  bucket: string,
  objectPath: string,
  preset: CardImagePreset
): string {
  const base = supabaseOrigin.replace(/\/$/, "");
  const w =
    preset === "grid"
      ? CARD_IMAGE_GRID_MAX_WIDTH_PX
      : CARD_IMAGE_HERO_MAX_WIDTH_PX;
  const q =
    preset === "grid" ? CARD_IMAGE_GRID_QUALITY : CARD_IMAGE_HERO_QUALITY;
  return `${base}/storage/v1/render/image/public/${bucket}/${objectPath}?width=${w}&quality=${q}`;
}
