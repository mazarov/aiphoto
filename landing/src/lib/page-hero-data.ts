import { cache } from "react";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  type PromptCardFull,
  type RouteCard,
} from "@/lib/supabase";
import { toGenerationExampleCard, type GenerationExampleCard } from "@/lib/generation/example-card";
import {
  adminHeroCards,
  asPopularityScore,
  decidePageHeroPin,
  publicHeroCards,
  rankHeroCards,
  type HeroMembershipCard,
  type PageHeroWrite,
} from "@/lib/page-hero";

type HeroCardRow = HeroMembershipCard & {
  slug: string;
  titleRu: string | null;
  titleEn: string | null;
  seoTags: unknown;
  relevanceScore: number;
};

export type PageHeroAdminPin = {
  cardId: string;
  slug: string;
  title: string;
  photoUrl: string | null;
  hidden: boolean;
};

type PinWriteResult =
  | { ok: true; pins: PageHeroAdminPin[] }
  | { ok: false; status: number; error: string };

function membershipFromRow(row: {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  seo_tags: unknown;
  seo_readiness_score: number | null;
  is_published: boolean | null;
  popularity_score: unknown;
  created_at: string | null;
}, pinnedAt: string | null): HeroCardRow {
  return {
    id: row.id,
    slug: row.slug,
    titleRu: row.title_ru,
    titleEn: row.title_en,
    seoTags: row.seo_tags,
    relevanceScore: row.seo_readiness_score ?? 0,
    isPublished: Boolean(row.is_published),
    hasPhoto: false,
    popularityScore: asPopularityScore(row.popularity_score),
    createdAt: row.created_at,
    pinnedAt,
  };
}

async function loadPinnedRows(pagePath: string): Promise<HeroCardRow[] | null> {
  const supabase = createSupabaseServer();
  const { data: pins, error: pinError } = await supabase
    .from("page_hero_cards")
    .select("card_id,created_at")
    .eq("page_path", pagePath);
  if (pinError) {
    console.error("[page-hero] read failed", { pagePath, message: pinError.message });
    return null;
  }
  const pinnedAtById = new Map(
    (pins ?? []).map((row) => [row.card_id as string, (row.created_at as string | null) ?? null]),
  );
  const ids = [...pinnedAtById.keys()];
  if (ids.length === 0) return [];

  const { data: cards, error: cardError } = await supabase
    .from("prompt_cards")
    .select(
      "id,slug,title_ru,title_en,seo_tags,seo_readiness_score,is_published,popularity_score,created_at",
    )
    .in("id", ids);
  if (cardError) {
    console.error("[page-hero] read failed", { pagePath, message: cardError.message });
    return null;
  }
  return (cards ?? []).map((row) => {
    const card = row as Parameters<typeof membershipFromRow>[0];
    return membershipFromRow(card, pinnedAtById.get(card.id) ?? null);
  });
}

function toRouteCard(row: HeroCardRow): RouteCard {
  return {
    id: row.id,
    slug: row.slug,
    title_ru: row.titleRu,
    title_en: row.titleEn,
    seo_tags: row.seoTags,
    relevance_score: row.relevanceScore,
  };
}

async function enrichInOrder(rows: readonly HeroCardRow[]): Promise<PromptCardFull[]> {
  if (rows.length === 0) return [];
  const enriched = await enrichCardsWithDetails(rows.map(toRouteCard));
  const byId = new Map(enriched.map((card) => [card.id, card]));
  return rows
    .map((row) => byId.get(row.id))
    .filter((card): card is PromptCardFull => Boolean(card));
}

function adminPinsFromCards(
  rows: readonly HeroCardRow[],
  cards: readonly PromptCardFull[],
): PageHeroAdminPin[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return adminHeroCards(rows).map((row) => {
    const card = byId.get(row.id);
    const photoUrl = card?.photoUrls[0] ?? null;
    return {
      cardId: row.id,
      slug: row.slug,
      title: row.titleRu || row.titleEn || row.slug,
      photoUrl,
      hidden: !row.isPublished || !photoUrl,
    };
  });
}

