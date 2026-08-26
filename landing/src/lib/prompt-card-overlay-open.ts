export const PROMPT_CARD_OVERLAY_OPEN_SUPPRESS_MS = 500;

let openedAtMs = 0;

export function markPromptCardOverlayOpened(nowMs = performance.now()): void {
  openedAtMs = nowMs;
}

export function isPromptCardOverlayOpening(
  nowMs = performance.now(),
  windowMs = PROMPT_CARD_OVERLAY_OPEN_SUPPRESS_MS
): boolean {
  return openedAtMs > 0 && nowMs - openedAtMs < windowMs;
}

export function shouldSuppressMobileCardSnapCommit({
  overlayOpening,
  authReturnPending,
}: {
  overlayOpening: boolean;
  authReturnPending: boolean;
}): boolean {
  return overlayOpening || authReturnPending;
}
