import { parseAdminGenerationLimit } from "./admin-generation-queue";

export type AdminCreditLiabilityRow = {
  landing_user_id: string;
  email: string | null;
  display_name: string | null;
  provider: string | null;
  credits: number;
  updated_at: string;
};

export type AdminCreditLiabilitySummary = {
  users_with_credits: number;
  credits_total: number;
  blended_rub_per_credit: number | null;
  liability_rub_estimate: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseAdminCreditLimit = parseAdminGenerationLimit;

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
