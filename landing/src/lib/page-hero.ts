import { generaciyaSeoImagePaths } from "@/lib/generaciya-foto-routes";
import { HERO_MARQUEE_MAX_CARDS } from "@/lib/hero-marquee";
import { listingCatalogHubPaths } from "@/lib/listing-catalog-hub";
import { NANO_BANANA_SEO_PATHS } from "@/lib/nano-banana-seo-copy";

/** One-time seed size only; manual pins have no cap. */
export const PAGE_HERO_SEED_CARDS = HERO_MARQUEE_MAX_CARDS;

const HERO_PATHS = new Set<string>([
  "/",
  ...listingCatalogHubPaths(),
  ...generaciyaSeoImagePaths(),
  ...NANO_BANANA_SEO_PATHS,
]);

export type HeroMembershipCard = {
  id: string;
  isPublished: boolean;
  hasPhoto: boolean;
  popularityScore: number | null;
  createdAt: string | null;
  /** page_hero_cards.created_at — latest pin leads the carousel. */
  pinnedAt: string | null;
};

export function normalizeHeroPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.includes("?") || trimmed.includes("#") || trimmed.includes("\\")) return null;
  const path = trimmed.length > 1 && trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  if (path.length > 200 || path.includes("//")) return null;
  if (path.split("/").some((part) => part === "." || part === "..")) return null;
  return path;
}

export function isHeroCuratablePath(raw: string): boolean {
  const path = normalizeHeroPath(raw);
  return path != null && HERO_PATHS.has(path);
}

type HeroRankKey = Pick<HeroMembershipCard, "id" | "popularityScore" | "createdAt" | "pinnedAt">;

/** Newest pin first; seeded rows share one timestamp, so popularity orders them. */
export function compareHeroRank(a: HeroRankKey, b: HeroRankKey): number {
  const pinA = a.pinnedAt ?? "";
  const pinB = b.pinnedAt ?? "";
  if (pinA !== pinB) return pinA < pinB ? 1 : -1;
  if (a.popularityScore == null && b.popularityScore != null) return 1;
  if (b.popularityScore == null && a.popularityScore != null) return -1;
  if (
    a.popularityScore != null &&
    b.popularityScore != null &&
    a.popularityScore !== b.popularityScore
  ) {
    return b.popularityScore - a.popularityScore;
  }
  const timeA = a.createdAt ?? "";
  const timeB = b.createdAt ?? "";
  if (timeA !== timeB) return timeA < timeB ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function rankHeroCards<T extends HeroMembershipCard>(cards: readonly T[]): T[] {
  return [...cards].sort(compareHeroRank);
}

/** Published cards with a photo, in pin order. */
export function publicHeroCards<T extends HeroMembershipCard>(cards: readonly T[]): T[] {
  return rankHeroCards(cards).filter((card) => card.isPublished && card.hasPhoto);
}

/** Every pinned row, including hidden ones, in the same order. */
export function adminHeroCards<T extends HeroMembershipCard>(cards: readonly T[]): T[] {
  return rankHeroCards(cards);
}

export function seedShouldSkip(existingCount: number): boolean {
  return existingCount > 0;
}

export function takeSeedCardIds(
  cards: readonly { id: string; photoUrl: string | null }[],
  max = PAGE_HERO_SEED_CARDS,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    if (!card.photoUrl || seen.has(card.id)) continue;
    seen.add(card.id);
    ids.push(card.id);
    if (ids.length >= max) break;
  }
  return ids;
}

export function decidePageHeroPin(input: {
  op: "pin" | "unpin";
  alreadyPinned: boolean;
}): { action: "insert" | "delete" | "noop" } {
  if (input.op === "unpin") {
    return { action: input.alreadyPinned ? "delete" : "noop" };
  }
  return { action: input.alreadyPinned ? "noop" : "insert" };
}

const CARD_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PageHeroWrite =
  | { path: string; op: "pin"; cardId: string | null; query: string | null }
  | { path: string; op: "unpin"; cardId: string | null; query: string | null };

export function parsePageHeroWrite(
  body: unknown,
): { ok: true; value: PageHeroWrite } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Некорректный запрос" };
  }
  const record = body as Record<string, unknown>;
  const path = typeof record.path === "string" ? normalizeHeroPath(record.path) : null;
  if (!path || !isHeroCuratablePath(path)) {
    return { ok: false, error: "Неизвестная страница" };
  }
  if (record.op !== "pin" && record.op !== "unpin") {
    return { ok: false, error: "Некорректная операция" };
  }
  const cardId = typeof record.cardId === "string" ? record.cardId.trim() : "";
  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (cardId && !CARD_UUID.test(cardId)) {
    return { ok: false, error: "Некорректный id карточки" };
  }
  if (!cardId && !query) {
    return { ok: false, error: "Нужен id или slug карточки" };
  }
  if (query.length > 200) {
    return { ok: false, error: "Слишком длинный запрос" };
  }
  return {
    ok: true,
    value: {
      path,
      op: record.op,
      cardId: cardId || null,
      query: query || null,
    },
  };
}

export function asPopularityScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? score : null;
}
