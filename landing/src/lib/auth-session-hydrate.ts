/**
 * SSOT: which auth user the chrome should show after a return / restore.
 * getUser() is the JWT check; if it fails and cookies still have a session,
 * keep that user so a GoTrue blip does not look like a signed-out page.
 */
export function resolveHydratedAuthUser<T>(input: {
  sessionUser: T | null;
  verifiedUser: T | null;
  verifyFailed: boolean;
}): T | null {
  if (!input.verifyFailed) {
    return input.verifiedUser;
  }
  return input.sessionUser;
}

/** bfcache restore, or a leftover post-OAuth cookie on a frozen tree. */
export function shouldHydrateAuthOnPageShow(
  persisted: boolean,
  hasReturnCookie: boolean,
): boolean {
  return persisted || hasReturnCookie;
}

/**
 * Tab became visible and chrome still has no user. Skip when already authed
 * so listing focus does not stampede GoTrue.
 */
export function shouldHydrateAuthOnVisible(
  visibilityState: string,
  hasUser: boolean,
): boolean {
  return visibilityState === "visible" && !hasUser;
}
