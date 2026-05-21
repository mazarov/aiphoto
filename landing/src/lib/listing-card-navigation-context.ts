/**
 * Сохраняет порядок slug карточек с листинга (localStorage), чтобы на `/p/[slug]`
 * переключать соседей через router.push в той же вкладке.
 * sessionStorage не подходит: листинг открывает карточку в новой вкладке (target="_blank").
 */

import type { PromptCardFull } from "@/lib/supabase";

export const LISTING_CARD_NAV_STORAGE_KEY = "promptshot_listing_nav_v1";

/** Верхний предел записи — защита localStorage от раздувания. */
export const LISTING_CARD_NAV_MAX_SLUGS = 500;

export type ListingNavGridItem =
  | { type: "single"; card: PromptCardFull }
  | { type: "group"; key: string; cards: PromptCardFull[] };

type StoredPayload = {
  slugs: string[];
  updatedAt: number;
};

function normalizeSlug(slug: string | null | undefined): string | null {
  const t = slug?.trim();
  return t || null;
}

/**
 * DOM-порядок как у FilterableGrid: ячейка single → один slug;
 * группа → все варианты по возрастанию cardSplitIndex.
 */
export function buildListingSlugOrder(items: ListingNavGridItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.type === "single") {
      const s = normalizeSlug(item.card.slug);
      if (s) out.push(s);
    } else {
      const sorted = [...item.cards].sort(
        (a, b) => a.cardSplitIndex - b.cardSplitIndex
      );
      for (const c of sorted) {
        const s = normalizeSlug(c.slug);
        if (s) out.push(s);
      }
    }
  }
  return out;
}

/**
 * При превышении лимита оставляем **хвост** списка: актуально при infinite scroll,
 * когда пользователь уже прокрутил далеко от первой страницы.
 */
export function capListingSlugList(slugs: string[]): string[] {
  if (slugs.length <= LISTING_CARD_NAV_MAX_SLUGS) return slugs;
  return slugs.slice(-LISTING_CARD_NAV_MAX_SLUGS);
}

export function writeListingNavigationContext(slugs: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const capped = capListingSlugList(slugs);
    const payload: StoredPayload = {
      slugs: capped,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(
      LISTING_CARD_NAV_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    /* квота / приватный режим */
  }
}

export function readListingNavigationContext(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LISTING_CARD_NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload | null;
    if (!parsed || !Array.isArray(parsed.slugs)) return null;
    const slugs = parsed.slugs.filter((s): s is string => typeof s === "string");
    return slugs.length === 0 ? null : slugs;
  } catch {
    return null;
  }
}

export type ListingCardNavNeighbors = {
  prevSlug: string | null;
  nextSlug: string | null;
};

/** `null`, если текущего slug нет в сохранённом списке (или список пуст). */
export function resolveListingNavNeighbors(
  currentSlug: string
): ListingCardNavNeighbors | null {
  const trimmed = normalizeSlug(currentSlug);
  if (!trimmed) return null;
  const slugs = readListingNavigationContext();
  if (!slugs?.length) return null;
  const i = slugs.indexOf(trimmed);
  if (i < 0) return null;
  return {
    prevSlug: i > 0 ? slugs[i - 1]! : null,
    nextSlug: i < slugs.length - 1 ? slugs[i + 1]! : null,
  };
}
