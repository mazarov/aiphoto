import { createSupabaseServer } from "@/lib/supabase";
import { getVisualSearchConfig } from "@/lib/visual-search-config";

export type SearchAnalyticsDailyRow = {
  day: string;
  searches: number;
  unique_visitors: number;
  zero_results: number;
  avg_result_count: number;
  with_more: number;
  searches_with_click: number;
  clicks: number;
};

export type SearchAnalyticsQueryRow = {
  query_norm: string;
  query_raw: string;
  searches: number;
  unique_visitors: number;
  avg_result_count: number;
  zero_results: number;
  clicks: number;
  searches_with_click: number;
};

export type SearchAnalyticsSummary = {
  searches: number;
  uniqueVisitors: number;
  zeroResults: number;
  zeroResultRate: number;
  ctr: number;
  avgResultCount: number;
  clicks: number;
  searchesWithClick: number;
};

export type SearchModeSplitStats = {
  totalRequests: number;
  hybridRequests: number;
  textOnlyRequests: number;
  fallbackRequests: number;
  hybridShare: number;
  textShare: number;
};

export type SearchCardEmbeddingCoverage = {
  generation: number;
  publishedWithPhoto: number;
  ready: number;
  withoutEmbedding: number;
  coverageRate: number;
  pending: number;
  retry: number;
  processing: number;
  dead: number;
};

export type SearchQueryVectorStats = {
  trackedRequests: number;
  sentToGemini: number;
  geminiOk: number;
  geminiError: number;
  guardBlocked: number;
  servedFromReadyVector: number;
  l1Hits: number;
  l2DbHits: number;
  sentToGeminiShare: number;
  readyVectorShare: number;
  storedVectorsTotal: number;
  storedVectorsPeriod: number;
  todayGeminiGlobalUsed: number;
  todayGeminiGlobalLimit: number;
};

export type SearchEngineDailyRow = {
  day: string;
  totalRequests: number;
  hybridRequests: number;
  textOnlyRequests: number;
  fallbackRequests: number;
  sentToGemini: number;
  readyVectorHits: number;
};

export type SearchObservabilityData = {
  visualEnabled: boolean;
  modeSplit: SearchModeSplitStats;
  cardCoverage: SearchCardEmbeddingCoverage;
  queryVectors: SearchQueryVectorStats;
  dailyEngine: SearchEngineDailyRow[];
};

export type SearchAnalyticsDashboard = {
  days: number;
  summary: SearchAnalyticsSummary;
  observability: SearchObservabilityData;
  daily: SearchAnalyticsDailyRow[];
  topQueries: SearchAnalyticsQueryRow[];
  zeroQueries: SearchAnalyticsQueryRow[];
};

const SEARCH_DAYS = new Set([1, 7, 30, 90]);

