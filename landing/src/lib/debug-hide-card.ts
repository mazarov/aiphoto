export type DebugHideCardRequest = {
  cardId: string;
  confirmSlug: string;
  /** false = снять с витрины. true = вернуть флаг is_published, без publish-reward. */
  published: boolean;
};

export function parseDebugHideCardRequest(
  body: unknown,
): { ok: true; value: DebugHideCardRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Missing cardId or confirmSlug" };
  }
  const raw = body as {
    cardId?: unknown;
    confirmSlug?: unknown;
    published?: unknown;
  };
  const cardId = typeof raw.cardId === "string" ? raw.cardId.trim() : "";
  const confirmSlug = typeof raw.confirmSlug === "string" ? raw.confirmSlug.trim() : "";
  if (!cardId || !confirmSlug) {
    return { ok: false, error: "Missing cardId or confirmSlug" };
  }
  if (raw.published !== undefined && typeof raw.published !== "boolean") {
    return { ok: false, error: "published must be boolean" };
  }
  return {
    ok: true,
    value: {
      cardId,
      confirmSlug,
      published: raw.published === true,
    },
  };
}

/** Public vitrina is published=yes (SSR feed uses null). Admin all/no keeps the row. */
export function shouldDropHiddenCardFromListing(
  publishedFilter: "all" | "yes" | "no" | null,
): boolean {
  return publishedFilter == null || publishedFilter === "yes";
}

export function omitHiddenCardIds<T extends { id: string }>(
  items: T[],
  hiddenIds: ReadonlySet<string>,
): T[] {
  if (hiddenIds.size === 0) return items;
  const next = items.filter((item) => !hiddenIds.has(item.id));
  return next.length === items.length ? items : next;
}

export function omitCardById<T extends { id: string }>(items: T[], cardId: string): T[] {
  if (!items.some((item) => item.id === cardId)) return items;
  return items.filter((item) => item.id !== cardId);
}

export function omitCardFromPages<T extends { id: string }>(
  pages: T[][],
  cardId: string,
): T[][] {
  let changed = false;
  const next = pages.map((page) => {
    const filtered = page.filter((card) => card.id !== cardId);
    if (filtered.length !== page.length) changed = true;
    return filtered;
  });
  if (!changed) return pages;
  return next.filter((page) => page.length > 0);
}
