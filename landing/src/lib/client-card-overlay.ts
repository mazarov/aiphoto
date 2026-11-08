import { sanitizeOverlaySlug } from "@/lib/auth-return-screen";

/**
 * Synchronous owner of the in-app card overlay (`ClientCardModal`).
 *
 * Next 15 syncs `history.pushState('/p/slug')` into the App Router. That rematches
 * `@modal/(.)p/[slug]` and can also replace `children` with `/p/[slug]`. Those
 * routes mount a second `CardPageClient` without `onListingNeighborGo`, which
 * `router.replace`s a snap neighbor and looks like “the card next to the one I opened”.
 *
 * Also, once Next prefetch caches `@modal/(.)p/[slug]` RSC payloads (e.g. as cards
 * enter the viewport on scroll), `close()` clearing `activeSlug` before the async
 * `history.back()` popstate settles lets `@modal` mount an empty `<CardModal>` dialog
 * (`fixed inset-0 z-[245]`) over the listing and swallow all taps.
 *
 * React state is too late: set the flag before `pushState`, keep a short close
 * cooldown until `popstate` leaves `/p/...`, and never render `@modal` when the
 * browser URL is already back on a listing path.
 */
const CLIENT_CARD_OVERLAY_CLOSE_HOLD_MS = 1500;

let activeSlug: string | null = null;
let closingUntilMs = 0;
let closeTimerId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notifyClientCardOverlay(): void {
  for (const listener of listeners) listener();
}

function clearCloseCooldownTimer(): void {
  if (closeTimerId !== null) {
    clearTimeout(closeTimerId);
    closeTimerId = null;
  }
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
  clearCloseCooldownTimer();
  const hadClosing = closingUntilMs > 0;
  closingUntilMs = 0;
  if (activeSlug === safe) {
    if (hadClosing) notifyClientCardOverlay();
    return activeSlug;
  }
  activeSlug = safe;
  notifyClientCardOverlay();
  return activeSlug;
}

export function endClientCardOverlay(nowMs = Date.now()): void {
  clearCloseCooldownTimer();
  const wasBlocking = isClientCardOverlayBlocking(nowMs);
  activeSlug = null;
  closingUntilMs = nowMs + CLIENT_CARD_OVERLAY_CLOSE_HOLD_MS;
  closeTimerId = setTimeout(() => {
    closeTimerId = null;
    if (closingUntilMs > 0 && Date.now() >= closingUntilMs) {
      closingUntilMs = 0;
      notifyClientCardOverlay();
    }
  }, CLIENT_CARD_OVERLAY_CLOSE_HOLD_MS + 10);
  if (!wasBlocking) {
    notifyClientCardOverlay();
  }
}

export function settleClientCardOverlayClose(): void {
  clearCloseCooldownTimer();
  if (activeSlug === null && closingUntilMs === 0) return;
  activeSlug = null;
  closingUntilMs = 0;
  notifyClientCardOverlay();
}

export function peekClientCardOverlaySlug(): string | null {
  return activeSlug;
}

export function isClientCardOverlayActive(): boolean {
  return activeSlug !== null;
}

export function isClientCardOverlayBlocking(nowMs = Date.now()): boolean {
  return activeSlug !== null || (closingUntilMs > 0 && nowMs < closingUntilMs);
}

export function resetClientCardOverlayForTests(): void {
  clearCloseCooldownTimer();
  activeSlug = null;
  closingUntilMs = 0;
}

export function isCardPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/p" || pathname.startsWith("/p/");
}

/** Intercepting `@modal` must not mount a second viewer or linger on listing URLs. */
export function shouldRenderInterceptedCardModal(
  clientOverlayBlocking = isClientCardOverlayBlocking(),
  pathname?: string | null
): boolean {
  if (clientOverlayBlocking) return false;
  if (pathname !== undefined && pathname !== null && !isCardPathname(pathname)) {
    return false;
  }
  return true;
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
