import { MAIL_DAILY_CAP } from "@/lib/mail-catalog";
import { isMailTemplateId, type MailTemplateId } from "@/lib/mail-templates";

export const MAIL_ADMIN_STATS_TIMEZONE = "Europe/Moscow";
export const MAIL_ADMIN_STATS_DAYS_DEFAULT = 14;
export const MAIL_ADMIN_STATS_DAYS_MAX = 30;

export type MailAdminStatsKind = "transactional" | "marketing";
export type MailAdminStatsStatus = "sent" | "skipped" | "failed";

export type MailAdminStatsBucket = {
  day: string;
  template_id: MailTemplateId;
  kind: MailAdminStatsKind;
  status: MailAdminStatsStatus;
  n: number;
};

export type MailAdminStatsTemplateRow = {
  template_id: MailTemplateId;
  kind: MailAdminStatsKind;
  sent: number;
  skipped: number;
  failed: number;
};

export type MailAdminStatsDayRow = {
  day: string;
  sent: number;
  skipped: number;
  failed: number;
  queued: number;
  remaining: number | null;
  by_template: MailAdminStatsTemplateRow[];
};

export type MailAdminDailyStatsResponse = {
  timezone: typeof MAIL_ADMIN_STATS_TIMEZONE;
  from: string;
  to: string;
  cap: number;
  days: MailAdminStatsDayRow[];
};

export type MailDailyBudgetSnapshot = {
  day: string | null;
  sent: number;
  queued: number;
  remaining: number;
  cap: number;
};

export type MailOutboxStatEvent = {
  status: string;
  template_id: string;
  kind: string;
  created_at?: string;
  sent_at?: string | null;
  updated_at?: string;
};

type MailStatsRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

function asCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function isKind(value: string): value is MailAdminStatsKind {
  return value === "transactional" || value === "marketing";
}

