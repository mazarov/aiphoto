/** Duck type: Supabase `User` and test stubs. */
export type PromptshotAuthIdentity = { is_anonymous?: boolean };

/** Supabase user as the landing chrome sees it. */
export type PromptshotAuthUser = PromptshotAuthIdentity | null | undefined;

/**
 * Signed-in PromptShot account — not missing, not a Supabase anonymous session.
 * Type predicate: after `if (!isPromptshotAuthed(user)) return`, `user` is `T`.
 */
export function isPromptshotAuthed<T extends PromptshotAuthIdentity>(
  user: T | null | undefined,
): user is T {
  return Boolean(user && user.is_anonymous !== true);
}

/**
 * Pay / price chrome: header split-pill («баланс +»), sidebar «Пополнить»,
 * «Купить кредиты», ✦ cost on compose CTAs.
 * Guests do not get that chrome. Public `/pricing` stays; guest header
 * trailing slot is «Тарифы» (`listingHeaderTrailingKind`).
 */
export function canShowPayChrome<T extends PromptshotAuthIdentity>(
  user: T | null | undefined,
): user is T {
  return isPromptshotAuthed(user);
}

export type ListingHeaderTrailingKind = "balance" | "tariffs";

/** Mobile header slot after search: authed → balance chip, guest → «Тарифы». */
export function listingHeaderTrailingKind(
  user: PromptshotAuthUser,
): ListingHeaderTrailingKind {
  return canShowPayChrome(user) ? "balance" : "tariffs";
}
