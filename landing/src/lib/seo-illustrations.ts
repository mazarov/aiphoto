import type { SeoIllustration } from "./seo-content";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  fetchRouteCards,
  getCardPhotosBySlugs,
  type CardPhotoRef,
  type RouteCard,
} from "./supabase";

export type ResolvedSeoIllustration = {
  alt: string;
  caption: string;
  label: string;
  cardSlug: string;
  photoUrl: string;
  width: number;
  height: number;
};

type RouteRpcParams = {
  audience_tag?: string | null;
  style_tag?: string | null;
  occasion_tag?: string | null;
  object_tag?: string | null;
  doc_task_tag?: string | null;
};

const DEFAULT_WIDTH = 3;
const DEFAULT_HEIGHT = 4;
const ROUTE_SCAN_LIMIT = 120;
const VARIANTS_ID_CHUNK = 40;

function toResolved(
  ref: CardPhotoRef,
  ill: SeoIllustration,
): ResolvedSeoIllustration {
  return {
    alt: ill.alt,
    caption: ill.caption,
    label: ill.label,
    cardSlug: ref.slug,
    photoUrl: ref.photoUrl,
    width: ref.width ?? DEFAULT_WIDTH,
    height: ref.height ?? DEFAULT_HEIGHT,
  };
}

async function cardRefFromRouteCard(
  card: RouteCard,
): Promise<CardPhotoRef | null> {
  const [enriched] = await enrichCardsWithDetails([card]);
  const photoUrl = enriched?.photoUrls[0];
  if (!photoUrl) return null;

  const meta = enriched.photoMeta[0];
  return {
    slug: enriched.slug,
    photoUrl,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
  };
}

async function findPromptMatchInCards(
  cards: RouteCard[],
  needle: string,
  excludeSlugs: Set<string>,
): Promise<RouteCard | null> {
  const supabase = createSupabaseServer();
  const lower = needle.toLowerCase();

  for (let i = 0; i < cards.length; i += VARIANTS_ID_CHUNK) {
    const chunk = cards.slice(i, i + VARIANTS_ID_CHUNK);
    const ids = chunk.map((c) => c.id);
    const { data: variants } = await supabase
      .from("prompt_variants")
      .select("card_id,prompt_text_ru,prompt_text_en")
      .in("card_id", ids);

    const promptHitIds = new Set<string>();
    for (const row of variants ?? []) {
      const text = `${row.prompt_text_ru ?? ""} ${row.prompt_text_en ?? ""}`.toLowerCase();
      if (text.includes(lower)) {
        promptHitIds.add(row.card_id as string);
      }
    }

    const match = chunk.find(
      (c) => !excludeSlugs.has(c.slug) && promptHitIds.has(c.id),
    );
    if (match) return match;
  }

  return null;
}

async function findCardPhotoByTitleIncludes(
  rpcParams: RouteRpcParams,
  titleIncludes: string,
  excludeSlugs: Set<string>,
): Promise<CardPhotoRef | null> {
  const needle = titleIncludes.toLowerCase();
  const result = await fetchRouteCards({
    ...rpcParams,
    limit: ROUTE_SCAN_LIMIT,
    offset: 0,
    min_cards: 0,
  });

  const titleMatch = result.cards.find(
    (c) =>
      !excludeSlugs.has(c.slug) &&
      (c.title_ru?.toLowerCase().includes(needle) ?? false),
  );
  if (titleMatch) {
    return cardRefFromRouteCard(titleMatch);
  }

  const promptMatch = await findPromptMatchInCards(
    result.cards,
    needle,
    excludeSlugs,
  );
  if (promptMatch) {
    return cardRefFromRouteCard(promptMatch);
  }

  return null;
}

/** Разрешает SEO-иллюстрации: slug из БД → titleIncludes в кластере (title или prompt). */
export async function resolveSeoIllustrations(
  illustrations: SeoIllustration[] | undefined,
  rpcParams: RouteRpcParams,
): Promise<ResolvedSeoIllustration[]> {
  if (!illustrations?.length) return [];

  const slugs = illustrations
    .map((i) => i.cardSlug)
    .filter((s): s is string => !!s);
  const slugPhotos = await getCardPhotosBySlugs(slugs);
  const usedSlugs = new Set<string>();
  const resolved: ResolvedSeoIllustration[] = [];

  for (const ill of illustrations) {
    let ref: CardPhotoRef | null = null;

    if (ill.cardSlug) {
      ref = slugPhotos.get(ill.cardSlug) ?? null;
    }

    if (!ref && ill.titleIncludes) {
      ref = await findCardPhotoByTitleIncludes(
        rpcParams,
        ill.titleIncludes,
        usedSlugs,
      );
    }

    if (!ref || usedSlugs.has(ref.slug)) continue;
    usedSlugs.add(ref.slug);
    resolved.push(toResolved(ref, ill));
  }

  return resolved;
}
