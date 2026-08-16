import { parseAdminGenerationLimit } from "./admin-generation-queue";

export type AdminCreditLiabilityRow = {
  landing_user_id: string;
  email: string | null;
  display_name: string | null;
  provider: string | null;
  credits: number;
  granted_total: number;
  spent_total: number;
  updated_at: string;
};

export type AdminCreditFlowRow = {
  day: string;
  granted: number;
  spent: number;
  refunded: number;
};

export type CreditSeriesDay = AdminCreditFlowRow & { remaining: number };

export type AdminCreditLiabilitySummary = {
  users_with_credits: number;
  credits_total: number;
  blended_rub_per_credit: number | null;
  liability_rub_estimate: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseAdminCreditLimit = parseAdminGenerationLimit;

const CREDIT_DAYS = new Set([1, 7, 30, 90]);

export function parseAdminCreditDays(raw: string | null): number {
  const value = Number(raw || 30);
  return CREDIT_DAYS.has(value) ? value : 30;
}

export function parseAdminCreditSearch(raw: string | null): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  return value.slice(0, 80);
}

export function reconstructCreditRemaining(
  liveRemaining: number,
  flow: AdminCreditFlowRow[],
): CreditSeriesDay[] {
  const sorted = [...flow].sort((left, right) => left.day.localeCompare(right.day));
  const remaining: number[] = new Array(sorted.length);
  let current = Math.max(0, Math.round(liveRemaining));
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    remaining[index] = current;
    const row = sorted[index];
    current = current - row.granted - row.refunded + row.spent;
  }
  return sorted.map((row, index) => ({ ...row, remaining: remaining[index] ?? 0 }));
}

export function encodeAdminCreditCursor(credits: number, id: string): string {
  return `${credits}|${id}`;
}

export function parseAdminCreditCursor(raw: string | null): { credits: number; id: string } | null {
  if (!raw) return null;
  const separator = raw.indexOf("|");
  if (separator <= 0 || separator !== raw.lastIndexOf("|")) return null;
  const credits = Number(raw.slice(0, separator));
  const id = raw.slice(separator + 1).trim();
  if (!Number.isInteger(credits) || credits < 0 || !UUID_RE.test(id)) return null;
  return { credits, id };
}