function isStatus(value: string): value is MailAdminStatsStatus {
  return value === "sent" || value === "skipped" || value === "failed";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function mailMoscowDay(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_mail_timestamp");
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MAIL_ADMIN_STATS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addCalendarDays(isoDate: string, delta: number): string {
  if (!isIsoDate(isoDate)) throw new Error("invalid_iso_date");
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

export function listCalendarDaysDesc(from: string, to: string): string[] {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    throw new Error("invalid_mail_stats_window");
  }
  const days: string[] = [];
  for (let cursor = to; cursor >= from; cursor = addCalendarDays(cursor, -1)) {
    days.push(cursor);
    if (days.length > MAIL_ADMIN_STATS_DAYS_MAX) {
      throw new Error("invalid_mail_stats_window");
    }
  }
  return days;
}

export function mailAdminStatsWindow(
  days: number,
  now: Date = new Date(),
): { from: string; to: string } {
  if (!Number.isInteger(days) || days < 1 || days > MAIL_ADMIN_STATS_DAYS_MAX) {
    throw new Error("invalid_days");
  }
  const to = mailMoscowDay(now);
  return { from: addCalendarDays(to, 1 - days), to };
}

export function parseMailAdminStatsDays(
  raw: string | null | undefined,
): { ok: true; days: number } | { ok: false; error: "invalid_days" } {
  if (raw == null || raw === "") {
    return { ok: true, days: MAIL_ADMIN_STATS_DAYS_DEFAULT };
  }
  if (!/^\d+$/.test(raw)) return { ok: false, error: "invalid_days" };
  const days = Number(raw);
  if (days < 1 || days > MAIL_ADMIN_STATS_DAYS_MAX) {
    return { ok: false, error: "invalid_days" };
  }
  return { ok: true, days };
}

export function resolveMailAdminStatsQuery(input: {
  admin: { ok: true } | { ok: false; status: 401 | 403; error: string };
  daysParam: string | null;
}):
  | { ok: true; days: number }
  | { ok: false; status: 400 | 401 | 403; error: string } {
  if (!input.admin.ok) {
    return { ok: false, status: input.admin.status, error: input.admin.error };
  }
  const parsed = parseMailAdminStatsDays(input.daysParam);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  return parsed;
}

export function bucketMailOutboxStatEvent(
  event: MailOutboxStatEvent,
): { day: string; status: MailAdminStatsStatus } | null {
  if (event.status === "sent") {
    if (!event.sent_at) return null;
    return { day: mailMoscowDay(event.sent_at), status: "sent" };
  }
  if (event.status === "skipped" || event.status === "failed") {
    const at = event.updated_at || event.created_at;
    if (!at) return null;
    return { day: mailMoscowDay(at), status: event.status };
  }
  return null;
}

export function bucketMailOutboxEvents(events: MailOutboxStatEvent[]): MailAdminStatsBucket[] {
  const map = new Map<string, MailAdminStatsBucket>();
  for (const event of events) {
    if (!isMailTemplateId(event.template_id) || !isKind(event.kind)) continue;
    const bucket = bucketMailOutboxStatEvent(event);
    if (!bucket) continue;
    const key = `${bucket.day}|${event.template_id}|${event.kind}|${bucket.status}`;
    const prev = map.get(key);
    if (prev) {
      prev.n += 1;
      continue;
    }
    map.set(key, {
      day: bucket.day,
      template_id: event.template_id,
      kind: event.kind,
      status: bucket.status,
      n: 1,
    });
  }
  return [...map.values()];
}

export function parseMailAdminStatsBuckets(raw: unknown): MailAdminStatsBucket[] {
  if (!Array.isArray(raw)) return [];
  const rows: MailAdminStatsBucket[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const day = typeof row.day === "string" ? row.day.slice(0, 10) : "";
    const templateId = typeof row.template_id === "string" ? row.template_id : "";
    const kind = typeof row.kind === "string" ? row.kind : "";
    const status = typeof row.status === "string" ? row.status : "";
    const n = asCount(row.n);
    if (!isIsoDate(day) || !isMailTemplateId(templateId) || !isKind(kind) || !isStatus(status) || n < 1) {
      continue;
    }
    rows.push({ day, template_id: templateId, kind, status, n });
  }
  return rows;
}

export function parseMailDailyBudget(raw: unknown): MailDailyBudgetSnapshot {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const day = typeof row.day === "string" ? row.day.slice(0, 10) : null;
  return {
    day: day && isIsoDate(day) ? day : null,
    sent: asCount(row.sent),
    queued: asCount(row.queued),
    remaining: asCount(row.remaining),
    cap: asCount(row.cap) || MAIL_DAILY_CAP,
  };
}

export function assembleMailAdminDailyStats(input: {
  from: string;
  to: string;
  today: string;
  rows: MailAdminStatsBucket[];
  budget: MailDailyBudgetSnapshot;
}): MailAdminDailyStatsResponse {
  const days = listCalendarDaysDesc(input.from, input.to);
  const budgetDay =
    input.budget.day && days.includes(input.budget.day) ? input.budget.day : input.today;
  const byDay = new Map<string, Map<string, MailAdminStatsTemplateRow>>();

  for (const row of input.rows) {
    if (!days.includes(row.day)) continue;
    let templates = byDay.get(row.day);
    if (!templates) {
      templates = new Map();
      byDay.set(row.day, templates);
    }
    const key = `${row.template_id}|${row.kind}`;
    const current = templates.get(key) || {
      template_id: row.template_id,
      kind: row.kind,
      sent: 0,
      skipped: 0,
      failed: 0,
    };
    current[row.status] += row.n;
    templates.set(key, current);
  }

  return {
    timezone: MAIL_ADMIN_STATS_TIMEZONE,
    from: input.from,
    to: input.to,
    cap: input.budget.cap || MAIL_DAILY_CAP,
    days: days.map((day) => {
      const templates = [...(byDay.get(day)?.values() || [])]
        .filter((row) => row.sent + row.skipped + row.failed > 0)
        .sort((a, b) => b.sent - a.sent || a.template_id.localeCompare(b.template_id));
      const isBudgetDay = day === budgetDay;
      return {
        day,
        sent: templates.reduce((sum, row) => sum + row.sent, 0),
        skipped: templates.reduce((sum, row) => sum + row.skipped, 0),
        failed: templates.reduce((sum, row) => sum + row.failed, 0),
        queued: isBudgetDay ? input.budget.queued : 0,
        remaining: isBudgetDay ? input.budget.remaining : null,
        by_template: templates,
      };
    }),
  };
}

export async function loadMailAdminDailyStats(input: {
  days: number;
  now?: Date;
  rpc: MailStatsRpc;
}): Promise<MailAdminDailyStatsResponse> {
  const window = mailAdminStatsWindow(input.days, input.now);
  const [rowsRes, budgetRes] = await Promise.all([
    input.rpc("landing_mail_admin_daily_stats", { p_from: window.from, p_to: window.to }),
    input.rpc("landing_mail_daily_budget"),
  ]);
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  if (budgetRes.error) throw new Error(budgetRes.error.message);
  return assembleMailAdminDailyStats({
    from: window.from,
    to: window.to,
    today: window.to,
    rows: parseMailAdminStatsBuckets(rowsRes.data),
    budget: parseMailDailyBudget(budgetRes.data),
  });
}
