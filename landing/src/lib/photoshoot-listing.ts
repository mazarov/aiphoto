import { isPhotoshootUgcListing } from "@/lib/photoshoot";
import { WEB_UGC_DATASET_SLUG } from "@/lib/web-ugc-card";
import {
  createSupabaseServer,
  enrichCardsWithDetails,
  getStorageCardMediaUrl,
  type PromptCardFull,
  type RouteCard,
} from "@/lib/supabase";

export const PHOTOSHOOT_LISTING_LIMIT = 50;

export type PhotoshootListingCardInput = {
  datasetSlug?: string | null;
  photoUrls?: readonly string[] | null;
  photoMeta?: readonly { path?: string | null }[] | null;
};

export function isPhotoshootListingCard(
  card: PhotoshootListingCardInput
): boolean {
  const paths = (card.photoMeta || [])
    .map((item) => String(item.path || "").trim())
    .filter(Boolean);
  const photoCount = card.photoUrls?.length || paths.length;
  return isPhotoshootUgcListing({
    datasetSlug: card.datasetSlug,
    photoCount,
    storagePaths: paths,
  });
}

export function filterPhotoshootListingCards<T extends PhotoshootListingCardInput>(
  cards: readonly T[]
): T[] {
  return cards.filter((card) => isPhotoshootListingCard(card));
}

function toRouteCard(row: {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  seo_tags: unknown;
}): RouteCard {
  return {
    id: row.id,
    slug: row.slug,
    title_ru: row.title_ru,
    title_en: row.title_en,
    seo_tags: row.seo_tags,
    relevance_score: 0,
  };
}

function uniqueRouteCards(cards: RouteCard[]): RouteCard[] {
  const seen = new Set<string>();
  const unique: RouteCard[] = [];
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    unique.push(card);
  }
  return unique;
}

async function fetchCardsByIds(ids: string[]): Promise<RouteCard[]> {
  if (!ids.length) return [];
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("prompt_cards")
    .select("id,slug,title_ru,title_en,seo_tags")
    .in("id", ids)
    .eq("is_published", true);
  if (error) {
    throw new Error(`photoshoot_listing_cards:${error.message}`);
  }
  const byId = new Map(
    (data || []).map((row) => [row.id as string, toRouteCard(row as RouteCard)])
  );
  return ids
    .map((id) => byId.get(id))
    .filter((card): card is RouteCard => Boolean(card));
}

