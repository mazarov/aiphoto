import { createClient } from "@supabase/supabase-js";

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
    p_min_cards: 2,
  });

  if (error) throw new Error(`resolve_route_cards: ${error.message}`);
  const result = data as RouteCardsResult;
  result.cards = await expandCardGroups(result.cards);
  return result;
}

/** Fetches sibling cards for any card in a group; never splits groups. */
async function expandCardGroups(cards: RouteCard[]): Promise<RouteCard[]> {
  if (cards.length === 0) return [];
  const supabase = createSupabaseServer();
  const ids = new Set(cards.map((c) => c.id));
  const { data: meta } = await supabase
    .from("prompt_cards")
    .select("id,source_dataset_slug,source_message_id,card_split_total")
    .in("id", [...ids]);
  const groupsToExpand = new Set<string>();
  for (const r of meta || []) {
    const row = r as { id: string; source_dataset_slug: string | null; source_message_id: number | null; card_split_total: number | null };
    if (row.card_split_total && row.card_split_total > 1 && row.source_dataset_slug && row.source_message_id != null) {
      groupsToExpand.add(`${row.source_dataset_slug}::${row.source_message_id}`);
    }
  }
  if (groupsToExpand.size === 0) return cards;
  const allIds = new Set(ids);
  for (const gk of groupsToExpand) {
    const [dataset, msgId] = gk.split("::");
    const { data: siblings } = await supabase
      .from("prompt_cards")
      .select("id,slug,title_ru,title_en,seo_tags,seo_readiness_score")
      .eq("source_dataset_slug", dataset)
      .eq("source_message_id", Number(msgId));
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
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0,
  });

  if (error) throw new Error(`search_cards_filtered: ${error.message}`);
  const cards = (data || []) as RouteCard[];
  return expandCardGroups(cards);
}

export async function fetchMenuCounts(
  routeMap: { href: string; params: { audience_tag?: string; style_tag?: string; occasion_tag?: string; object_tag?: string; doc_task_tag?: string } }[]
): Promise<Record<string, number>> {
  if (routeMap.length === 0) return {};

  const supabase = createSupabaseServer();
  const results: Record<string, number> = {};

  const BATCH = 6;
  for (let i = 0; i < routeMap.length; i += BATCH) {
    const batch = routeMap.slice(i, i + BATCH);
    const promises = batch.map(async ({ href, params }) => {
      const { data } = await supabase.rpc("resolve_route_cards", {
        p_audience_tag: params.audience_tag ?? null,
        p_style_tag: params.style_tag ?? null,
        p_occasion_tag: params.occasion_tag ?? null,
        p_object_tag: params.object_tag ?? null,
        p_doc_task_tag: params.doc_task_tag ?? null,
        p_site_lang: "ru",
        p_limit: 1000,
        p_offset: 0,
        p_min_cards: 0,
      });
      return { href, count: (data as RouteCardsResult | null)?.cards_count ?? 0 };
    });
    const batchResults = await Promise.all(promises);
    for (const { href, count } of batchResults) {
      results[href] = count;
    }
  }

  return results;
}

export type PhotoMeta = {
  url: string;
  bucket: string;
  path: string;
};

export type PromptCardFull = RouteCard & {
  promptTexts: string[];
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
};

