const PRICING_PREVIEW_EMAIL = "azarov.maxim@gmail.com";

export function canAccessPricingPreview(email?: string | null): boolean {
  return email?.trim().toLowerCase() === PRICING_PREVIEW_EMAIL;
}
