import { sanitizeOverlaySlug } from "@/lib/auth-return-screen";

/**
 * SSOT for the card that must stay open after OAuth.
 * Blocks neighbor slug mutation. Snap neighbors attach only after the current
 * slide is centered (`useMobileCardSnapFeed.neighborsAttached`); the pin is
 * released after that attach, not when the slug merely matches.
 */
let pinnedSlug: string | null = null;

export function pinAuthReturnCard(slug: string): string | null {
  const safe = sanitizeOverlaySlug(slug);
  pinnedSlug = safe;
  return pinnedSlug;
}

export function peekAuthReturnCardPin(): string | null {
  return pinnedSlug;
}

export function isAuthReturnCardPinned(): boolean {
  return pinnedSlug !== null;
}

export function releaseAuthReturnCardPin(): void {
  pinnedSlug = null;
}

export function resetAuthReturnCardPinForTests(): void {
  pinnedSlug = null;
}

/** Neighbor swipe / replace is allowed only when there is no pin, or it is a revert to the pin. */
export function canMutateAuthReturnCardSlug(nextSlug: string): boolean {
  if (pinnedSlug === null) return true;
  return nextSlug === pinnedSlug;
}

/** Restorer/open always lands on the pin while it is active. */
export function resolveAuthReturnCardOpenSlug(requestedSlug: string): string {
  return pinnedSlug ?? requestedSlug;
}

export function shouldRenderMobileCardSnapNeighbors(pinned: boolean): boolean {
  return !pinned;
}
