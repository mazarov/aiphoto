import {
  CARD_IMAGE_HERO_MAX_WIDTH_PX,
  CARD_IMAGE_HERO_QUALITY,
} from "./card-image-presets";

export type MobileCardSnapDirection = "prev" | "current" | "next";

/** Matches Tailwind `lg`. Immersive snap feed is `lg:hidden`, same as the listing shell. */
export const MOBILE_CARD_SNAP_MAX_WIDTH_MQ = "(max-width: 1023px)";

/** Ignore scroll/scrollend after a hidden→visible or desktop→mobile recenter. */
export const MOBILE_CARD_SNAP_LAYOUT_SCROLL_IGNORE_MS = 400;

/** Re-pin current slug after layout; CSS snap stays off until this settles. */
export const MOBILE_CARD_SNAP_LAYOUT_PIN_FRAMES = 12;

/** Virtual slide window `[center - 2 .. center + 3]` (at most 6 slides in DOM). */
export const VIRTUAL_CARD_SNAP_OVERSCAN_BEFORE = 2;
export const VIRTUAL_CARD_SNAP_OVERSCAN_AFTER = 3;

/** WebKit caps history.replaceState at 100 calls / 30s; debounce URL sync while flicking. */
export const CARD_SNAP_URL_SYNC_DEBOUNCE_MS = 200;

/** Count virtual pageviews and card-view beacons only when the user pauses on a swiped card. */
export const CARD_SNAP_ANALYTICS_DWELL_MS = 600;

/** Upgrade active slide from cached q=60 base layer to 1920w q=100 hero after settle dwell. */
export const CARD_SNAP_HD_UPGRADE_DWELL_MS = 140;

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

/**
 * Chrome inside the snap feed (Промпт, close, reactions, links).
 * Photo edge hit-zones opt out with `data-swipe-ok`.
 */
export const MOBILE_CARD_SNAP_INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [data-no-swipe]";

export type MobileCardSnapStopStyle = {
  overflowY: string;
  scrollSnapType: string;
  scrollBehavior: string;
  scrollTop: number;
};

/**
 * Freeze the snap scroller on the slide currently on screen before unmount.
 * Closing ✕ while a swipe is still decelerating otherwise destroys a live
 * WebKit momentum scroll container mid-gesture and leaves the underlying
 * listing ignoring subsequent taps.
 */
export function freezeMobileCardSnapOnUnmount({
  scrollTop,
  slideHeight,
  style,
}: {
  scrollTop: number;
  slideHeight: number;
  style: Pick<
    MobileCardSnapStopStyle,
    "overflowY" | "scrollSnapType" | "scrollBehavior"
  >;
}): number {
  const height = Number.isFinite(slideHeight) && slideHeight > 0 ? slideHeight : 0;
  const safeTop = Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0;
  const targetTop = height > 0 ? Math.round(safeTop / height) * height : safeTop;
  style.scrollSnapType = "none";
  style.scrollBehavior = "auto";
  style.overflowY = "hidden";
  return targetTop;
}

export function resolveMobileCardSnapGestureTarget(
  target: EventTarget | null
): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

export function shouldLockMobileCardSnapInteractiveMatch(
  match: { hasAttribute(name: string): boolean } | null
): boolean {
  if (!match) return false;
  return !match.hasAttribute("data-swipe-ok");
}

export function shouldLockMobileCardSnapGesture(
  target: EventTarget | null
): boolean {
  const el = resolveMobileCardSnapGestureTarget(target);
  if (!el) return false;
  return shouldLockMobileCardSnapInteractiveMatch(
    el.closest(MOBILE_CARD_SNAP_INTERACTIVE_SELECTOR)
  );
}

/**
 * Hero photo to render on the active mobile card slide.
 *
 * `CardPageClient` mirrors `data.photoUrls` into local `photos` state (so admin
 * "Сделать «Было»" can splice a frame in place) and syncs it via `useEffect`.
 * On a swipe commit, `data` updates synchronously while `photos` still holds the
 * previous card's URLs for one render — rendering `photos[0]` flashes the old card.
 */
export function resolveActiveMobileCardPhotos({
  dataId,
  syncedDataId,
  localPhotos,
  dataPhotoUrls,
}: {
  dataId: string;
  syncedDataId: string;
  localPhotos: readonly string[];
  dataPhotoUrls: readonly string[];
}): readonly string[] {
  return syncedDataId === dataId ? localPhotos : dataPhotoUrls;
}

