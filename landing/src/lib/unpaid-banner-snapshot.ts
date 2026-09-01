import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLiveMailOffer } from "@/lib/mail-checkout-offer";
import {
  UNPAID_BANNER_TTL_MS,
  pickLatestUnpaidLedgerRow,
  type UnpaidBannerSnapshot,
  type UnpaidLedgerRow,
} from "@/lib/unpaid-checkout-banner";

type PaymentProviderStore = Pick<SupabaseClient, "from" | "rpc">;

type LedgerRecord = {
  id: string;
  landing_user_id: string;
  plan_id: string;
  credits: number | string;
  created_at: string;
  credited_at: string | null;
  status: string | null;
};

async function readLatestPayment(
  supabase: PaymentProviderStore,
  table: "landing_yookassa_payments" | "landing_robokassa_payments",
  authUserId: string,
): Promise<LedgerRecord | null> {
  const { data, error } = await supabase
    .from(table)
    .select("id, landing_user_id, plan_id, credits, created_at, credited_at, status")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`unpaid banner lookup failed: ${error.message}`);
  return (data as LedgerRecord | null) ?? null;
}

function toLedgerRow(
  provider: UnpaidLedgerRow["provider"],
  payment: LedgerRecord | null,
): (UnpaidLedgerRow & { landingUserId: string }) | null {
  if (!payment) return null;
  return {
    provider,
    paymentId: payment.id,
    planId: payment.plan_id,
    credits: Number(payment.credits),
    createdAt: payment.created_at,
    creditedAt: payment.credited_at,
    status: payment.status,
    landingUserId: payment.landing_user_id,
  };
}

export async function loadUnpaidBannerSnapshot(
  supabase: PaymentProviderStore,
  authUserId: string,
  nowMs = Date.now(),
): Promise<UnpaidBannerSnapshot | null> {
  const [yookassa, robokassa] = await Promise.all([
    readLatestPayment(supabase, "landing_yookassa_payments", authUserId),
    readLatestPayment(supabase, "landing_robokassa_payments", authUserId),
  ]);
  const yookassaRow = toLedgerRow("yookassa", yookassa);
  const robokassaRow = toLedgerRow("robokassa", robokassa);
  const picked = pickLatestUnpaidLedgerRow(
    [yookassaRow, robokassaRow],
    nowMs,
    UNPAID_BANNER_TTL_MS,
  );
  if (!picked) return null;

  const landingUserId =
    picked.provider === "robokassa"
      ? robokassaRow?.landingUserId
      : yookassaRow?.landingUserId;
  if (!landingUserId) return null;

  const { data: offerRow } = await supabase.rpc("landing_live_pricing_offer", {
    p_shared_user_id: landingUserId,
  });

  return {
    ...picked,
    offer: parseLiveMailOffer(offerRow),
  };
}
