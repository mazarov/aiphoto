export type MobileCardSnapDirection = "prev" | "current" | "next";

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
