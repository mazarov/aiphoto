/** Supabase user as the landing chrome sees it. */
export type PromptshotAuthUser = { is_anonymous?: boolean } | null | undefined;

/** Signed-in PromptShot account — not missing, not a Supabase anonymous session. */
export function isPromptshotAuthed(user: PromptshotAuthUser): boolean {
  return Boolean(user && user.is_anonymous !== true);
}

/**
 * Pay / price chrome: header split-pill («баланс +»), sidebar «Пополнить»,
 * «Купить кредиты», ✦ cost on compose CTAs.
 * Guests do not get that chrome. Public `/pricing` stays; guest header
 * trailing slot is «Тарифы» (`listingHeaderTrailingKind`).
 */
export function canShowPayChrome(user: PromptshotAuthUser): boolean {
  return isPromptshotAuthed(user);
}

export type ListingHeaderTrailingKind = "balance" | "tariffs";

/** Mobile header slot after search: authed → balance chip, guest → «Тарифы». */
export function listingHeaderTrailingKind(
  user: PromptshotAuthUser,
): ListingHeaderTrailingKind {
  return canShowPayChrome(user) ? "balance" : "tariffs";
}
