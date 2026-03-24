import { createClient } from "@supabase/supabase-js";
import {
  buildStorageRenderImagePublicUrl,
  type CardImagePreset,
} from "@/lib/card-image-presets";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_SUPABASE_PUBLIC_URL ||
  process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createSupabaseServer() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE env vars for server");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export function getStoragePublicUrl(bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/** Промо-фото карточек: опционально `render/image` (см. NEXT_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM). */
export function getStorageCardMediaUrl(
  bucket: string,
  path: string,
  preset: CardImagePreset
): string {
  if (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_IMAGE_TRANSFORM === "1") {
    return buildStorageRenderImagePublicUrl(supabaseUrl, bucket, path, preset);
  }
  return getStoragePublicUrl(bucket, path);
}

export type RouteCard = {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  seo_tags: unknown;
  relevance_score: number;
};

export type RouteCardsResult = {
  cards: RouteCard[];
  tier_used: string;
  cards_count: number;
  total_count: number;
  has_minimum: boolean;
  dimension_count: number;
};

export async function fetchRouteCards(params: {
  audience_tag?: string | null;
  style_tag?: string | null;
  occasion_tag?: string | null;
  object_tag?: string | null;
  doc_task_tag?: string | null;
  site_lang?: string;
  limit?: number;
  offset?: number;
  min_cards?: number;
}): Promise<RouteCardsResult> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("resolve_route_cards", {
    p_audience_tag: params.audience_tag ?? null,
    p_style_tag: params.style_tag ?? null,
    p_occasion_tag: params.occasion_tag ?? null,
    p_object_tag: params.object_tag ?? null,
    p_doc_task_tag: params.doc_task_tag ?? null,
    p_site_lang: params.site_lang ?? "ru",
    p_limit: params.limit ?? 24,
    p_offset: params.offset ?? 0,
    p_min_cards: params.min_cards ?? 2,
  });

  if (error) throw new Error(`resolve_route_cards: ${error.message}`);
  const result = data as RouteCardsResult;
  result.cards = await expandCardGroups(result.cards);
  return result;
}

export type IndexableTagCombo = {
  dim1: string;
  slug1: string;
  dim2: string;
  slug2: string;
  cards_count: number;
};

export async function getIndexableTagCombos(
  minCards = 6,
  siteLang = "ru",
): Promise<IndexableTagCombo[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("get_indexable_tag_combos", {
    p_min_cards: minCards,
    p_site_lang: siteLang,
  });
  if (error) {
    console.error("get_indexable_tag_combos error:", error.message);
    return [];
  }
  return (data ?? []) as IndexableTagCombo[];
}

export type FilterCountRow = {
  dimension: string;
  slug: string;
  cards_count: number;
};

export async function getFilterCounts(params: {
  audience_tag?: string | null;
  style_tag?: string | null;
  occasion_tag?: string | null;
  object_tag?: string | null;
  doc_task_tag?: string | null;
  site_lang?: string;
}): Promise<FilterCountRow[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("get_filter_counts", {
    p_audience_tag: params.audience_tag ?? null,
    p_style_tag: params.style_tag ?? null,
    p_occasion_tag: params.occasion_tag ?? null,
    p_object_tag: params.object_tag ?? null,
    p_doc_task_tag: params.doc_task_tag ?? null,
    p_site_lang: params.site_lang ?? "ru",
  });
  if (error) {
    console.error("get_filter_counts error:", error.message);
    return [];
  }
  return (data ?? []) as FilterCountRow[];
}

/** Fetches sibling cards for any card in a group; never splits groups.
 *  All group expansions are batched into parallel queries (no N+1). */