export const getPageHeroCards = cache(async (pagePath: string): Promise<PromptCardFull[]> => {
  try {
    const rows = await loadPinnedRows(pagePath);
    if (!rows) return [];
    const published = rankHeroCards(rows).filter((row) => row.isPublished);
    const enriched = await enrichInOrder(published);
    const photoIds = new Set(
      enriched.filter((card) => card.photoUrls.length > 0).map((card) => card.id),
    );
    const visibleRows = publicHeroCards(
      published.map((row) => ({ ...row, hasPhoto: photoIds.has(row.id) })),
    );
    const byId = new Map(enriched.map((card) => [card.id, card]));
    const visible = visibleRows
      .map((row) => byId.get(row.id))
      .filter((card): card is PromptCardFull => Boolean(card));
    if (visible.length === 0) {
      console.error("[page-hero] empty public hero", {
        pagePath,
        pinned: rows.length,
      });
    }
    return visible;
  } catch (error) {
    console.error("[page-hero] read failed", {
      pagePath,
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
});

export async function loadPageHeroCarousel(pagePath: string): Promise<GenerationExampleCard[]> {
  const cards = await getPageHeroCards(pagePath);
  return cards.map(toGenerationExampleCard).filter((card) => card.photoUrl);
}

export async function listPageHeroAdminPins(pagePath: string): Promise<PageHeroAdminPin[] | null> {
  const rows = await loadPinnedRows(pagePath);
  if (!rows) return null;
  const cards = await enrichInOrder(adminHeroCards(rows));
  return adminPinsFromCards(rows, cards);
}

async function resolvePinTarget(
  write: PageHeroWrite,
): Promise<
  | { ok: true; id: string; slug: string; isPublished: boolean; hasPhoto: boolean }
  | { ok: false; status: number; error: string }
> {
  const supabase = createSupabaseServer();
  const lookup = write.cardId ?? write.query ?? "";
  const byId =
    Boolean(write.cardId) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookup);
  const { data, error } = await supabase
    .from("prompt_cards")
    .select("id,slug,is_published")
    .eq(byId ? "id" : "slug", lookup)
    .maybeSingle();
  if (error) {
    console.error("[page-hero] card lookup failed", { message: error.message });
    return { ok: false, status: 500, error: "Не удалось найти карточку" };
  }
  if (!data) return { ok: false, status: 404, error: "Карточка не найдена" };

  const { data: media, error: mediaError } = await supabase
    .from("prompt_card_media")
    .select("card_id")
    .eq("card_id", data.id)
    .eq("media_type", "photo")
    .limit(1);
  if (mediaError) {
    console.error("[page-hero] photo lookup failed", { message: mediaError.message });
    return { ok: false, status: 500, error: "Не удалось найти карточку" };
  }
  return {
    ok: true,
    id: data.id as string,
    slug: data.slug as string,
    isPublished: Boolean(data.is_published),
    hasPhoto: (media ?? []).length > 0,
  };
}

export async function writePageHeroPin(write: PageHeroWrite): Promise<PinWriteResult> {
  const target = await resolvePinTarget(write);
  if (!target.ok) return target;

  const supabase = createSupabaseServer();
  const { data: existing, error: existingError } = await supabase
    .from("page_hero_cards")
    .select("card_id")
    .eq("page_path", write.path);
  if (existingError) {
    console.error("[page-hero] read failed", {
      pagePath: write.path,
      message: existingError.message,
    });
    return { ok: false, status: 500, error: "Не удалось прочитать шапку" };
  }
  const pinnedIds = (existing ?? []).map((row) => row.card_id as string);
  const alreadyPinned = pinnedIds.includes(target.id);
  if (write.op === "pin" && !alreadyPinned && (!target.isPublished || !target.hasPhoto)) {
    return { ok: false, status: 400, error: "Нужна опубликованная карточка с фото" };
  }

  const decision = decidePageHeroPin({ op: write.op, alreadyPinned });
  if (decision.action === "insert") {
    const { error } = await supabase.from("page_hero_cards").insert({
      page_path: write.path,
      card_id: target.id,
    });
    if (error && error.code !== "23505") {
      console.error("[page-hero] insert failed", {
        pagePath: write.path,
        cardId: target.id,
        message: error.message,
      });
      return { ok: false, status: 500, error: "Не удалось поставить карточку в шапку" };
    }
  }
  if (decision.action === "delete") {
    const { error } = await supabase
      .from("page_hero_cards")
      .delete()
      .eq("page_path", write.path)
      .eq("card_id", target.id);
    if (error) {
      console.error("[page-hero] delete failed", {
        pagePath: write.path,
        cardId: target.id,
        message: error.message,
      });
      return { ok: false, status: 500, error: "Не удалось убрать карточку из шапки" };
    }
  }

  const pins = await listPageHeroAdminPins(write.path);
  if (!pins) return { ok: false, status: 500, error: "Не удалось прочитать шапку" };
  return { ok: true, pins };
}
