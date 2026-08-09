import {
  parseYooKassaPayment,
  type YooKassaPayment,
} from "@/lib/yookassa-core";
import type { PricingPlan } from "@/lib/pricing-plans";

const YOOKASSA_API_ORIGIN = "https://api.yookassa.ru/v3";

function getCredentials(): { shopId: string; secretKey: string } {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secretKey) {
    throw new Error("YooKassa is not configured");
  }
  return { shopId, secretKey };
}

async function requestYooKassa(
  path: string,
  init?: RequestInit,
): Promise<YooKassaPayment> {
  const { shopId, secretKey } = getCredentials();
  const authorization = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Basic ${authorization}`);
  const response = await fetch(`${YOOKASSA_API_ORIGIN}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const providerType =
      payload &&
      typeof payload === "object" &&
      "type" in payload &&
      typeof payload.type === "string"
        ? payload.type
        : "api_error";
    throw new Error(`YooKassa request failed (${response.status}, ${providerType})`);
  }
  return parseYooKassaPayment(payload);
}

export function createYooKassaPayment(input: {
  localPaymentId: string;
  idempotencyKey: string;
  plan: PricingPlan;
  returnUrl: string;
}): Promise<YooKassaPayment> {
  return requestYooKassa("/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      amount: {
        value: input.plan.price.toFixed(2),
        currency: "RUB",
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      description: `PromptShot: пакет «${input.plan.name}»`,
      metadata: {
        local_payment_id: input.localPaymentId,
        plan_id: input.plan.id,
      },
    }),
  });
}

export function getYooKassaPayment(paymentId: string): Promise<YooKassaPayment> {
  return requestYooKassa(`/payments/${encodeURIComponent(paymentId)}`);
}