export function shouldIgnoreLayoutScrollAfterGestureLock({
  currentScrollTop,
  lockedScrollTop,
}: {
  currentScrollTop: number | null;
  lockedScrollTop: number | null;
}): boolean {
  if (currentScrollTop === null || lockedScrollTop === null) return false;
  return Math.abs(currentScrollTop - lockedScrollTop) > 0.5;
}

/* ── V2 Monotonic Virtualized Snap Track Helpers ── */

function dedupeSlugs(slugs: readonly string[] | null | undefined): string[] {
  if (!slugs || slugs.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slugs) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Builds the initial monotonic slug track for a mobile viewer session.
 * When `currentSlug` belongs to the saved listing order, the entire list is
 * adopted so both backward (`0 .. initialIndex - 1`) and forward slides sit at
 * fixed offsets `index * slideHeight` from frame 0.
 */
export function buildInitialSessionSlugs({
  currentSlug,
  listingSlugs,
}: {
  currentSlug: string;
  listingSlugs: readonly string[] | null | undefined;
}): { slugs: string[]; initialIndex: number } {
  const cleanCurrent = currentSlug.trim();
  const deduped = dedupeSlugs(listingSlugs);
  const foundIndex = deduped.indexOf(cleanCurrent);
  if (foundIndex >= 0) {
    return { slugs: deduped, initialIndex: foundIndex };
  }
  return { slugs: cleanCurrent ? [cleanCurrent] : [], initialIndex: 0 };
}

/**
 * Strictly append-only merge when infinite scroll loads another listing page.
 *
 * `localStorage` caps its slug array at 500 items (`capListingSlugList`), dropping
 * older head items. Dropping head items during an open swipe session would shift
 * `activeIndex` backward and jump `scrollTop`. Appending only unseen tail slugs
 * guarantees `index * slideHeight` is immutable for every already-mounted slide.
 */
export function mergeSessionListingSlugs({
  sessionSlugs,
  incomingSlugs,
}: {
  sessionSlugs: readonly string[];
  incomingSlugs: readonly string[] | null | undefined;
}): string[] {
  const cleanIncoming = dedupeSlugs(incomingSlugs);
  if (cleanIncoming.length === 0) {
    return [...sessionSlugs];
  }
  if (sessionSlugs.length === 0) {
    return cleanIncoming;
  }

  // Single-card session that just received a listing context containing that card.
  if (sessionSlugs.length === 1) {
    const only = sessionSlugs[0]!;
    const idx = cleanIncoming.indexOf(only);
    if (idx === 0 && cleanIncoming.length > 1) {
      return cleanIncoming;
    }
  }

  const seen = new Set(sessionSlugs);
  const lastExisting = sessionSlugs[sessionSlugs.length - 1]!;
  const tailAnchorIdx = cleanIncoming.lastIndexOf(lastExisting);

  const candidates =
    tailAnchorIdx >= 0
      ? cleanIncoming.slice(tailAnchorIdx + 1)
      : cleanIncoming.some((slug) => seen.has(slug))
        ? cleanIncoming
        : [];

  if (candidates.length === 0) {
    return sessionSlugs as string[];
  }

  let appended: string[] | null = null;
  for (const slug of candidates) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    if (!appended) appended = [...sessionSlugs];
    appended.push(slug);
  }
  return appended ?? (sessionSlugs as string[]);
}

/**
 * Handles external slug switches (split-group variant pills `1 / 2 / 3` or OAuth pin).
 * If `nextSlug` is already in the track, jumps to its index; otherwise replaces
 * the active slot in place so `prev` (`index - 1`) and `next` (`index + 1`) stay intact
 * without moving `scrollTop`.
 */
export function replaceSessionSlugInPlace({
  sessionSlugs,
  activeIndex,
  nextSlug,
}: {
  sessionSlugs: readonly string[];
  activeIndex: number;
  nextSlug: string;
}): {
  slugs: string[];
  index: number;
  mode: "noop" | "jump" | "replace-in-place";
} {
  const cleanNext = nextSlug.trim();
  if (!cleanNext) {
    return { slugs: [...sessionSlugs], index: activeIndex, mode: "noop" };
  }
  if (sessionSlugs.length === 0) {
    return { slugs: [cleanNext], index: 0, mode: "replace-in-place" };
  }
  const safeIndex = Math.min(
    Math.max(0, activeIndex),
    sessionSlugs.length - 1
  );
  if (sessionSlugs[safeIndex] === cleanNext) {
    return { slugs: sessionSlugs as string[], index: safeIndex, mode: "noop" };
  }
  const existingIndex = sessionSlugs.indexOf(cleanNext);
  if (existingIndex >= 0) {
    return {
      slugs: sessionSlugs as string[],
      index: existingIndex,
      mode: "jump",
    };
  }
  const nextSlugs = [...sessionSlugs];
  nextSlugs[safeIndex] = cleanNext;
  return { slugs: nextSlugs, index: safeIndex, mode: "replace-in-place" };
}