async function expandCardGroups(cards: RouteCard[]): Promise<RouteCard[]> {
  if (cards.length === 0) return [];
  const supabase = createSupabaseServer();
  const ids = new Set(cards.map((c) => c.id));
  const { data: meta } = await supabase
    .from("prompt_cards")
    .select("id,source_dataset_slug,source_message_id,card_split_total")
    .in("id", [...ids]);

  const groupKeys: { dataset: string; msgId: number }[] = [];
  for (const r of meta || []) {
    const row = r as { id: string; source_dataset_slug: string | null; source_message_id: number | null; card_split_total: number | null };
    if (row.card_split_total && row.card_split_total > 1 && row.source_dataset_slug && row.source_message_id != null) {
      const key = `${row.source_dataset_slug}::${row.source_message_id}`;
      if (!groupKeys.some((g) => `${g.dataset}::${g.msgId}` === key)) {
        groupKeys.push({ dataset: row.source_dataset_slug, msgId: row.source_message_id });
      }
    }
  }
  if (groupKeys.length === 0) return cards;

  const siblingResults = await Promise.all(
    groupKeys.map(({ dataset, msgId }) =>
      supabase
        .from("prompt_cards")
        .select("id,slug,title_ru,title_en,seo_tags,seo_readiness_score")
        .eq("source_dataset_slug", dataset)
        .eq("source_message_id", msgId)
    )
  );

  const allIds = new Set(ids);
  for (const { data: siblings } of siblingResults) {
    for (const s of siblings || []) {
      const row = s as { id: string; slug: string; title_ru: string; title_en: string | null; seo_tags: unknown; seo_readiness_score: number | null };
      if (!allIds.has(row.id)) {
        allIds.add(row.id);
        cards.push({
          id: row.id,
          slug: row.slug,
          title_ru: row.title_ru,
          title_en: row.title_en,
          seo_tags: row.seo_tags,
          relevance_score: row.seo_readiness_score ?? 0,
        });
      }
    }
  }
  return cards;
}

export async function searchCardsFiltered(params: {
  hasWarnings?: "all" | "yes" | "no";
  scoreMin?: number;
  scoreMax?: number;
  hasRuPrompt?: "all" | "yes" | "no";
  seoTag?: string | null;
  hasBefore?: "all" | "yes";
  dataset?: string | null;
  limit?: number;
  offset?: number;
}): Promise<RouteCard[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("search_cards_filtered", {
    p_has_warnings: params.hasWarnings ?? "all",
    p_score_min: params.scoreMin ?? 0,
    p_score_max: params.scoreMax ?? 100,
    p_has_ru_prompt: params.hasRuPrompt ?? "all",
    p_seo_tag: params.seoTag || null,
    p_has_before: params.hasBefore ?? "all",
    p_dataset: params.dataset || null,
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0,
  });

  if (error) throw new Error(`search_cards_filtered: ${error.message}`);
  const cards = (data || []) as RouteCard[];
  return expandCardGroups(cards);
}

export type SearchTextResult = RouteCard & { match_type: string };