export function parseSearchAnalyticsDays(raw: string | null): number {
  const value = Number(raw || 30);
  return SEARCH_DAYS.has(value) ? value : 30;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isMissingObservabilityRpc(message: string): boolean {
  return /Could not find the function|PGRST202|42883/i.test(message);
}

function mapQueryRow(row: Record<string, unknown>): SearchAnalyticsQueryRow {
  return {
    query_norm: String(row.query_norm || ""),
    query_raw: String(row.query_raw || row.query_norm || ""),
    searches: asNumber(row.searches),
    unique_visitors: asNumber(row.unique_visitors),
    avg_result_count: asNumber(row.avg_result_count),
    zero_results: asNumber(row.zero_results),
    clicks: asNumber(row.clicks),
    searches_with_click: asNumber(row.searches_with_click),
  };
}

function emptySummary(): SearchAnalyticsSummary {
  return {
    searches: 0,
    uniqueVisitors: 0,
    zeroResults: 0,
    zeroResultRate: 0,
    ctr: 0,
    avgResultCount: 0,
    clicks: 0,
    searchesWithClick: 0,
  };
}

export function rate(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

export function parseSearchObservabilityPayload(
  raw: unknown,
  globalDailyLimit = getVisualSearchConfig().globalDailyLimit,
): SearchObservabilityData {
  const root = asRecord(raw);
  const coverage = asRecord(root.coverage);
  const engine = asRecord(root.engine);

  const publishedWithPhoto = Math.max(0, asNumber(coverage.published_with_photo));
  const ready = Math.max(0, asNumber(coverage.ready));
  const withoutEmbedding = Math.max(0, publishedWithPhoto - ready);

  const hybridRequests = Math.max(0, asNumber(engine.hybrid_requests));
  const textOnlyRequests = Math.max(0, asNumber(engine.text_only_requests));
  const fallbackRequests = Math.max(0, asNumber(engine.fallback_requests));
  const totalRequests = Math.max(
    hybridRequests + textOnlyRequests,
    asNumber(engine.total_requests),
  );

  const l1Hits = Math.max(0, asNumber(engine.embed_l1_hits));
  const l2DbHits = Math.max(0, asNumber(engine.embed_l2_db_hits));
  const geminiOk = Math.max(0, asNumber(engine.embed_gemini_ok));
  const geminiError = Math.max(0, asNumber(engine.embed_gemini_error));
  const guardBlocked = Math.max(0, asNumber(engine.embed_guard_blocked));

  const sentToGemini = geminiOk + geminiError;
  const servedFromReadyVector = l1Hits + l2DbHits;
  const trackedRequests = sentToGemini + servedFromReadyVector + guardBlocked;

  const dailyRaw = Array.isArray(root.daily_engine) ? root.daily_engine : [];
  const dailyEngine: SearchEngineDailyRow[] = dailyRaw.map((item) => {
    const row = asRecord(item);
    const dayL1 = Math.max(0, asNumber(row.embed_l1_hits));
    const dayL2 = Math.max(0, asNumber(row.embed_l2_db_hits));
    const dayGemOk = Math.max(0, asNumber(row.embed_gemini_ok));
    const dayGemErr = Math.max(0, asNumber(row.embed_gemini_error));
    return {
      day: String(row.day || "").slice(0, 10),
      totalRequests: Math.max(0, asNumber(row.total_requests)),
      hybridRequests: Math.max(0, asNumber(row.hybrid_requests)),
      textOnlyRequests: Math.max(0, asNumber(row.text_only_requests)),
      fallbackRequests: Math.max(0, asNumber(row.fallback_requests)),
      sentToGemini: dayGemOk + dayGemErr,
      readyVectorHits: dayL1 + dayL2,
    };
  });

  return {
    visualEnabled: root.visual_enabled === true,
    modeSplit: {
      totalRequests,
      hybridRequests,
      textOnlyRequests,
      fallbackRequests,
      hybridShare: rate(hybridRequests, totalRequests),
      textShare: rate(textOnlyRequests, totalRequests),
    },
    cardCoverage: {
      generation: Math.max(1, asNumber(coverage.generation) || 1),
      publishedWithPhoto,
      ready,
      withoutEmbedding,
      coverageRate: rate(ready, publishedWithPhoto),
      pending: Math.max(0, asNumber(coverage.pending)),
      retry: Math.max(0, asNumber(coverage.retry)),
      processing: Math.max(0, asNumber(coverage.processing)),
      dead: Math.max(0, asNumber(coverage.dead)),
    },
    queryVectors: {
      trackedRequests,
      sentToGemini,
      geminiOk,
      geminiError,
      guardBlocked,
      servedFromReadyVector,
      l1Hits,
      l2DbHits,
      sentToGeminiShare: rate(sentToGemini, trackedRequests),
      readyVectorShare: rate(servedFromReadyVector, trackedRequests),
      storedVectorsTotal: Math.max(0, asNumber(root.stored_query_vectors_total)),
      storedVectorsPeriod: Math.max(0, asNumber(root.stored_query_vectors_period)),
      todayGeminiGlobalUsed: Math.max(0, asNumber(root.today_gemini_global_used)),
      todayGeminiGlobalLimit: Math.max(1, globalDailyLimit),
    },
    dailyEngine,
  };
}

export async function fetchSearchAnalyticsDashboard(
  days: number,
): Promise<SearchAnalyticsDashboard> {
  const supabase = createSupabaseServer();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - Math.max(0, days - 1));

  const [summaryRes, dailyRes, topRes, zeroRes, obsRes] = await Promise.all([
    supabase.rpc("admin_search_summary", { p_days: days }),
    supabase
      .from("analytics_search_daily")
      .select(
        "day,searches,unique_visitors,zero_results,avg_result_count,with_more,searches_with_click,clicks",
      )
      .gte("day", since.toISOString())
      .order("day"),
    supabase.rpc("admin_search_queries", {
      p_days: days,
      p_limit: 50,
      p_zero_only: false,
    }),
    supabase.rpc("admin_search_queries", {
      p_days: days,
      p_limit: 50,
      p_zero_only: true,
    }),
    supabase.rpc("admin_search_observability", { p_days: days }),
  ]);

  if (summaryRes.error) throw summaryRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (topRes.error) throw topRes.error;
  if (zeroRes.error) throw zeroRes.error;

  let observabilityPayload: unknown = obsRes.data;
  if (obsRes.error) {
    if (!isMissingObservabilityRpc(obsRes.error.message)) {
      throw obsRes.error;
    }
    const covFallback = await supabase.rpc("visual_embedding_coverage");
    observabilityPayload = {
      visual_enabled: false,
      coverage: covFallback.error ? {} : covFallback.data,
      engine: {},
      daily_engine: [],
    };
  }

  const summaryRow = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
  const searches = asNumber(summaryRow?.searches);
  const zeroResults = asNumber(summaryRow?.zero_results);
  const searchesWithClick = asNumber(summaryRow?.searches_with_click);
  const summary: SearchAnalyticsSummary = summaryRow
    ? {
        searches,
        uniqueVisitors: asNumber(summaryRow.unique_visitors),
        zeroResults,
        zeroResultRate: rate(zeroResults, searches),
        ctr: rate(searchesWithClick, searches),
        avgResultCount: asNumber(summaryRow.avg_result_count),
        clicks: asNumber(summaryRow.clicks),
        searchesWithClick,
      }
    : emptySummary();

  const daily = ((dailyRes.data || []) as Record<string, unknown>[]).map((row) => ({
    day: String(row.day || "").slice(0, 10),
    searches: asNumber(row.searches),
    unique_visitors: asNumber(row.unique_visitors),
    zero_results: asNumber(row.zero_results),
    avg_result_count: asNumber(row.avg_result_count),
    with_more: asNumber(row.with_more),
    searches_with_click: asNumber(row.searches_with_click),
    clicks: asNumber(row.clicks),
  }));

  return {
    days,
    summary,
    observability: parseSearchObservabilityPayload(observabilityPayload),
    daily,
    topQueries: ((topRes.data || []) as Record<string, unknown>[]).map(mapQueryRow),
    zeroQueries: ((zeroRes.data || []) as Record<string, unknown>[]).map(mapQueryRow),
  };
}
