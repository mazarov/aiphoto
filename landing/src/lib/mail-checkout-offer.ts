import { applyMailOfferPercent } from "@/lib/mail-offer-price";
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
      | {
          amount_rub?: unknown;
          quoted_amount_rub?: unknown;
          offer_id?: unknown;
          quoted_offer_id?: unknown;
          percent?: unknown;
          quoted_percent?: unknown;
        }
      | null;
    const amountRub = Number(row?.quoted_amount_rub ?? row?.amount_rub);
    const offerId =
      typeof row?.quoted_offer_id === "string"
        ? row.quoted_offer_id
        : typeof row?.offer_id === "string"
          ? row.offer_id
          : null;
    return {
      amountRub: Number.isFinite(amountRub) && amountRub > 0 ? amountRub : input.catalogAmount,
      offerId,
      percent: Number(row?.quoted_percent ?? row?.percent ?? 0) || 0,
    };
  } catch (error) {
    console.warn("[mail] checkout offer skipped", {
      paymentId: input.paymentId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { amountRub: input.catalogAmount, offerId: null, percent: 0 };
  }
}

type PaymentQuoteRow = { amount_rub?: unknown; offer_id?: unknown };

type PaymentQuoteResult = {
  data: PaymentQuoteRow | null;
  error: { message: string } | null;
};

/**
 * Narrow reader for `amount_rub` after apply. Do not put SupabaseClient in the
 * public signature: its QueryBuilder generics recurse and fail `next build`.
 */
function paymentQuoteReader(supabase: MailRpcClient): {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<PaymentQuoteResult>;
      };
    };
  };
} {
  return supabase as never;
}

export class CheckoutOfferNotAppliedError extends Error {
  readonly expectedAmount: number;
  readonly actualAmount: number;

  constructor(expectedAmount: number, actualAmount: number) {
    super(
      `checkout offer not applied: expected ${expectedAmount} got ${actualAmount}`,
    );
    this.name = "CheckoutOfferNotAppliedError";
    this.expectedAmount = expectedAmount;
    this.actualAmount = actualAmount;
  }
}

export function quoteFromPaymentRow(
  row: { amount_rub?: unknown; offer_id?: unknown } | null,
): { amountRub: number | null; offerId: string | null } {
  const amountRub = Number(row?.amount_rub);
  return {
    amountRub: Number.isFinite(amountRub) && amountRub > 0 ? amountRub : null,
    offerId: typeof row?.offer_id === "string" ? row.offer_id : null,
  };
}

export function resolveCheckoutCharge(input: {
  catalogAmount: number;
  planId: string;
  persistedAmount: number | null;
  persistedOfferId: string | null;
  liveOffer: LivePricingOffer | null;
  rpcQuote: CheckoutOfferQuote;
}): CheckoutOfferQuote {
  const persisted =
    input.persistedAmount != null && input.persistedAmount > 0
      ? input.persistedAmount
      : null;
  const charged = persisted ?? input.rpcQuote.amountRub;
  const expectedPercent = pricingOfferPercentForPlan(input.liveOffer, input.planId);
  if (expectedPercent != null) {
    const expectedAmount = applyMailOfferPercent(
      input.catalogAmount,
      expectedPercent,
    );
    if (charged !== expectedAmount) {
      throw new CheckoutOfferNotAppliedError(expectedAmount, charged);
    }
    return {
      amountRub: expectedAmount,
      offerId: input.persistedOfferId ?? input.liveOffer?.offerId ?? null,
      percent: expectedPercent,
    };
  }
  return {
    amountRub: charged,
    offerId: input.persistedOfferId ?? input.rpcQuote.offerId,
    percent: input.rpcQuote.percent,
  };
}

const CHECKOUT_PAYMENT_TABLE = {
  yookassa: "landing_yookassa_payments",
  robokassa: "landing_robokassa_payments",
} as const;

export async function readPersistedCheckoutQuote(
  supabase: MailRpcClient,
  input: { provider: "yookassa" | "robokassa"; paymentId: string },
): Promise<{ amountRub: number | null; offerId: string | null }> {
  const { data, error } = await paymentQuoteReader(supabase)
    .from(CHECKOUT_PAYMENT_TABLE[input.provider])
    .select("amount_rub, offer_id")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (error) {
    throw new Error(`Payment quote reread failed: ${error.message}`);
  }
  return quoteFromPaymentRow(data);
}

export async function lockCheckoutCharge(
  supabase: MailRpcClient,
  input: {
    sharedUserId: string;
    paymentId: string;
    provider: "yookassa" | "robokassa";
    catalogAmount: number;
    planId: string;
  },
): Promise<CheckoutOfferQuote> {
  const rpcQuote = await applyCheckoutOffer(supabase, input);
  const persisted = await readPersistedCheckoutQuote(supabase, input);
  let liveOffer: LivePricingOffer | null = null;
  try {
    const { data, error } = await supabase.rpc("landing_live_pricing_offer", {
      p_shared_user_id: input.sharedUserId,
    });
    if (error) throw new Error(error.message);
    liveOffer = parseLiveMailOffer(data);
  } catch (error) {
    console.warn("[mail] live checkout offer lookup skipped", {
      paymentId: input.paymentId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return resolveCheckoutCharge({
    catalogAmount: input.catalogAmount,
    planId: input.planId,
    persistedAmount: persisted.amountRub,
    persistedOfferId: persisted.offerId,
    liveOffer,
    rpcQuote,
  });
}

export type LivePricingOffer = {
  offerId: string;
  percent: number;
  expiresAt: string;
  targetPlanId: string | null;
  sourceTemplateId: string | null;
  showNudge: boolean;
};

export function pricingOfferPercentForPlan(
  offer: LivePricingOffer | null,
  planId: string,
): number | null {
  if (!offer) return null;
  return offer.targetPlanId === null || offer.targetPlanId === planId
    ? offer.percent
    : null;
}

export function parseLiveMailOffer(raw: unknown): LivePricingOffer | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const data = row as {
    offer_id?: unknown;
    percent?: unknown;
    expires_at?: unknown;
    target_plan_id?: unknown;
    source_template_id?: unknown;
    show_nudge?: unknown;
  };
  const offerId = typeof data.offer_id === "string" ? data.offer_id : "";
  const percent = Number(data.percent);
  const expiresAt = typeof data.expires_at === "string" ? data.expires_at : "";
  if (
    !offerId ||
    (percent !== 10 && percent !== 20 && percent !== 25) ||
    !expiresAt
  ) {
    return null;
  }
  if (Date.parse(expiresAt) <= Date.now()) return null;
  return {
    offerId,
    percent,
    expiresAt,
    targetPlanId:
      typeof data.target_plan_id === "string" ? data.target_plan_id : null,
    sourceTemplateId:
      typeof data.source_template_id === "string"
        ? data.source_template_id
        : null,
    showNudge: data.show_nudge === true,
  };
}
