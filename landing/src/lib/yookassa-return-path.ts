import { sanitizeAuthReturnPath } from "./auth-return-path";

export const PRICING_RETURN_PATH_KEY = "promptshot:pricing-return-path";
export const DEFAULT_YOOKASSA_RETURN_PATH = "/pricing";

const PAYMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBlockedReturnPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

/** Same-origin relative path for YooKassa return. Overlay `/pricing` is not an origin. */
export function sanitizeYooKassaReturnPath(
  raw: string | null | undefined,
): string {
  const trimmed = raw?.trim() ?? "";
  const looksRelative =
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("://");
  if (!looksRelative) return DEFAULT_YOOKASSA_RETURN_PATH;
  const safe = sanitizeAuthReturnPath(trimmed);
  if (!safe || isBlockedReturnPath(safe)) return DEFAULT_YOOKASSA_RETURN_PATH;
  try {
    const url = new URL(safe, "https://promptshot.local");
    url.searchParams.delete("payment");
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return DEFAULT_YOOKASSA_RETURN_PATH;
  }
}

export function isYooKassaPaymentId(value: string | null | undefined): boolean {
  return Boolean(value && PAYMENT_ID_PATTERN.test(value));
}

export function buildYooKassaReturnUrl(input: {
  siteUrl: string;
  localPaymentId: string;
  returnPath?: string | null;
  preserveTestAccess: boolean;
}): string {
  if (!isYooKassaPaymentId(input.localPaymentId)) {
    throw new Error("Invalid local payment id for return URL");
  }
  const path = sanitizeYooKassaReturnPath(
    input.returnPath || DEFAULT_YOOKASSA_RETURN_PATH,
  );
  const url = new URL(path, input.siteUrl);
  if (input.preserveTestAccess) {
    url.searchParams.set("test", "true");
  }
  url.searchParams.set("payment", input.localPaymentId);
  return url.toString();
}

export function savePricingReturnPath(path: string): void {
  try {
    sessionStorage.setItem(
      PRICING_RETURN_PATH_KEY,
      sanitizeYooKassaReturnPath(path),
    );
  } catch {
    // Private mode / blocked storage — checkout still returns to /pricing.
  }
}

export function readPricingReturnPath(): string {
  try {
    const stored = sessionStorage.getItem(PRICING_RETURN_PATH_KEY);
    if (stored) return sanitizeYooKassaReturnPath(stored);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    return sanitizeYooKassaReturnPath(
      window.location.pathname + window.location.search,
    );
  }
  return DEFAULT_YOOKASSA_RETURN_PATH;
}

export function clearPricingReturnPath(): void {
  try {
    sessionStorage.removeItem(PRICING_RETURN_PATH_KEY);
  } catch {
    // ignore
  }
}
