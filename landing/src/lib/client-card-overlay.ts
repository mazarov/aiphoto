import { sanitizeOverlaySlug } from "@/lib/auth-return-screen";

/**
 * Synchronous owner of the in-app card overlay (`ClientCardModal`).
 *
 * Next 15 syncs `history.pushState('/p/slug')` into the App Router. That rematches
 * `@modal/(.)p/[slug]` and can also replace `children` with `/p/[slug]`. Those
 * routes mount a second `CardPageClient` without `onListingNeighborGo`, which
 * `router.replace`s a snap neighbor and looks like “the card next to the one I opened”.
 *
 * React state is too late: set the flag before `pushState`, then those routes render nothing.
 */
let activeSlug: string | null = null;
const listeners = new Set<() => void>();

function notifyClientCardOverlay(): void {
  for (const listener of listeners) listener();
}

export function subscribeClientCardOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginClientCardOverlay(slug: string): string | null {
  const safe = sanitizeOverlaySlug(slug);
  if (!safe) return activeSlug;
  if (activeSlug === safe) return activeSlug;
  activeSlug = safe;
  notifyClientCardOverlay();
  return activeSlug;
}

export function endClientCardOverlay(): void {
  if (activeSlug === null) return;
  activeSlug = null;
  notifyClientCardOverlay();
}

export function peekClientCardOverlaySlug(): string | null {
  return activeSlug;
}

export function isClientCardOverlayActive(): boolean {
  return activeSlug !== null;
}

export function resetClientCardOverlayForTests(): void {
  activeSlug = null;
}

/** Intercepting `@modal` must not mount a second viewer. */
export function shouldRenderInterceptedCardModal(
  clientOverlayActive = isClientCardOverlayActive()
): boolean {
  return !clientOverlayActive;
}

/**
 * Hard `/p/[slug]` and intercepting modal share `CardPageClient` without listing
 * neighbor handlers. While the client overlay owns the card, they must not mount
 * or `router.replace` a neighbor.
 */
export function shouldRenderSecondaryCardViewer(input: {
  hasListingNeighborHandler: boolean;
  clientOverlayActive: boolean;
}): boolean {
  if (input.hasListingNeighborHandler) return true;
  return !input.clientOverlayActive;
}

export function canNavigateFromSecondaryCardViewer(
  clientOverlayActive: boolean
): boolean {
  return !clientOverlayActive;
}
