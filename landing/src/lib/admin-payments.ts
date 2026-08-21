import {
  encodeAdminGenerationCursor,
  parseAdminGenerationCursor,
  parseAdminGenerationLimit,
} from "@/lib/admin-generation-queue";
import type { PricingPaywallVariant } from "@/lib/pricing-paywall-attribution";

export type AdminPaymentStatus = "all" | "created" | "pending" | "succeeded" | "canceled";
export type AdminPaymentTestFilter = "all" | "live" | "test";
export type AdminPaymentCreditState =
  | "credited"
  | "not_due"
  | "discrepancy"
  | "stale";

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

export type AdminPaymentItem = {
  id: string;
  provider: "yookassa" | "robokassa";
  providerPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  authUserId: string;
  landingUserId: string;
  identityMismatch: boolean;
  payerEmail: string | null;
  payerDisplayName: string | null;
  payerProvider: string | null;
  planId: string;
  amountRub: number;
  credits: number;
  status: Exclude<AdminPaymentStatus, "all">;
  providerStatus: string | null;
  test: boolean | null;
  paywallVariant: PricingPaywallVariant | null;
  visitorId: string | null;
  sessionId: string | null;
  yclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  utmLandingPath: string | null;
  creditedAt: string | null;
  creditState: AdminPaymentCreditState;
};

export const encodeAdminPaymentCursor = encodeAdminGenerationCursor;
export const parseAdminPaymentCursor = parseAdminGenerationCursor;
export const parseAdminPaymentLimit = parseAdminGenerationLimit;
export const ADMIN_PAYMENT_CSV_MAX_ROWS = 10_000;
export const ADMIN_PAYMENT_CSV_PAGE_SIZE = 100;
export const ADMIN_PAYMENT_CSV_SEPARATOR = ";";
export const ADMIN_PAYMENT_CSV_BOM = "\uFEFF";
export const ADMIN_PAYMENT_CSV_COLUMNS = [
  "created_at",
  "payer_email",
  "payer_name",
  "payer_provider",
  "auth_user_id",
  "landing_user_id",
  "identity_mismatch",
  "plan_id",
  "paywall_variant",
  "amount_rub",
  "credits",
  "test",
  "status",
  "provider",
  "provider_status",
  "provider_payment_id",
  "credit_state",
  "credited_at",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_landing_path",
  "yclid",
  "visitor_id",
  "session_id",
  "id",
] as const;

export function parseAdminPaymentFormat(raw: string | null): "json" | "csv" | null {
  const value = (raw || "json").toLowerCase();
  return value === "json" || value === "csv" ? value : null;
}

export function toAdminPaymentItem(
  row: AdminPaymentRow,
  nowMs: number = Date.now(),
): AdminPaymentItem {
  return {
    id: row.id,
    provider: row.provider === "robokassa" ? "robokassa" : "yookassa",
    providerPaymentId: row.provider_payment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authUserId: row.auth_user_id,
    landingUserId: row.landing_user_id,
    identityMismatch: row.auth_user_id !== row.landing_user_id,
    payerEmail: row.payer_email,
    payerDisplayName: row.payer_display_name,
    payerProvider: row.payer_provider,
    planId: row.plan_id,
    amountRub: Number(row.amount_rub),
    credits: row.credits,
    status: row.status,
    providerStatus: row.provider_status,
    test: row.test,
    paywallVariant: row.paywall_variant,
    visitorId: row.visitor_id,
    sessionId: row.session_id,
    yclid: row.yclid,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmContent: row.utm_content,
    utmTerm: row.utm_term,
    utmLandingPath: row.utm_landing_path,
    creditedAt: row.credited_at,
    creditState: resolvePaymentCreditState(row, nowMs),
  };
}

export function escapeAdminPaymentCsvCell(
  value: string | number | boolean | null | undefined,
): string {
  let raw = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(raw)) raw = `'${raw}`;
  if (/[;"\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function adminPaymentCsvValues(item: AdminPaymentItem): string[] {
  const source = formatPaymentTrafficSource({
    utm_source: item.utmSource,
    utm_medium: item.utmMedium,
    utm_campaign: item.utmCampaign,
    utm_content: item.utmContent,
    utm_landing_path: item.utmLandingPath,
  });
  return [
    item.createdAt,
    item.payerEmail ?? "",
    item.payerDisplayName ?? "",
    item.payerProvider ?? "",
    item.authUserId,
    item.landingUserId,
    item.identityMismatch ? "true" : "false",
    item.planId,
    item.paywallVariant ?? "",
    String(item.amountRub),
    String(item.credits),
    item.test === null ? "" : item.test ? "true" : "false",
    item.status,
    item.provider,
    item.providerStatus ?? "",
    item.providerPaymentId ?? "",
    item.creditState,
    item.creditedAt ?? "",
    source.primary,
    item.utmSource ?? "",
    item.utmMedium ?? "",
    item.utmCampaign ?? "",
    item.utmContent ?? "",
    item.utmTerm ?? "",
    item.utmLandingPath ?? "",
    item.yclid ?? "",
    item.visitorId ?? "",
    item.sessionId ?? "",
    item.id,
  ];
}

export function serializeAdminPaymentsCsv(items: AdminPaymentItem[]): string {
  const lines = [
    ADMIN_PAYMENT_CSV_COLUMNS.join(ADMIN_PAYMENT_CSV_SEPARATOR),
    ...items.map((item) => adminPaymentCsvValues(item).map(escapeAdminPaymentCsvCell).join(ADMIN_PAYMENT_CSV_SEPARATOR)),
  ];
  return `${ADMIN_PAYMENT_CSV_BOM}${lines.join("\n")}\n`;
}

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
