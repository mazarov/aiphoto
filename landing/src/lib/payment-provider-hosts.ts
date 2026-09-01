function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

function isExactOrSubdomain(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`);
}

/** Hosted YooKassa / YooMoney checkout, including the legacy money.yandex.ru wallet. */
export function isYooKassaCheckoutHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  return (
    isExactOrSubdomain(h, "yoomoney.ru") ||
    isExactOrSubdomain(h, "yookassa.ru") ||
    isExactOrSubdomain(h, "money.yandex.ru")
  );
}

export function isRobokassaCheckoutHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  return isExactOrSubdomain(h, "robokassa.ru");
}

export function isPaymentProviderHost(host: string): boolean {
  return isYooKassaCheckoutHost(host) || isRobokassaCheckoutHost(host);
}