type MediaRow = {
  card_id: string;
  storage_bucket: string;
  storage_path: string;
  is_primary: boolean;
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
          "id,source_dataset_slug,source_message_id,source_date,hashtags,parse_warnings,seo_readiness_score,card_split_index,card_split_total"
        )
        .in("id", ids),
      supabase
        .from("prompt_variants")
        .select("card_id,prompt_text_ru")
        .in("card_id", ids)
        .order("variant_index", { ascending: true }),
      supabase
        .from("prompt_card_media")
        .select("card_id,storage_bucket,storage_path,is_primary")
        .in("card_id", ids)
        .eq("media_type", "photo")
        .order("is_primary", { ascending: false }),
      supabase
        .from("prompt_card_before_media")
        .select("card_id,storage_bucket,storage_path")
        .in("card_id", ids),
    ]);

  type CardMeta = {
    datasetSlug: string | null;
    sourceMessageId: string | null;
    sourceDate: string | null;
    hashtags: string[];
    warnings: string[];
    seoReadinessScore: number;
    cardSplitIndex: number;
    cardSplitTotal: number;
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
    });
  }

  const variantsByCard = new Map<string, string[]>();
  for (const v of variantsRes.data || []) {
    const t = (v as { card_id: string; prompt_text_ru: string | null })
      .prompt_text_ru;
    if (t?.trim()) {
      const arr = variantsByCard.get(v.card_id) || [];
      arr.push(t.trim());
      variantsByCard.set(v.card_id, arr);
    }
  }

  const allMediaByCard = new Map<string, MediaRow[]>();
  for (const m of (mediaRes.data || []) as MediaRow[]) {
    const arr = allMediaByCard.get(m.card_id) || [];
    arr.push(m);
    allMediaByCard.set(m.card_id, arr);
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
      url: getStoragePublicUrl(m.storage_bucket, m.storage_path),
      bucket: m.storage_bucket,
      path: m.storage_path,
    }));
    const photoUrls = photoMeta.map((m) => m.url);
    const prompts = variantsByCard.get(c.id) || [];

    return {
      ...c,
      promptTexts: prompts,
      photoUrls,
      photoMeta,
      beforePhotoUrl: before
        ? getStoragePublicUrl(before.bucket, before.path)
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
    };
  });
}

/** Fetches all published card slugs for sitemap. */
export async function getPublishedCardSlugs(): Promise<string[]> {
  const rows = await getPublishedCardsForSitemap();
  return rows.map((r) => r.slug);
}

/** Fetches published cards with updated_at for sitemap lastModified. */
export async function getPublishedCardsForSitemap(): Promise<
  { slug: string; updated_at: string }[]
> {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from("prompt_cards")
      .select("slug,updated_at")
      .eq("is_published", true)
      .not("slug", "is", null);
    return (data || []).map((r) => ({
      slug: (r as { slug: string }).slug,
      updated_at: (r as { updated_at: string }).updated_at,
    }));
  } catch {
    return [];
  }
}

export type CardPageData = {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  seo_tags: Record<string, unknown> | null;
  hashtags: string[];
  source_date: string | null;
  promptTexts: string[];
  photoUrls: string[];
  beforePhotoUrl: string | null;
  mainPhotoUrl: string | null;
};

/** Fetches full card data for /p/[slug] page and generateMetadata. */
export async function getCardPageData(slug: string): Promise<CardPageData | null> {
  const supabase = createSupabaseServer();
  const { data: card } = await supabase
    .from("prompt_cards")
    .select(
      "id,slug,title_ru,title_en,seo_tags,hashtags,is_published,source_date,source_dataset_slug,source_message_id"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!card) return null;

  const [variantsRes, mediaRes, beforeRes] = await Promise.all([
    supabase
      .from("prompt_variants")
      .select("prompt_text_ru")
      .eq("card_id", card.id)
      .order("variant_index", { ascending: true }),
    supabase
      .from("prompt_card_media")
      .select("storage_bucket,storage_path")
      .eq("card_id", card.id)
      .eq("media_type", "photo"),
    supabase
      .from("prompt_card_before_media")
      .select("storage_bucket,storage_path")
      .eq("card_id", card.id)
      .maybeSingle(),
  ]);

  const promptTexts = (variantsRes.data || [])
    .map((v) => (v as { prompt_text_ru: string | null }).prompt_text_ru)
    .filter((t): t is string => !!t?.trim());

  const allMedia = (mediaRes.data || []) as {
    storage_bucket: string;
    storage_path: string;
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
    getStoragePublicUrl(m.storage_bucket, m.storage_path)
  );
  const beforePhotoUrl = beforeMedia
    ? getStoragePublicUrl(beforeMedia.storage_bucket, beforeMedia.storage_path)
    : null;

  return {
    id: card.id,
    slug: card.slug,
    title_ru: card.title_ru,
    title_en: card.title_en,
    seo_tags: card.seo_tags as Record<string, unknown> | null,
    hashtags: (card.hashtags as string[] | null) || [],
    source_date: card.source_date,
    promptTexts,
    photoUrls,
    beforePhotoUrl,
    mainPhotoUrl: photoUrls[0] || null,
  };
}
