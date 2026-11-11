import {
  RRF_K,
  RRF_TEXT_WEIGHT,
  RRF_VISUAL_WEIGHT,
  STRONG_FTS_MIN_SCORE,
  VISUAL_SEARCH_MERGED_MAX,
} from "@/lib/visual-search-config";

export const ENGAGEMENT_BOOST_CAP = 0.0045;
export const ENGAGEMENT_CLICKS_WEIGHT = 0.0012;
export const ENGAGEMENT_VIEWS_WEIGHT = 0.0002;

export type SearchRankCard = {
  id: string;
  slug: string;
  title_ru: string | null;
  title_en: string | null;
  seo_tags: unknown;
  relevance_score: number;
  match_type: string;
  visual_distance?: number;
  source_date?: string | null;
  search_clicks_30d?: number;
  view_count?: number;
};

export type RankedSearchCard = SearchRankCard & {
  match_type: string;
};

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

export function isExactTitleMatch(query: string, card: SearchRankCard): boolean {
  const q = normalizeTitle(query);
  if (q.length < 2) return false;
  return normalizeTitle(card.title_ru) === q || normalizeTitle(card.title_en) === q;
}

export function isStrongFtsMatch(card: SearchRankCard): boolean {
  return (
    (card.match_type === "fts" || card.match_type === "fts+trgm") &&
    card.relevance_score >= STRONG_FTS_MIN_SCORE
  );
}

export function computeSearchEngagementBoost(
  clicks30d?: number | null,
  viewCount?: number | null,
): number {
  const clicks = Math.max(0, Number(clicks30d ?? 0) || 0);
  const views = Math.max(0, Number(viewCount ?? 0) || 0);
  if (clicks === 0 && views === 0) return 0;
  return Math.min(
    ENGAGEMENT_BOOST_CAP,
    ENGAGEMENT_CLICKS_WEIGHT * Math.log1p(clicks) +
      ENGAGEMENT_VIEWS_WEIGHT * Math.log1p(views),
  );
}

function rrfScore(rank: number | undefined, weight: number): number {
  if (rank === undefined) return 0;
  return weight / (RRF_K + rank);
}

function combinedMatchType(
  textType: string | undefined,
  hasVisual: boolean,
): string {
  if (hasVisual && textType) {
    if (textType.startsWith("fts")) return "fts+visual";
    if (textType === "trgm") return "trgm+visual";
    return `${textType}+visual`;
  }
  if (hasVisual) return "visual";
  return textType ?? "fts";
}

export function mergeHybridSearchResults(options: {
  query: string;
  text: SearchRankCard[];
  visual: SearchRankCard[];
  limit: number;
  offset: number;
}): RankedSearchCard[] {
  const textRank = new Map<string, number>();
  const visualRank = new Map<string, number>();
  const merged = new Map<string, SearchRankCard>();

  options.text.forEach((card, index) => {
    textRank.set(card.id, index + 1);
    merged.set(card.id, { ...card });
  });
  options.visual.forEach((card, index) => {
    visualRank.set(card.id, index + 1);
    const existing = merged.get(card.id);
    merged.set(card.id, {
      ...(existing ?? card),
      visual_distance: card.visual_distance,
      source_date: existing?.source_date ?? card.source_date ?? null,
      search_clicks_30d:
        existing?.search_clicks_30d ?? card.search_clicks_30d ?? 0,
      view_count: existing?.view_count ?? card.view_count ?? 0,
    });
  });

  const scored = [...merged.values()].map((card) => {
    const hasText = textRank.has(card.id);
    const hasVisual = visualRank.has(card.id);
    const exact = isExactTitleMatch(options.query, card);
    const strongFts = hasText && isStrongFtsMatch(card);
    const tier = exact ? 0 : strongFts ? 1 : 2;
    const baseRrf =
      rrfScore(textRank.get(card.id), RRF_TEXT_WEIGHT) +
      rrfScore(visualRank.get(card.id), RRF_VISUAL_WEIGHT);
    const engagementBoost =
      tier === 2
        ? computeSearchEngagementBoost(card.search_clicks_30d, card.view_count)
        : 0;
    const score = baseRrf + engagementBoost;

    return {
      card: {
        ...card,
        match_type: combinedMatchType(hasText ? card.match_type : undefined, hasVisual),
      },
      tier,
      score,
      clicks30d: Math.max(0, Number(card.search_clicks_30d ?? 0) || 0),
      textRank: textRank.get(card.id) ?? Number.POSITIVE_INFINITY,
      visualDistance: card.visual_distance ?? Number.POSITIVE_INFINITY,
    };
  });

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier < 2) return a.textRank - b.textRank;
    if (b.score !== a.score) return b.score - a.score;
    if (b.clicks30d !== a.clicks30d) return b.clicks30d - a.clicks30d;
    if (b.card.relevance_score !== a.card.relevance_score) {
      return b.card.relevance_score - a.card.relevance_score;
    }
    if (a.visualDistance !== b.visualDistance) return a.visualDistance - b.visualDistance;
    return a.card.id.localeCompare(b.card.id);
  });

  const start = Math.max(0, options.offset);
  const end = start + Math.max(1, options.limit);
  return scored
    .slice(0, VISUAL_SEARCH_MERGED_MAX)
    .slice(start, end)
    .map((row) => row.card);
}
