import { createSupabaseServer } from "@/lib/supabase";

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

export type SearchAnalyticsDashboard = {
  days: number;
  summary: SearchAnalyticsSummary;
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

export async function fetchSearchAnalyticsDashboard(
  days: number,
): Promise<SearchAnalyticsDashboard> {
  const supabase = createSupabaseServer();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - Math.max(0, days - 1));

  const [summaryRes, dailyRes, topRes, zeroRes] = await Promise.all([
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
  ]);

  if (summaryRes.error) throw summaryRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (topRes.error) throw topRes.error;
  if (zeroRes.error) throw zeroRes.error;

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
    daily,
    topQueries: ((topRes.data || []) as Record<string, unknown>[]).map(mapQueryRow),
    zeroQueries: ((zeroRes.data || []) as Record<string, unknown>[]).map(mapQueryRow),
  };
}
