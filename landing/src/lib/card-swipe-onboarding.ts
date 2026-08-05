/**
 * One-time mobile onboarding for vertical card swipe / ↑↓ listing nav on /p/[slug].
 * Stored in localStorage so returning users don't see the hint again.
 */

export const CARD_SWIPE_ONBOARDING_KEY = "promptshot_card_swipe_onboarding_v1";

export function hasSeenCardSwipeOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(CARD_SWIPE_ONBOARDING_KEY) === "1";
  } catch {
    return true; // private mode — don't show
  }
}

export function markCardSwipeOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CARD_SWIPE_ONBOARDING_KEY, "1");
  } catch {
    /* quota / private mode */
  }
}
