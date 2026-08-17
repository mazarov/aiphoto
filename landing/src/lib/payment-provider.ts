export type PaymentProvider = "yookassa" | "robokassa";

export function getPaymentProvider(): PaymentProvider {
  const value = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || "yookassa";
  if (value !== "yookassa" && value !== "robokassa") {
    throw new Error(`Unsupported PAYMENT_PROVIDER: ${value}`);
  }
  return value;
}

function getRobokassaCanaryEmails(): Set<string> {
  return new Set(
    (process.env.ROBOKASSA_CANARY_EMAILS || "")
      .split(/[,;\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getPaymentProviderForEmail(
  email: string | null | undefined,
): PaymentProvider {
  const provider = getPaymentProvider();
  if (provider === "robokassa") return provider;
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedEmail && getRobokassaCanaryEmails().has(normalizedEmail)
    ? "robokassa"
    : provider;
}
