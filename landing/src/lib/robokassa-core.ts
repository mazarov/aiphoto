import { createHash, timingSafeEqual } from "node:crypto";
import type { PricingPlan } from "@/lib/pricing-plans";

export type RobokassaHashAlgorithm = "md5" | "sha256" | "sha512";

export type RobokassaConfig = {
  merchantLogin: string;
  password1: string;
  password2: string;
  hashAlgorithm: RobokassaHashAlgorithm;
  testMode: boolean;
  receiptTax: string;
};

export type RobokassaCheckoutPayload = {
  MerchantLogin: string;
  OutSum: string;
  InvId: number;
  Description: string;
  Culture: "ru";
  Encoding: "utf-8";
  IsTest: 0 | 1;
  Receipt: string;
  Shp_payment_id: string;
  Settings: string;
  SignatureValue: string;
};

export type RobokassaResult = {
  outSum: string;
  invoiceId: number;
  signature: string;
  paymentId: string;
  paymentMethod: string;
  shp: Array<[string, string]>;
};

const SUPPORTED_HASHES = new Set<RobokassaHashAlgorithm>(["md5", "sha256", "sha512"]);

export function getRobokassaConfig(): RobokassaConfig {
  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN?.trim();
  const testMode = process.env.ROBOKASSA_TEST_MODE?.trim() === "1";
  const password1 = (
    testMode
      ? process.env.ROBOKASSA_TEST_PASSWORD_1
      : process.env.ROBOKASSA_PASSWORD_1
  )?.trim();
  const password2 = (
    testMode
      ? process.env.ROBOKASSA_TEST_PASSWORD_2
      : process.env.ROBOKASSA_PASSWORD_2
  )?.trim();
  const rawAlgorithm = process.env.ROBOKASSA_HASH_ALGORITHM?.trim().toLowerCase() || "sha256";
  if (!merchantLogin || !password1 || !password2) {
    throw new Error("Robokassa is not configured");
  }
  if (!SUPPORTED_HASHES.has(rawAlgorithm as RobokassaHashAlgorithm)) {
    throw new Error("Unsupported ROBOKASSA_HASH_ALGORITHM");
  }
  return {
    merchantLogin,
    password1,
    password2,
    hashAlgorithm: rawAlgorithm as RobokassaHashAlgorithm,
    testMode,
    receiptTax: process.env.ROBOKASSA_RECEIPT_TAX?.trim() || "none",
  };
}

export function formatRobokassaAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid Robokassa amount");
  return value.toFixed(2);
}

export function hashRobokassaSignature(
  source: string,
  algorithm: RobokassaHashAlgorithm,
): string {
  return createHash(algorithm).update(source, "utf8").digest("hex");
}

function sortShp(shp: Array<[string, string]>): Array<[string, string]> {
  return [...shp].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function appendShp(parts: string[], shp: Array<[string, string]>): string[] {
  return [...parts, ...sortShp(shp).map(([key, value]) => `${key}=${value}`)];
}

export function buildRobokassaReceipt(plan: PricingPlan, tax: string): string {
  const receipt = JSON.stringify({
    items: [
      {
        name: `Пакет токенов PromptShot «${plan.name}»`,
        quantity: 1,
        sum: Number(formatRobokassaAmount(plan.price)),
        tax,
        payment_method: "full_payment",
        payment_object: "service",
      },
    ],
  });
  return encodeURIComponent(receipt);
}

export function buildRobokassaCheckoutPayload(input: {
  paymentId: string;
  invoiceId: number;
  plan: PricingPlan;
  config?: RobokassaConfig;
}): RobokassaCheckoutPayload {
  const config = input.config ?? getRobokassaConfig();
  const outSum = formatRobokassaAmount(input.plan.price);
  const receipt = buildRobokassaReceipt(input.plan, config.receiptTax);
  const shp: Array<[string, string]> = [["Shp_payment_id", input.paymentId]];
  const signatureSource = appendShp(
    [
      config.merchantLogin,
      outSum,
      String(input.invoiceId),
      receipt,
      config.password1,
    ],
    shp,
  ).join(":");

  return {
    MerchantLogin: config.merchantLogin,
    OutSum: outSum,
    InvId: input.invoiceId,
    Description: `PromptShot: пакет «${input.plan.name}»`,
    Culture: "ru",
    Encoding: "utf-8",
    IsTest: config.testMode ? 1 : 0,
    Receipt: receipt,
    Shp_payment_id: input.paymentId,
    Settings: JSON.stringify({ Mode: "modal" }),
    SignatureValue: hashRobokassaSignature(signatureSource, config.hashAlgorithm),
  };
}

function getParam(params: URLSearchParams, wanted: string): string {
  const match = [...params.entries()].find(([key]) => key.toLowerCase() === wanted.toLowerCase());
  return match?.[1]?.trim() || "";
}

export function parseRobokassaResult(params: URLSearchParams): RobokassaResult {
  const outSum = getParam(params, "OutSum");
  const rawInvoiceId = getParam(params, "InvId");
  const signature = getParam(params, "SignatureValue");
  const paymentId = getParam(params, "Shp_payment_id");
  const invoiceId = Number(rawInvoiceId);
  if (
    !outSum ||
    !signature ||
    !paymentId ||
    !Number.isSafeInteger(invoiceId) ||
    invoiceId <= 0
  ) {
    throw new Error("Invalid Robokassa result");
  }
  const shp = [...params.entries()]
    .filter(([key]) => key.toLowerCase().startsWith("shp_"))
    .map(([key, value]) => [key, value] as [string, string]);
  return {
    outSum,
    invoiceId,
    signature,
    paymentId,
    paymentMethod: getParam(params, "PaymentMethod"),
    shp,
  };
}

export function verifyRobokassaResult(
  result: RobokassaResult,
  config: RobokassaConfig = getRobokassaConfig(),
): boolean {
  const source = appendShp(
    [result.outSum, String(result.invoiceId), config.password2],
    result.shp,
  ).join(":");
  const expected = hashRobokassaSignature(source, config.hashAlgorithm);
  const received = result.signature.toLowerCase();
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

export function robokassaAmountsEqual(received: string, expected: number): boolean {
  const value = Number(received);
  return Number.isFinite(value) && Math.round(value * 100) === Math.round(expected * 100);
}
