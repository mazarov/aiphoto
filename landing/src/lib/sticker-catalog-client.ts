/**
 * Browser-side cache for `GET /api/sticker-catalog` — one fetch per page session,
 * shared by the dock style picker, the compose tile and the result action sheet.
 */

import type { StickerPreset, StickerStyle, StickerStyleGroup } from "./sticker";

export type StickerCatalogClient = {
  groups: StickerStyleGroup[];
  styles: StickerStyle[];
  defaultStyleId: string;
  emotions: StickerPreset[];
  motions: StickerPreset[];
  fromDb: boolean;
};

export const STICKER_CATALOG_ENDPOINT = "/api/sticker-catalog";

let pending: Promise<StickerCatalogClient> | null = null;
let resolved: StickerCatalogClient | null = null;

export function peekStickerCatalog(): StickerCatalogClient | null {
  return resolved;
}

export function loadStickerCatalogClient(fetchImpl: typeof fetch = fetch): Promise<StickerCatalogClient> {
  if (resolved) return Promise.resolve(resolved);
  if (pending) return pending;
  pending = fetchImpl(STICKER_CATALOG_ENDPOINT, { credentials: "omit" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`sticker catalog ${res.status}`);
      const data = (await res.json()) as Partial<StickerCatalogClient>;
      const catalog: StickerCatalogClient = {
        groups: Array.isArray(data.groups) ? data.groups : [],
        styles: Array.isArray(data.styles) ? data.styles : [],
        defaultStyleId: String(data.defaultStyleId || data.styles?.[0]?.id || ""),
        emotions: Array.isArray(data.emotions) ? data.emotions : [],
        motions: Array.isArray(data.motions) ? data.motions : [],
        fromDb: Boolean(data.fromDb),
      };
      if (!catalog.styles.length) throw new Error("sticker catalog empty");
      resolved = catalog;
      return catalog;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Tests only. */
export function resetStickerCatalogClientCache(): void {
  pending = null;
  resolved = null;
}

export function stickerStyleTileLabel(styles: readonly StickerStyle[], id: string): string | null {
  const style = styles.find((item) => item.id === id);
  if (!style) return null;
  return style.emoji ? `${style.emoji} ${style.label}` : style.label;
}
