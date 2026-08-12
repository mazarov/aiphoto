import {
  encodeAdminGenerationCursor,
  parseAdminGenerationCursor,
  parseAdminGenerationLimit,
} from "@/lib/admin-generation-queue";

export type AdminPaymentStatus = "all" | "created" | "pending" | "succeeded" | "canceled";
export type AdminPaymentTestFilter = "all" | "live" | "test";

export type AdminPaymentRow = {
  id: string;
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
  credited_at: string | null;
  yookassa_payment_id: string | null;
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