export type VirtualCardSnapWindow = {
  startIndex: number;
  endIndex: number;
  centerIndex: number;
  totalSlides: number;
};

export function resolveVirtualCardSnapWindow({
  totalSlides,
  centerIndex,
  overscanBefore = VIRTUAL_CARD_SNAP_OVERSCAN_BEFORE,
  overscanAfter = VIRTUAL_CARD_SNAP_OVERSCAN_AFTER,
}: {
  totalSlides: number;
  centerIndex: number;
  overscanBefore?: number;
  overscanAfter?: number;
}): VirtualCardSnapWindow {
  const safeTotal = Number.isFinite(totalSlides)
    ? Math.max(0, Math.floor(totalSlides))
    : 0;
  if (safeTotal === 0) {
    return { startIndex: 0, endIndex: -1, centerIndex: 0, totalSlides: 0 };
  }
  const clampedCenter = Math.min(
    Math.max(0, Math.floor(Number.isFinite(centerIndex) ? centerIndex : 0)),
    safeTotal - 1
  );
  const startIndex = Math.max(0, clampedCenter - Math.max(0, overscanBefore));
  const endIndex = Math.min(
    safeTotal - 1,
    clampedCenter + Math.max(0, overscanAfter)
  );
  return {
    startIndex,
    endIndex,
    centerIndex: clampedCenter,
    totalSlides: safeTotal,
  };
}

/**
 * Resolves the active visual card index at the 50% scroll midpoint (`Math.round`).
 */
export function resolveVirtualCardVisualIndex({
  scrollTop,
  slideHeight,
  totalSlides,
  fallbackIndex = 0,
}: {
  scrollTop: number;
  slideHeight: number;
  totalSlides: number;
  fallbackIndex?: number;
}): number {
  const safeTotal = Number.isFinite(totalSlides)
    ? Math.max(0, Math.floor(totalSlides))
    : 0;
  if (safeTotal === 0) return 0;
  const clampedFallback = Math.min(
    Math.max(0, Math.floor(Number.isFinite(fallbackIndex) ? fallbackIndex : 0)),
    safeTotal - 1
  );
  if (!Number.isFinite(slideHeight) || slideHeight <= 0) {
    return clampedFallback;
  }
  const safeTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const rounded = Math.round(safeTop / slideHeight);
  return Math.min(Math.max(0, rounded), safeTotal - 1);
}

export function isVirtualCardScrollNearSnapPoint({
  scrollTop,
  slideHeight,
  epsilonPx = 2.5,
}: {
  scrollTop: number;
  slideHeight: number;
  epsilonPx?: number;
}): boolean {
  if (!Number.isFinite(slideHeight) || slideHeight <= 0) return false;
  const safeTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const nearestSnapTop = Math.round(safeTop / slideHeight) * slideHeight;
  return Math.abs(safeTop - nearestSnapTop) <= Math.max(0, epsilonPx);
}

/**
 * Computes the permanent base image URL (`q=60` on `<Image>`) and the progressive
 * `1920w` hero URL (`q=100` overlay after settle dwell).
 *
 * Listing-primed cards carry `?width=1024&quality=60` on `/storage/v1/render/image/public/...`;
 * rewriting query params yields the canonical `1920w` hero render URL without extra metadata.
 */
export function resolveCardSlideImageUrls(
  rawPhotoUrl: string | null | undefined
): {
  baseUrl: string | null;
  heroUrl: string | null;
} {
  const trimmed = typeof rawPhotoUrl === "string" ? rawPhotoUrl.trim() : "";
  if (!trimmed) {
    return { baseUrl: null, heroUrl: null };
  }
  if (trimmed.includes("/storage/v1/render/image/public/")) {
    const qIdx = trimmed.indexOf("?");
    const basePath = qIdx >= 0 ? trimmed.slice(0, qIdx) : trimmed;
    const heroUrl = `${basePath}?width=${CARD_IMAGE_HERO_MAX_WIDTH_PX}&quality=${CARD_IMAGE_HERO_QUALITY}`;
    return { baseUrl: trimmed, heroUrl };
  }
  return { baseUrl: trimmed, heroUrl: trimmed };
}
