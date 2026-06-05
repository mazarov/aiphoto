import type { SeoIllustration } from "./seo-content";
import {
  enrichCardsWithDetails,
  fetchRouteCards,
  getCardPhotosBySlugs,
  type CardPhotoRef,
} from "./supabase";

export type ResolvedSeoIllustration = {
  alt: string;
  caption: string;
  faqIndex?: number;
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

function toResolved(
  ref: CardPhotoRef,
  ill: SeoIllustration,
): ResolvedSeoIllustration {
  return {
    alt: ill.alt,
    caption: ill.caption,
    faqIndex: ill.faqIndex,
    cardSlug: ref.slug,
    photoUrl: ref.photoUrl,
    width: ref.width ?? DEFAULT_WIDTH,
    height: ref.height ?? DEFAULT_HEIGHT,
  };
}

async function findCardPhotoByTitleIncludes(
  rpcParams: RouteRpcParams,
  titleIncludes: string,
  excludeSlugs: Set<string>,
): Promise<CardPhotoRef | null> {
  const needle = titleIncludes.toLowerCase();
  const result = await fetchRouteCards({
    ...rpcParams,
    limit: 80,
    offset: 0,
    min_cards: 0,
  });

  const match = result.cards.find(
    (c) =>
      !excludeSlugs.has(c.slug) &&
      (c.title_ru?.toLowerCase().includes(needle) ?? false),
  );
  if (!match) return null;

  const [enriched] = await enrichCardsWithDetails([match]);
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

/** Разрешает SEO-иллюстрации: slug из БД → titleIncludes в кластере. */
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

export function illustrationsByFaqIndex(
  illustrations: ResolvedSeoIllustration[],
): Map<number, ResolvedSeoIllustration> {
  const map = new Map<number, ResolvedSeoIllustration>();
  for (const ill of illustrations) {
    if (ill.faqIndex != null) map.set(ill.faqIndex, ill);
  }
  return map;
}

export function introIllustrations(
  illustrations: ResolvedSeoIllustration[],
): ResolvedSeoIllustration[] {
  return illustrations.filter((i) => i.faqIndex == null);
}
