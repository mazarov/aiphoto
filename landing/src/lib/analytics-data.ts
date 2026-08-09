import { createSupabaseServer } from "@/lib/supabase";

export type ClientsDailyRow = {
  day: string; client_source: string; kind: string; requests: number; unique_actors: number;
};
export type TopUserRow = {
  email: string | null; total_requests: number; generations: number; analyzes: number; last_seen: string | null;
};
export type ExtensionFunnelRow = {
  day: string; mode: string; client_source: string; locale: string; platform: string; browser: string;
  clicks: number; starts_ok: number; starts_err: number; results_shown: number; errors_shown: number;
  copies: number; unique_users_clicked: number;
};
export type ExtensionOutcomeRow = {
  day: string; endpoint: string; client_source: string; locale: string; style: string; requests: number;
  success: number; truncated: number; rate_limited: number; upstream_error: number; empty_response: number;
  unique_actors: number;
};
export type RecentEventRow = {
  created_at: string; endpoint: string; client_source: string; allowed: boolean; outcome: string | null;
  error_code: string | null; latency_ms: number | null; style: string | null; correlation_id: string | null;
};
export type AnalyticsDashboardData = {
  days: number;
  summary: { totalUsers: number; activeUsersInPeriod: number; requestsInPeriod: number;
    uniqueActorsInPeriod: number; generationsInPeriod: number; analyzesInPeriod: number };
  clientsDaily: ClientsDailyRow[]; topUsers: TopUserRow[]; recentEvents: RecentEventRow[];
  extensionFunnel: ExtensionFunnelRow[]; extensionOutcomes: ExtensionOutcomeRow[];
};

function sinceIso(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - Math.max(0, days - 1));
  return date.toISOString();
}

export async function fetchAnalyticsDashboard(days: number): Promise<AnalyticsDashboardData> {
  const supabase = createSupabaseServer();
  const since = sinceIso(days);
  const [users, active, clients, top, recent, actors, funnel, outcomes] = await Promise.all([
    supabase.from("imageprompt_users").select("id", { count: "exact", head: true }),
    supabase.from("analytics_user_activity").select("user_id", { count: "exact", head: true })
      .gte("last_seen", since).gt("total_requests", 0),
    supabase.from("analytics_clients_daily").select("*").gte("day", since).order("day"),
    supabase.from("analytics_user_activity").select("email,total_requests,generations,analyzes,last_seen")
      .gt("total_requests", 0).order("total_requests", { ascending: false }).limit(50),
    supabase.from("extension_analyze_events")
      .select("created_at,endpoint,client_source,allowed,outcome,error_code,latency_ms,style,correlation_id")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("analytics_requests").select("user_id,ip_hash").gte("event_time", since).eq("allowed", true),
    supabase.from("analytics_extension_funnel").select("*").gte("day", since).order("day"),
    supabase.from("analytics_extension_outcomes_daily").select("*").gte("day", since).order("day"),
  ]);
  const failed = [users, active, clients, top, recent, actors, funnel, outcomes].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const clientsDaily = (clients.data || []).map((row) => ({
    day: String(row.day), client_source: String(row.client_source || "unknown"), kind: String(row.kind || ""),
    requests: Number(row.requests || 0), unique_actors: Number(row.unique_actors || 0),
  }));
  const generations = clientsDaily.filter((row) => row.kind === "generation").reduce((n, row) => n + row.requests, 0);
  const analyzes = clientsDaily.filter((row) => row.kind !== "generation").reduce((n, row) => n + row.requests, 0);
  const uniqueActors = new Set((actors.data || []).map((row) => row.user_id || row.ip_hash).filter(Boolean)).size;
  const numberFields = <T extends Record<string, unknown>>(row: T, fields: string[]): T => {
    const result = { ...row };
    for (const field of fields) (result as Record<string, unknown>)[field] = Number(row[field] || 0);
    return result;
  };

  return {
    days,
    summary: {
      totalUsers: users.count || 0, activeUsersInPeriod: active.count || 0,
      requestsInPeriod: generations + analyzes, uniqueActorsInPeriod: uniqueActors,
      generationsInPeriod: generations, analyzesInPeriod: analyzes,
    },
    clientsDaily,
    topUsers: (top.data || []).map((row) => numberFields(row, ["total_requests", "generations", "analyzes"])) as TopUserRow[],
    recentEvents: (recent.data || []) as RecentEventRow[],
    extensionFunnel: (funnel.data || []).map((row) => numberFields(row, [
      "clicks", "starts_ok", "starts_err", "results_shown", "errors_shown", "copies", "unique_users_clicked",
    ])) as ExtensionFunnelRow[],
    extensionOutcomes: (outcomes.data || []).map((row) => numberFields(row, [
      "requests", "success", "truncated", "rate_limited", "upstream_error", "empty_response", "unique_actors",
    ])) as ExtensionOutcomeRow[],
  };
}
