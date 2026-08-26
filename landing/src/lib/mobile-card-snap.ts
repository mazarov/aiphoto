export type MobileCardSnapDirection = "prev" | "current" | "next";

/** Matches Tailwind `md`. Immersive snap feed is `md:hidden`. */
export const MOBILE_CARD_SNAP_MAX_WIDTH_MQ = "(max-width: 767px)";

/** Ignore scroll/scrollend after a hidden→visible or desktop→mobile recenter. */
export const MOBILE_CARD_SNAP_LAYOUT_SCROLL_IGNORE_MS = 400;

/** Re-pin current slug after layout; CSS snap stays off until this settles. */
export const MOBILE_CARD_SNAP_LAYOUT_PIN_FRAMES = 12;

export function isMobileCardSnapViewportUsable({
  clientHeight,
  displayNone,
  stageDisplayNone = false,
}: {
  clientHeight: number;
  displayNone: boolean;
  stageDisplayNone?: boolean;
}): boolean {
  if (stageDisplayNone) return false;
  return !displayNone && Number.isFinite(clientHeight) && clientHeight > 1;
}

export function shouldRecenterMobileCardSnapOnResize({
  previousUsable,
  nextUsable,
  crossedToMobileViewport = false,
}: {
  previousUsable: boolean;
  nextUsable: boolean;
  crossedToMobileViewport?: boolean;
}): boolean {
  if (crossedToMobileViewport) return true;
  return nextUsable && !previousUsable;
}

/**
 * Prev slides must not exist in the DOM while index assumes they do.
 * First paint is only the current card (`scrollTop=0` is correct). Attach
 * neighbors in the same commit as jumping `scrollTop` to `prevCount * H`.
 */
export function resolveMobileCardSnapSlideIndex({
  neighborsAttached,
  prevCount,
}: {
  neighborsAttached: boolean;
  prevCount: number;
}): number {
  if (!neighborsAttached) return 0;
  return Number.isFinite(prevCount) ? Math.max(0, prevCount) : 0;
}

export function isMobileCardSnapCentered({
  scrollTop,
  slideHeight,
  currentSlideIndex,
  epsilonPx = 2,
}: {
  scrollTop: number;
  slideHeight: number;
  currentSlideIndex: number;
  epsilonPx?: number;
}): boolean {
  if (!Number.isFinite(slideHeight) || slideHeight <= 0) return false;
  const expected = currentSlideIndex * slideHeight;
  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  return Math.abs(safeScrollTop - expected) <= Math.max(0, epsilonPx);
}

/**
 * iOS chrome can change visualViewport.height during a real swipe.
 * A hidden (`display:none` / 0-height) feed becoming visible is not a swipe:
 * scrollTop is often 0 and would otherwise rebase onto a neighbor slide.
 */
export function shouldTreatMobileCardResizeAsInteraction({
  pointerActive,
  phaseIdle,
  previousUsable,
  nextUsable,
}: {
  pointerActive: boolean;
  phaseIdle: boolean;
  previousUsable: boolean;
  nextUsable: boolean;
}): boolean {
  if (!previousUsable || !nextUsable) return false;
  return pointerActive || !phaseIdle;
}

export function shouldIgnoreLayoutInducedMobileCardSnapScroll({
  nowMs,
  ignoreUntilMs,
}: {
  nowMs: number;
  ignoreUntilMs: number;
}): boolean {
  return nowMs < ignoreUntilMs;
}

type ResolveMobileCardSnapDirectionOptions = {
  scrollTop: number;
  slideHeight: number;
  currentSlideIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  epsilonPx?: number;
};

const DEFAULT_SNAP_EPSILON_PX = 2;

/**
 * Resolves the settled slide without depending on browser-specific scroll
 * events. Missing edge slides always resolve back to the current card.
 */
export function resolveMobileCardSnapDirection({
  scrollTop,
  slideHeight,
  currentSlideIndex,
  hasPrev,
  hasNext,
  epsilonPx = DEFAULT_SNAP_EPSILON_PX,
}: ResolveMobileCardSnapDirectionOptions): MobileCardSnapDirection {
  if (!Number.isFinite(slideHeight) || slideHeight <= 0) return "current";

  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  const currentTop = currentSlideIndex * slideHeight;
  if (Math.abs(safeScrollTop - currentTop) <= Math.max(0, epsilonPx)) {
    return "current";
  }

  const settledIndex = Math.round(safeScrollTop / slideHeight);
  if (settledIndex < currentSlideIndex) return hasPrev ? "prev" : "current";
  if (settledIndex > currentSlideIndex) return hasNext ? "next" : "current";
  return "current";
}

type RebaseMobileCardScrollTopOptions = {
  scrollTop: number;
  previousHeight: number;
  nextHeight: number;
  currentSlideIndex: number;
  interacting: boolean;
};

/**
 * Dynamic browser chrome changes visualViewport.height during an iOS gesture.
 * Preserve normalized progress while moving; center only when the feed is idle.
 */
export function rebaseMobileCardScrollTop({
  scrollTop,
  previousHeight,
  nextHeight,
  currentSlideIndex,
  interacting,
}: RebaseMobileCardScrollTopOptions): number {
  if (!Number.isFinite(nextHeight) || nextHeight <= 0) return 0;
  if (
    !interacting ||
    !Number.isFinite(previousHeight) ||
    previousHeight <= 0
  ) {
    return currentSlideIndex * nextHeight;
  }

  const safeScrollTop = Number.isFinite(scrollTop) ? scrollTop : 0;
  return Math.max(0, (safeScrollTop / previousHeight) * nextHeight);
}

export function mobileCardScrollBehavior(
  prefersReducedMotion: boolean
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

export function canCommitMobileCardSnap({
  direction,
  targetAvailable,
  alreadyCommitting,
}: {
  direction: MobileCardSnapDirection;
  targetAvailable: boolean;
  alreadyCommitting: boolean;
}): boolean {
  return (
    direction !== "current" && targetAvailable && !alreadyCommitting
  );
}

export function resolveMobileCardSnapTargetSlug({
  settledSlideIndex,
  currentSlideIndex,
  prevSlugs,
  nextSlugs,
}: {
  settledSlideIndex: number;
  currentSlideIndex: number;
  prevSlugs: string[];
  nextSlugs: string[];
}): string | null {
  const offset = settledSlideIndex - currentSlideIndex;
  const bufferIndex = Math.abs(offset) - 1;
  if (offset < 0) return prevSlugs[bufferIndex] ?? null;
  if (offset > 0) return nextSlugs[bufferIndex] ?? null;
  return null;
}