async function fetchRouteCardsFromPhotoshootJobs(
  limit: number
): Promise<RouteCard[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("landing_generations")
    .select("ugc_card_id")
    .eq("edit_kind", "photoshoot")
    .eq("status", "completed")
    .not("ugc_card_id", "is", null)
    .order("generation_completed_at", { ascending: false })
    .limit(Math.max(limit * 3, limit));
  if (error) {
    throw new Error(`photoshoot_listing_jobs:${error.message}`);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of data || []) {
    const id = String(row.ugc_card_id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return fetchCardsByIds(ids.slice(0, limit));
}

async function fetchRouteCardsFromPublishedUgc(
  limit: number
): Promise<RouteCard[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("prompt_cards")
    .select("id,slug,title_ru,title_en,seo_tags")
    .eq("is_published", true)
    .eq("source_dataset_slug", WEB_UGC_DATASET_SLUG)
    .order("source_date", { ascending: false })
    .limit(Math.max(limit * 4, 80));
  if (error) {
    throw new Error(`photoshoot_listing_ugc:${error.message}`);
  }
  return (data || []).map((row) => toRouteCard(row as RouteCard));
}

export async function fetchPublishedPhotoshootListingCards(
  limit = PHOTOSHOOT_LISTING_LIMIT
): Promise<PromptCardFull[]> {
  let jobCards: RouteCard[] = [];
  try {
    jobCards = await fetchRouteCardsFromPhotoshootJobs(limit);
  } catch (error) {
    console.error("[photoshoot-listing] jobs query failed", error);
  }

  let candidateCards = jobCards;
  if (candidateCards.length === 0) {
    try {
      candidateCards = await fetchRouteCardsFromPublishedUgc(limit);
    } catch (error) {
      console.error("[photoshoot-listing] ugc fallback failed", error);
    }
  }

  if (!candidateCards.length) return [];

  const jobIds = new Set(jobCards.map((card) => card.id));
  let enriched: PromptCardFull[] = [];
  try {
    enriched = await enrichCardsWithDetails(candidateCards);
  } catch (error) {
    console.error("[photoshoot-listing] enrich failed", error);
  }
  if (!enriched.some((card) => card.photoUrls.length > 0)) {
    enriched = await hydratePhotoshootMedia(candidateCards, enriched);
  }

  const byId = new Map(enriched.map((card) => [card.id, card]));
  return candidateCards
    .map((card) => byId.get(card.id))
    .filter((card): card is PromptCardFull => {
      if (!card || !card.photoUrls.length) return false;
      return jobIds.has(card.id) || isPhotoshootListingCard(card);
    })
    .slice(0, limit);
}

async function hydratePhotoshootMedia(
  candidates: RouteCard[],
  current: PromptCardFull[]
): Promise<PromptCardFull[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("prompt_card_media")
    .select("card_id,storage_bucket,storage_path,is_primary,width,height")
    .in(
      "card_id",
      candidates.map((card) => card.id)
    )
    .eq("media_type", "photo")
    .order("is_primary", { ascending: false });
  if (error) {
    console.error("[photoshoot-listing] media hydrate failed", error.message);
    return current;
  }

  const mediaByCard = new Map<
    string,
    {
      url: string;
      bucket: string;
      path: string;
      width: number | null;
      height: number | null;
    }[]
  >();
  for (const row of data || []) {
    const cardId = String(row.card_id || "");
    if (!cardId) continue;
    const list = mediaByCard.get(cardId) || [];
    list.push({
      url: getStorageCardMediaUrl(
        String(row.storage_bucket),
        String(row.storage_path),
        "listing"
      ),
      bucket: String(row.storage_bucket),
      path: String(row.storage_path),
      width: (row.width as number | null) ?? null,
      height: (row.height as number | null) ?? null,
    });
    mediaByCard.set(cardId, list);
  }

  const currentById = new Map(current.map((card) => [card.id, card]));
  return candidates.map((card) => {
    const existing = currentById.get(card.id);
    const photoMeta = mediaByCard.get(card.id) || existing?.photoMeta || [];
    const photoUrls = photoMeta.map((item) => item.url);
    return {
      id: card.id,
      slug: card.slug,
      title_ru: card.title_ru,
      title_en: card.title_en,
      seo_tags: card.seo_tags,
      relevance_score: card.relevance_score,
      promptTexts: existing?.promptTexts || [],
      hasRuPrompt: existing?.hasRuPrompt || false,
      photoUrls,
      photoMeta,
      beforePhotoUrl: existing?.beforePhotoUrl || null,
      datasetSlug: existing?.datasetSlug || WEB_UGC_DATASET_SLUG,
      sourceMessageId: existing?.sourceMessageId || null,
      sourceDate: existing?.sourceDate || null,
      hashtags: existing?.hashtags || [],
      warnings: existing?.warnings || [],
      seoReadinessScore: existing?.seoReadinessScore || 0,
      photoCount: photoUrls.length,
      promptCount: existing?.promptCount || 0,
      cardSplitIndex: existing?.cardSplitIndex || 0,
      cardSplitTotal: existing?.cardSplitTotal || 1,
      sourceGroupKey: existing?.sourceGroupKey || null,
      likesCount: existing?.likesCount || 0,
      dislikesCount: existing?.dislikesCount || 0,
      viewCount: existing?.viewCount || 0,
    };
  });
}
