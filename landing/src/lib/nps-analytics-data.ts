import { createSupabaseServer } from "@/lib/supabase";
import { isNpsTrigger, type NpsTrigger } from "@/lib/nps-token";

export type NpsDailyRow = {
  day: string;
  sent: number;
  responses: number;
  avg_score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
};

export type NpsResponseRow = {
  survey_id: string;
  user_id: string;
  email: string;
  trigger: NpsTrigger;
  sent_at: string | null;
  score: number | null;
  comment: string | null;
  submitted_at: string | null;
};

export type NpsAnalyticsSummary = {
  sent: number;
  responses: number;
  responseRate: number;
  avgScore: number | null;
  promoters: number;
  passives: number;
  detractors: number;
};

export type NpsAnalyticsDashboard = {
  days: number;
  summary: NpsAnalyticsSummary;
  daily: NpsDailyRow[];
  responses: NpsResponseRow[];
};

const NPS_DAYS = new Set([1, 7, 30, 90]);

export function parseNpsAnalyticsDays(raw: string | null): number {
  const value = Number(raw || 30);
  return NPS_DAYS.has(value) ? value : 30;
}

export function npsRate(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptySummary(): NpsAnalyticsSummary {
  return {
    sent: 0,
    responses: 0,
    responseRate: 0,
    avgScore: null,
    promoters: 0,
    passives: 0,
    detractors: 0,
  };
}

function mapResponse(row: Record<string, unknown>): NpsResponseRow {
  const trigger = String(row.trigger || "");
  return {
    survey_id: String(row.survey_id || ""),
    user_id: String(row.user_id || ""),
    email: String(row.email || ""),
    trigger: isNpsTrigger(trigger) ? trigger : "after_2",
    sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
    score: asNullableNumber(row.score),
    comment: typeof row.comment === "string" && row.comment.trim() ? row.comment : null,
    submitted_at: typeof row.submitted_at === "string" ? row.submitted_at : null,
  };
}

export async function fetchNpsAnalyticsDashboard(days: number): Promise<NpsAnalyticsDashboard> {
  const supabase = createSupabaseServer();
  const [summaryRes, dailyRes, responsesRes] = await Promise.all([
    supabase.rpc("admin_nps_summary", { p_days: days }),
    supabase.rpc("admin_nps_daily", { p_days: days }),
    supabase.rpc("admin_nps_responses", { p_days: days, p_limit: 100 }),
  ]);
  if (summaryRes.error) throw summaryRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (responsesRes.error) throw responsesRes.error;

  const summaryRow = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
  const sent = asNumber(summaryRow?.sent);
  const responses = asNumber(summaryRow?.responses);
  const summary: NpsAnalyticsSummary = summaryRow
    ? {
        sent,
        responses,
        responseRate: npsRate(responses, sent),
        avgScore: asNullableNumber(summaryRow.avg_score),
        promoters: asNumber(summaryRow.promoters),
        passives: asNumber(summaryRow.passives),
        detractors: asNumber(summaryRow.detractors),
      }
    : emptySummary();

  const daily = ((dailyRes.data || []) as Record<string, unknown>[]).map((row) => ({
    day: String(row.day || "").slice(0, 10),
    sent: asNumber(row.sent),
    responses: asNumber(row.responses),
    avg_score: asNullableNumber(row.avg_score),
    promoters: asNumber(row.promoters),
    passives: asNumber(row.passives),
    detractors: asNumber(row.detractors),
  }));

  return {
    days,
    summary,
    daily,
    responses: ((responsesRes.data || []) as Record<string, unknown>[]).map(mapResponse),
  };
}
