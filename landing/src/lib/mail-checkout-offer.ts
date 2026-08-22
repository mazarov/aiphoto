import type { MailRpcClient } from "@/lib/mail-outbox";

export type CheckoutOfferQuote = {
  amountRub: number;
  offerId: string | null;
  percent: number;
};

export async function applyCheckoutOffer(
  supabase: MailRpcClient,
  input: {
    sharedUserId: string;
    paymentId: string;
    provider: "yookassa" | "robokassa";
    catalogAmount: number;
  },
): Promise<CheckoutOfferQuote> {
  try {
    const { data, error } = await supabase.rpc("landing_apply_checkout_offer", {
      p_shared_user_id: input.sharedUserId,
      p_payment_id: input.paymentId,
      p_provider: input.provider,
      p_catalog_amount: input.catalogAmount,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { amount_rub?: unknown; offer_id?: unknown; percent?: unknown }
      | null;
    const amountRub = Number(row?.amount_rub);
    return {
      amountRub: Number.isFinite(amountRub) && amountRub > 0 ? amountRub : input.catalogAmount,
      offerId: typeof row?.offer_id === "string" ? row.offer_id : null,
      percent: Number(row?.percent || 0) || 0,
    };
  } catch (error) {
    console.warn("[mail] checkout offer skipped", {
      paymentId: input.paymentId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { amountRub: input.catalogAmount, offerId: null, percent: 0 };
  }
}

export function parseLiveMailOffer(raw: unknown): { percent: number; expiresAt: string } | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const data = row as { percent?: unknown; expires_at?: unknown };
  const percent = Number(data.percent);
  const expiresAt = typeof data.expires_at === "string" ? data.expires_at : "";
  if ((percent !== 10 && percent !== 20) || !expiresAt) return null;
  if (Date.parse(expiresAt) <= Date.now()) return null;
  return { percent, expiresAt };
}
