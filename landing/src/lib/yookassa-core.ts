export type YooKassaPaymentStatus =
  | "pending"
  | "waiting_for_capture"
  | "succeeded"
  | "canceled";

export type YooKassaPayment = {
  id: string;
  status: YooKassaPaymentStatus;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  };
  metadata: Record<string, string>;
  test: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid YooKassa payment field: ${key}`);
  }
  return value;
}

export function parseYooKassaPayment(value: unknown): YooKassaPayment {
  if (!isRecord(value) || !isRecord(value.amount)) {
    throw new Error("Invalid YooKassa payment response");
  }

  const status = requiredString(value, "status");
  if (!["pending", "waiting_for_capture", "succeeded", "canceled"].includes(status)) {
    throw new Error(`Unsupported YooKassa payment status: ${status}`);
  }

  const metadata: Record<string, string> = {};
  if (isRecord(value.metadata)) {
    for (const [key, item] of Object.entries(value.metadata)) {
      if (typeof item === "string") metadata[key] = item;
    }
  }

  let confirmation: YooKassaPayment["confirmation"];
  if (isRecord(value.confirmation)) {
    confirmation = {
      type:
        typeof value.confirmation.type === "string"
          ? value.confirmation.type
          : undefined,
      confirmation_url:
        typeof value.confirmation.confirmation_url === "string"
          ? value.confirmation.confirmation_url
          : undefined,
    };
  }

  return {
    id: requiredString(value, "id"),
    status: status as YooKassaPaymentStatus,
    paid: value.paid === true,
    amount: {
      value: requiredString(value.amount, "value"),
      currency: requiredString(value.amount, "currency"),
    },
    confirmation,
    metadata,
    test: value.test === true,
  };
}

export function assertYooKassaPaymentMatches(
  payment: YooKassaPayment,
  expected: {
    localPaymentId: string;
    planId: string;
    priceRub: number;
  },
): void {
  if (payment.metadata.local_payment_id !== expected.localPaymentId) {
    throw new Error("YooKassa local payment metadata mismatch");
  }
  if (payment.metadata.plan_id !== expected.planId) {
    throw new Error("YooKassa plan metadata mismatch");
  }
  if (payment.amount.currency !== "RUB") {
    throw new Error("YooKassa payment currency mismatch");
  }
  if (payment.amount.value !== expected.priceRub.toFixed(2)) {
    throw new Error("YooKassa payment amount mismatch");
  }
}

export function getYooKassaReconciliationAction(
  payment: YooKassaPayment,
): "fulfill" | "cancel" | "wait" {
  if (payment.status === "succeeded") {
    if (!payment.paid) {
      throw new Error("YooKassa succeeded payment is not marked paid");
    }
    return "fulfill";
  }
  if (payment.status === "canceled") return "cancel";
  return "wait";
}
