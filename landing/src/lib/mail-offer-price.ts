export function applyMailOfferPercent(priceRub: number, percent: number): number {
  if (!Number.isFinite(priceRub) || priceRub <= 0) return priceRub;
  const safePercent = Math.min(90, Math.max(0, Math.floor(percent)));
  return Math.floor((priceRub * (100 - safePercent)) / 100);
}
