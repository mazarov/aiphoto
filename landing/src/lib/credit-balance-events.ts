export const CREDIT_BALANCE_REFRESH_EVENT = "promptshot:credit-balance-refresh";

export function requestCreditBalanceRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDIT_BALANCE_REFRESH_EVENT));
}
