import {
  encodeAdminGenerationCursor,
  parseAdminGenerationCursor,
  parseAdminGenerationLimit,
} from "@/lib/admin-generation-queue";
import type { PricingPaywallVariant } from "@/lib/pricing-paywall-attribution";

export type AdminPaymentStatus = "all" | "created" | "pending" | "succeeded" | "canceled";
export type AdminPaymentTestFilter = "all" | "live" | "test";

export type AdminPaymentRow = {
  id: string;
  provider: "yookassa" | "robokassa";
  provider_payment_id: string | null;
  created_at: string;
  updated_at: string;
  auth_user_id: string;
  landing_user_id: string;
  payer_email: string | null;
  payer_display_name: string | null;
  payer_provider: string | null;
  plan_id: string;
  credits: number;
  amount_rub: number | string;
  status: Exclude<AdminPaymentStatus, "all">;
  provider_status: string | null;
  test: boolean | null;
  paywall_variant: PricingPaywallVariant | null;
  visitor_id: string | null;
  session_id: string | null;
  yclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_landing_path: string | null;
  credited_at: string | null;
};

export const encodeAdminPaymentCursor = encodeAdminGenerationCursor;
export const parseAdminPaymentCursor = parseAdminGenerationCursor;
export const parseAdminPaymentLimit = parseAdminGenerationLimit;

export function parseAdminPaymentStatus(raw: string | null): AdminPaymentStatus | null {
  const value = (raw || "all").toLowerCase();
  return value === "all" || value === "created" || value === "pending"
    || value === "succeeded" || value === "canceled"
    ? value
    : null;
}

export function parseAdminPaymentTestFilter(raw: string | null): AdminPaymentTestFilter | null {
  const value = (raw || "all").toLowerCase();
  return value === "all" || value === "live" || value === "test" ? value : null;
}

export function paymentTestFilterToRpc(value: AdminPaymentTestFilter): boolean | null {
  if (value === "live") return false;
  if (value === "test") return true;
  return null;
}

export function parseAdminPaymentAttributionFilter(raw: string | null): string | null {
  const value = (raw || "").trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return value ? value.slice(0, 64) : null;
}

export function formatPaymentTrafficSource(
  row: Pick<
    AdminPaymentRow,
    "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_landing_path"
  >,
): {
  primary: string;
  campaign: string | null;
  landingPath: string | null;
  isDirect: boolean;
} {
  const source = row.utm_source?.trim() || "";
  const medium = row.utm_medium?.trim() || "";
  const normalizedSource = source.toLowerCase() === "ya" ? "yandex" : source.toLowerCase();
  const primary = source
    ? `${source}${medium ? ` / ${medium}` : ""}`
    : "Не указан";
  const campaignParts = [row.utm_campaign, row.utm_content]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return {
    primary,
    campaign: campaignParts.length ? campaignParts.join(" · ") : null,
    landingPath: row.utm_landing_path?.trim() || null,
    isDirect: normalizedSource === "yandex" && medium.toLowerCase() === "cpc",
  };
}

export type AdminPaymentCreditState =
  | "credited"
  | "not_due"
  | "discrepancy"
  | "stale";

export const ADMIN_PAYMENT_STALE_MINUTES = 15;

export function resolvePaymentCreditState(
  row: Pick<AdminPaymentRow, "status" | "credited_at" | "created_at">,
  nowMs: number = Date.now(),
): AdminPaymentCreditState {
  if (row.credited_at) return "credited";
  if (row.status === "succeeded") return "discrepancy";
  if (
    (row.status === "created" || row.status === "pending") &&
    Number.isFinite(Date.parse(row.created_at)) &&
    nowMs - Date.parse(row.created_at) >= ADMIN_PAYMENT_STALE_MINUTES * 60_000
  ) {
    return "stale";
  }
  return "not_due";
}