export async function searchCardsByText(
  query: string,
  limit = 24,
  offset = 0
): Promise<SearchTextResult[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("search_cards_text", {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(`search_cards_text: ${error.message}`);
  // Keep search pagination deterministic (24/48/72...).
  // Group expansion is used for tag listings, but for search it breaks limit/offset semantics.
  return (data || []) as SearchTextResult[];
}

export async function fetchDatasets(): Promise<string[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("prompt_cards")
    .select("source_dataset_slug")
    .eq("is_published", true)
    .not("source_dataset_slug", "is", null);

  if (error) return [];
  const slugs = new Set<string>();
  for (const row of data || []) {
    const s = (row as { source_dataset_slug: string | null }).source_dataset_slug;
    if (s) slugs.add(s);
  }
  return [...slugs].sort();
}

// ── Homepage sections (single RPC for all category blocks) ──

export type HomepageCardRaw = {
  card_id: string;
  storage_bucket: string;
  storage_path: string;
};

export type HomepageSectionItemRaw = {
  dimension: string;
  slug: string;
  total_count: number;
  cards: HomepageCardRaw[];
};

export type HomepageSectionItemWithUrls = {
  dimension: string;
  slug: string;
  total_count: number;
  cards: { card_id: string; photoUrl: string }[];
};

export async function fetchHomepageSections(
  siteLang = "ru"
): Promise<HomepageSectionItemWithUrls[]> {
  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("get_homepage_sections", {
    p_site_lang: siteLang,
  });

  if (error) throw new Error(`get_homepage_sections: ${error.message}`);

  const rawItems = Array.isArray(data) ? data : [];
  return rawItems.map((item: Record<string, unknown>) => {
    const dim = String(item.dimension ?? "");
    const slug = String(item.slug ?? "");
    const totalCount = Number(item.total_count ?? 0);
    const rawCards = item.cards;
    const cardsArray = Array.isArray(rawCards) ? rawCards : [];

    let cards: { card_id: string; photoUrl: string }[];

    if (cardsArray.length > 0) {
      cards = cardsArray
        .filter(
          (c): c is Record<string, string> =>
            c != null &&
            typeof c === "object" &&
            typeof (c as Record<string, unknown>).card_id === "string" &&
            typeof (c as Record<string, unknown>).storage_bucket === "string" &&
            typeof (c as Record<string, unknown>).storage_path === "string"
        )
        .map((c) => ({
          card_id: c.card_id,
          photoUrl: getStorageCardMediaUrl(
            c.storage_bucket,
            c.storage_path,
            "grid"
          ),
        }));
    } else {
      // Backwards compat: old RPC (118) returns photo_bucket, photo_path
      const bucket = item.photo_bucket ?? item.second_photo_bucket;
      const path = item.photo_path ?? item.second_photo_path;
      cards =
        typeof bucket === "string" && typeof path === "string"
          ? [
              {
                card_id: `legacy-${dim}-${slug}`,
                photoUrl: getStorageCardMediaUrl(bucket, path, "grid"),
              },
            ]
          : [];
    }

    return {
      dimension: dim,
      slug,
      total_count: totalCount,
      cards,
    };
  });
}

/**
 * Pick primary and secondary photos for a tag, avoiding cards already used.
 * Returns { photoUrl, secondPhotoUrl } for the category block.
 */
export function pickDeduplicatedPhotos(
  cards: { card_id: string; photoUrl: string }[],
  usedCardIds: Set<string>
): { photoUrl: string | null; secondPhotoUrl: string | null; usedIds: string[] } {
  const unused = cards.filter((c) => !usedCardIds.has(c.card_id));
  const primary = unused[0] ?? cards[0];
  const secondary = unused[1] ?? unused[0] ?? null;
  const usedIds: string[] = [];
  if (primary) {
    usedIds.push(primary.card_id);
    if (secondary && secondary.card_id !== primary.card_id) {
      usedIds.push(secondary.card_id);
    }
  }
  return {
    photoUrl: primary?.photoUrl ?? null,
    secondPhotoUrl: secondary?.photoUrl ?? null,
    usedIds,
  };
}

export async function getFirstCardPhotoUrl(
  cardIds: string[],
): Promise<string | null> {
  if (cardIds.length === 0) return null;
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("prompt_card_media")
    .select("storage_bucket,storage_path")
    .in("card_id", cardIds.slice(0, 5))
    .eq("media_type", "photo")
    .order("is_primary", { ascending: false })
    .limit(1);
  const row = (data || [])[0] as
    | { storage_bucket: string; storage_path: string }
    | undefined;
  return row
    ? getStorageCardMediaUrl(row.storage_bucket, row.storage_path, "grid")
    : null;
}

/** Build menu counts from homepage sections data (avoids ~80 separate RPC calls). */
export function buildMenuCountsFromSections(
  sections: { dimension: string; slug: string; total_count: number }[],
  routeMap: { href: string; params: { audience_tag?: string; style_tag?: string; occasion_tag?: string; object_tag?: string } }[]
): Record<string, number> {
  const countsByDimSlug = new Map<string, number>();
  for (const s of sections) {
    countsByDimSlug.set(`${s.dimension}:${s.slug}`, s.total_count);
  }

  const result: Record<string, number> = {};
  for (const { href, params } of routeMap) {
    for (const [dim, slug] of Object.entries(params)) {
      if (slug) {
        result[href] = countsByDimSlug.get(`${dim}:${slug}`) ?? 0;
        break;
      }
    }
  }
  return result;
}

export type PhotoMeta = {
  url: string;
  bucket: string;
  path: string;
  width: number | null;
  height: number | null;
};

export type PromptCardFull = RouteCard & {
  promptTexts: string[];
  hasRuPrompt: boolean;
  photoUrls: string[];
  photoMeta: PhotoMeta[];
  beforePhotoUrl: string | null;
  datasetSlug: string | null;
  sourceMessageId: string | null;
  sourceDate: string | null;
  hashtags: string[];
  warnings: string[];
  seoReadinessScore: number;
  photoCount: number;
  promptCount: number;
  cardSplitIndex: number;
  cardSplitTotal: number;
  sourceGroupKey: string | null;
  likesCount: number;
  dislikesCount: number;
  viewCount: number;
  /** UGC draft vs published (e.g. «Мои генерации»). */
  isPublished?: boolean;
};

type MediaRow = {
  card_id: string;
  storage_bucket: string;
  storage_path: string;
  is_primary: boolean;
  width: number | null;
  height: number | null;
};

export async function enrichCardsWithDetails(
  cards: RouteCard[]
): Promise<PromptCardFull[]> {
  if (cards.length === 0) return [];

  const supabase = createSupabaseServer();
  const ids = cards.map((c) => c.id);

  const [cardsMetaRes, variantsRes, mediaRes, beforeMediaRes] =
    await Promise.all([
      supabase
        .from("prompt_cards")
        .select(
          "id,source_dataset_slug,source_message_id,source_date,hashtags,parse_warnings,seo_readiness_score,card_split_index,card_split_total,likes_count,dislikes_count,view_count"
        )
        .in("id", ids),
      supabase
        .from("prompt_variants")
        .select("card_id,prompt_text_ru,prompt_text_en")
        .in("card_id", ids)
        .order("variant_index", { ascending: true }),
      supabase
        .from("prompt_card_media")
        .select("card_id,storage_bucket,storage_path,is_primary,width,height")
        .in("card_id", ids)
        .eq("media_type", "photo")
        .order("is_primary", { ascending: false }),
      supabase
        .from("prompt_card_before_media")
        .select("card_id,storage_bucket,storage_path")
        .in("card_id", ids),
    ]);

  if (cardsMetaRes.error) console.error("[enrich] cardsMetaRes error:", cardsMetaRes.error.message);
  if (variantsRes.error) console.error("[enrich] variantsRes error:", variantsRes.error.message);
  if (mediaRes.error) console.error("[enrich] mediaRes error:", mediaRes.error.message);
  if (beforeMediaRes.error) console.error("[enrich] beforeMediaRes error:", beforeMediaRes.error.message);

  type CardMeta = {
    datasetSlug: string | null;
    sourceMessageId: string | null;
    sourceDate: string | null;
    hashtags: string[];
    warnings: string[];
    seoReadinessScore: number;
    cardSplitIndex: number;
    cardSplitTotal: number;
    likesCount: number;
    dislikesCount: number;
    viewCount: number;
  };
  const metaByCard = new Map<string, CardMeta>();
  for (const row of cardsMetaRes.data || []) {
    const r = row as {
      id: string;
      source_dataset_slug: string | null;
      source_message_id: string | null;
      source_date: string | null;
      hashtags: string[] | null;
      parse_warnings: string[] | null;
      seo_readiness_score: number | null;
      card_split_index: number | null;
      card_split_total: number | null;
      likes_count: number | null;
      dislikes_count: number | null;
      view_count: number | null;
    };
    metaByCard.set(r.id, {
      datasetSlug: r.source_dataset_slug,
      sourceMessageId: r.source_message_id ? String(r.source_message_id) : null,
      sourceDate: r.source_date,
      hashtags: r.hashtags || [],
      warnings: r.parse_warnings || [],
      seoReadinessScore: r.seo_readiness_score ?? 0,
      cardSplitIndex: r.card_split_index ?? 0,
      cardSplitTotal: r.card_split_total ?? 1,
      likesCount: r.likes_count ?? 0,
      dislikesCount: r.dislikes_count ?? 0,
      viewCount: r.view_count ?? 0,
    });
  }

  const variantsByCard = new Map<string, string[]>();
  const cardsWithRuPrompt = new Set<string>();
  for (const v of variantsRes.data || []) {
    const row = v as { card_id: string; prompt_text_ru: string | null; prompt_text_en: string | null };
    if (row.prompt_text_ru?.trim()) cardsWithRuPrompt.add(row.card_id);
    const t = row.prompt_text_ru?.trim() || row.prompt_text_en?.trim() || null;
    if (t) {
      const arr = variantsByCard.get(row.card_id) || [];
      arr.push(t);
      variantsByCard.set(row.card_id, arr);
    }
  }

  const allMediaByCard = new Map<string, MediaRow[]>();
  for (const m of (mediaRes.data || []) as Record<string, unknown>[]) {
    const row: MediaRow = {
      card_id: m.card_id as string,
      storage_bucket: m.storage_bucket as string,
      storage_path: m.storage_path as string,
      is_primary: Boolean(m.is_primary),
      width: (m.width as number | null) ?? null,
      height: (m.height as number | null) ?? null,
    };
    const arr = allMediaByCard.get(row.card_id) || [];
    arr.push(row);
    allMediaByCard.set(row.card_id, arr);
  }

  const beforeByCard = new Map<
    string,
    { bucket: string; path: string }
  >();
  for (const m of (beforeMediaRes.data || []) as {
    card_id: string;
    storage_bucket: string;
    storage_path: string;
  }[]) {
    beforeByCard.set(m.card_id, {
      bucket: m.storage_bucket,
      path: m.storage_path,
    });
  }

  return cards.map((c) => {
    const meta = metaByCard.get(c.id);
    const mediaItems = allMediaByCard.get(c.id) || [];
    const before = beforeByCard.get(c.id);
    const filteredMedia = before
      ? mediaItems.filter(
          (m) =>
            !(
              m.storage_bucket === before.bucket &&
              m.storage_path === before.path
            )
        )
      : mediaItems;
    const photoMeta: PhotoMeta[] = filteredMedia.map((m) => ({
      url: getStorageCardMediaUrl(m.storage_bucket, m.storage_path, "listing"),
      bucket: m.storage_bucket,
      path: m.storage_path,
      width: m.width,
      height: m.height,
    }));
    const photoUrls = photoMeta.map((m) => m.url);
    const prompts = variantsByCard.get(c.id) || [];

    return {
      ...c,
      promptTexts: prompts,
      hasRuPrompt: cardsWithRuPrompt.has(c.id),
      photoUrls,
      photoMeta,
      beforePhotoUrl: before
        ? getStorageCardMediaUrl(before.bucket, before.path, "listing")
        : null,
      datasetSlug: meta?.datasetSlug ?? null,
      sourceMessageId: meta?.sourceMessageId ?? null,
      sourceDate: meta?.sourceDate ?? null,
      hashtags: meta?.hashtags ?? [],
      warnings: meta?.warnings ?? [],
      seoReadinessScore: meta?.seoReadinessScore ?? 0,
      photoCount: mediaItems.length,
      promptCount: prompts.length,
      cardSplitIndex: meta?.cardSplitIndex ?? 0,
      cardSplitTotal: meta?.cardSplitTotal ?? 1,
      sourceGroupKey:
        meta?.datasetSlug && meta?.sourceMessageId
          ? `${meta.datasetSlug}::${meta.sourceMessageId}`
          : null,
      likesCount: meta?.likesCount ?? 0,
      dislikesCount: meta?.dislikesCount ?? 0,
      viewCount: meta?.viewCount ?? 0,
    };
  });
}

/** Published card slugs never listed in sitemap.xml (direct /p/… may still work). */
const SITEMAP_EXCLUDED_CARD_SLUGS = new Set([
  "devochka-v-zimney-shapke-i-palto-sredi-zasnezhennykh-vetvey-khvoynogo-lesa-a89d6",
]);

/** Fetches all published card slugs for sitemap. */
export async function getPublishedCardSlugs(): Promise<string[]> {
  const rows = await getPublishedCardsForSitemap();
  return rows.map((r) => r.slug);
}

/** Fetches published cards with updated_at for sitemap lastModified.
 *  Excludes non-first group members (card_split_index > 0). */
export async function getPublishedCardsForSitemap(): Promise<
  { slug: string; updated_at: string }[]
> {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from("prompt_cards")
      .select("slug,updated_at,card_split_index")
      .eq("is_published", true)
      .not("slug", "is", null);
    return (data || [])
      .filter((r) => {
        const slug = (r as { slug: string }).slug;
        const splitIdx =
          ((r as Record<string, unknown>).card_split_index as number) ?? 0;
        return splitIdx === 0 && !SITEMAP_EXCLUDED_CARD_SLUGS.has(slug);
      })
      .map((r) => ({
        slug: (r as { slug: string }).slug,
        updated_at: (r as { updated_at: string }).updated_at,
      }));
  } catch {
    return [];
  }
}

export type CardPageSibling = {
  id: string;
  slug: string;
  title_ru: string | null;
  card_split_index: number;
  mainPhotoUrl: string | null;
};

export type CardPageData = {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  seo_tags: Record<string, unknown> | null;
  hashtags: string[];
  source_date: string | null;
  source_dataset_slug: string | null;
  source_message_id: string | null;
  seo_readiness_score: number | null;
  promptTexts: string[];
  photoUrls: string[];
  /** Parallel to photoUrls — storage refs for debug «Было» / set-before. */
  photoMeta: PhotoMeta[];
  /** Parallel to photoUrls — from prompt_card_media (may be null if not backfilled). */
  photoDimensions: { width: number | null; height: number | null }[];
  beforePhotoUrl: string | null;
  mainPhotoUrl: string | null;
  card_split_index: number;
  card_split_total: number;
  siblings: CardPageSibling[];
  groupFirstSlug: string | null;
  likesCount: number;
  dislikesCount: number;
  viewCount: number;
  isPublished: boolean;
  authorUserId: string | null;
  authorAvatarUrl: string | null;
  authorDisplayName: string | null;
  viewerIsOwner: boolean;
};

export type GetCardPageDataOptions = {
  /** Logged-in user id from cookies; allows viewing own unpublished UGC. */
  viewerUserId?: string | null;
};

/** Fetches full card data for /p/[slug] page and generateMetadata. */
export async function getCardPageData(
  slug: string,
  options?: GetCardPageDataOptions,
): Promise<CardPageData | null> {
  const supabase = createSupabaseServer();
  /** Core columns only — avoids 404 for all /p/ pages when migration 156 (`author_user_id`) is not applied yet. */
  const { data: card, error: cardError } = await supabase
    .from("prompt_cards")
    .select(
      "id,slug,title_ru,title_en,seo_tags,seo_readiness_score,hashtags,is_published,source_date,source_dataset_slug,source_message_id,card_split_index,card_split_total,likes_count,dislikes_count,view_count"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (cardError) {
    console.error("[getCardPageData] prompt_cards select failed", cardError.message);
    return null;
  }
  if (!card) return null;

  const isPublished = !!(card as { is_published?: boolean }).is_published;

  let authorUserId: string | null = null;
  const { data: authorRow, error: authorErr } = await supabase
    .from("prompt_cards")
    .select("author_user_id")
    .eq("id", card.id)
    .maybeSingle();
  if (!authorErr && authorRow) {
    authorUserId =
      ((authorRow as { author_user_id?: string | null }).author_user_id ?? null) as string | null;
  }
  const viewerId = options?.viewerUserId ?? null;
  const viewerIsOwner = !!(viewerId && authorUserId && viewerId === authorUserId);

  if (!isPublished && !viewerIsOwner) return null;

  let authorAvatarUrl: string | null = null;
  let authorDisplayName: string | null = null;
  if (authorUserId) {
    const { data: profile } = await supabase
      .from("landing_users")
      .select("avatar_url,display_name")
      .eq("id", authorUserId)
      .maybeSingle();
    authorAvatarUrl = (profile?.avatar_url as string | null) ?? null;
    authorDisplayName = (profile?.display_name as string | null) ?? null;
  }

  const splitTotal = (card as Record<string, unknown>).card_split_total as number | null ?? 1;
  const splitIndex = (card as Record<string, unknown>).card_split_index as number | null ?? 0;
  const hasGroup =
    splitTotal > 1 &&
    card.source_dataset_slug &&
    card.source_message_id != null;

  const needsFirstSlug = hasGroup && splitIndex > 0;

  const [variantsRes, mediaRes, beforeRes, siblingsRes, firstSlugRes] = await Promise.all([
    supabase
      .from("prompt_variants")
      .select("prompt_text_ru,prompt_text_en")
      .eq("card_id", card.id)
      .order("variant_index", { ascending: true }),
    supabase
      .from("prompt_card_media")
      .select("storage_bucket,storage_path,is_primary,width,height")
      .eq("card_id", card.id)
      .eq("media_type", "photo")
      .order("is_primary", { ascending: false }),
    supabase
      .from("prompt_card_before_media")
      .select("storage_bucket,storage_path")
      .eq("card_id", card.id)
      .maybeSingle(),
    hasGroup
      ? supabase
          .from("prompt_cards")
          .select("id,slug,title_ru,card_split_index")
          .eq("source_dataset_slug", card.source_dataset_slug)
          .eq("source_message_id", card.source_message_id!)
          .eq("is_published", true)
          .neq("id", card.id)
          .order("card_split_index", { ascending: true })
      : Promise.resolve({ data: null }),
    needsFirstSlug
      ? supabase
          .from("prompt_cards")
          .select("slug")
          .eq("source_dataset_slug", card.source_dataset_slug!)
          .eq("source_message_id", card.source_message_id!)
          .eq("card_split_index", 0)
          .eq("is_published", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const promptTexts = (variantsRes.data || [])
    .map((v) => {
      const row = v as { prompt_text_ru: string | null; prompt_text_en: string | null };
      return row.prompt_text_ru?.trim() || row.prompt_text_en?.trim() || null;
    })
    .filter((t): t is string => !!t);

  const allMedia = (mediaRes.data || []) as {
    storage_bucket: string;
    storage_path: string;
    width: number | null;
    height: number | null;
  }[];
  const beforeMedia = beforeRes.data as {
    storage_bucket: string;
    storage_path: string;
  } | null;

  const filteredMedia = beforeMedia
    ? allMedia.filter(
        (m) =>
          !(
            m.storage_bucket === beforeMedia.storage_bucket &&
            m.storage_path === beforeMedia.storage_path
          )
      )
    : allMedia;

  const photoUrls = filteredMedia.map((m) =>
    getStorageCardMediaUrl(m.storage_bucket, m.storage_path, "hero")
  );
  const photoMeta: PhotoMeta[] = filteredMedia.map((m) => ({
    url: getStorageCardMediaUrl(m.storage_bucket, m.storage_path, "hero"),
    bucket: m.storage_bucket,
    path: m.storage_path,
    width: m.width ?? null,
    height: m.height ?? null,
  }));
  const photoDimensions = filteredMedia.map((m) => ({
    width: m.width ?? null,
    height: m.height ?? null,
  }));
  const beforePhotoUrl = beforeMedia
    ? getStorageCardMediaUrl(
        beforeMedia.storage_bucket,
        beforeMedia.storage_path,
        "grid"
      )
    : null;

  let siblings: CardPageSibling[] = [];
  const sibCards = (siblingsRes.data || []) as {
    id: string;
    slug: string;
    title_ru: string | null;
    card_split_index: number | null;
  }[];

  if (sibCards.length > 0) {
    const sibIds = sibCards.map((s) => s.id);
    const { data: sibMedia } = await supabase
      .from("prompt_card_media")
      .select("card_id,storage_bucket,storage_path")
      .in("card_id", sibIds)
      .eq("media_type", "photo");

    const firstPhotoByCard = new Map<string, string>();
    for (const m of (sibMedia || []) as {
      card_id: string;
      storage_bucket: string;
      storage_path: string;
    }[]) {
      if (!firstPhotoByCard.has(m.card_id)) {
        firstPhotoByCard.set(
          m.card_id,
          getStorageCardMediaUrl(m.storage_bucket, m.storage_path, "grid")
        );
      }
    }

    siblings = sibCards.map((s) => ({
      id: s.id,
      slug: s.slug,
      title_ru: s.title_ru,
      card_split_index: s.card_split_index ?? 0,
      mainPhotoUrl: firstPhotoByCard.get(s.id) || null,
    }));
  }

  const groupFirstSlug = needsFirstSlug
    ? ((firstSlugRes.data as { slug: string } | null)?.slug ?? null)
    : null;

  return {
    id: card.id,
    slug: card.slug,
    title_ru: card.title_ru,
    title_en: card.title_en,
    seo_tags: card.seo_tags as Record<string, unknown> | null,
    hashtags: (card.hashtags as string[] | null) || [],
    source_date: card.source_date,
    source_dataset_slug: (card as Record<string, unknown>).source_dataset_slug as string | null,
    source_message_id: (card as Record<string, unknown>).source_message_id != null ? String((card as Record<string, unknown>).source_message_id) : null,
    seo_readiness_score: (card as Record<string, unknown>).seo_readiness_score as number | null,
    promptTexts,
    photoUrls,
    photoMeta,
    photoDimensions,
    beforePhotoUrl,
    mainPhotoUrl: photoUrls[0] || null,
    card_split_index: splitIndex,
    card_split_total: splitTotal,
    siblings,
    groupFirstSlug,
    likesCount: (card as Record<string, unknown>).likes_count as number ?? 0,
    dislikesCount: (card as Record<string, unknown>).dislikes_count as number ?? 0,
    viewCount: (card as Record<string, unknown>).view_count as number ?? 0,
    isPublished,
    authorUserId,
    authorAvatarUrl,
    authorDisplayName,
    viewerIsOwner,
  };
}
