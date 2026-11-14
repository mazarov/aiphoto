import { prefetchComposeExamplePickerFirstPage } from "./compose-example-audience-client";
import {
  isGenerateDockListingPath,
  isStickerGenerateDockPath,
  listingComposeExampleInitialFilter,
  shouldPrefetchGenerateDockMedia,
  shouldPrefetchGenerateDockPanel,
} from "./generate-dock-path";
import {
  prefetchGenerateBootstrap,
  readLastKnownAuthUserId,
} from "./generate-bootstrap-client";
import { loadStickerCatalogClient } from "./sticker-catalog-client";
import { prefetchPhotoGuideImage } from "./user-generation-photos-cache";

export { shouldPrefetchGenerateDockPanel };

export function isNavigatorSaveDataEnabled(nav?: unknown): boolean {
  const candidate =
    nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  if (!candidate || typeof candidate !== "object") return false;
  const connection = (
    candidate as { connection?: { saveData?: unknown } | null }
  ).connection;
  return connection?.saveData === true;
}

/** Immediate pointer/touch warmup on FAB, tab bar, or card «Повторить». */
export function prefetchGenerateDockTrigger(userId?: string | null): void {
  if (typeof window === "undefined") return;
  const resolvedUserId = userId ?? readLastKnownAuthUserId();
  void import("@/components/CardInlineGeneratePanel");
  prefetchGenerateBootstrap({
    userIdHint: resolvedUserId,
    includeLastResult: Boolean(resolvedUserId),
  });
}

/** Full warmup: compose chunk + unified bootstrap + portrait guide + example grid. */
export function prefetchGenerateDockWarmup(userId?: string | null): void {
  prefetchGenerateDockTrigger(userId);
  prefetchPhotoGuideImage();
  prefetchComposeExamplePickerFirstPage();
}

export function scheduleGenerateDockPrefetch(
  pathname: string,
  userId?: string | null,
): () => void {
  if (typeof window === "undefined") return () => {};
  if (isNavigatorSaveDataEnabled()) return () => {};

  let cancelled = false;
  let idleId = 0;
  let postLoadIdleId = 0;
  let timer = 0;

  const prefetchPanelAndBootstrap = () => {
    if (cancelled) return;
    void import("@/components/CardInlineGeneratePanel");
    prefetchGenerateBootstrap({
      userIdHint: userId,
      includeLastResult: Boolean(userId),
    });
  };

  const warmSticker = () => {
    if (cancelled) return;
    prefetchPanelAndBootstrap();
    void loadStickerCatalogClient().catch(() => {});
  };

  const scheduleAfterLoadIdle = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      postLoadIdleId = window.requestIdleCallback(prefetchPanelAndBootstrap, {
        timeout: 4000,
      });
    } else {
      timer = window.setTimeout(prefetchPanelAndBootstrap, 800);
    }
  };

  const run = () => {
    if (cancelled) return;
    if (shouldPrefetchGenerateDockMedia(pathname)) {
      prefetchPhotoGuideImage();
      const filter = listingComposeExampleInitialFilter(pathname);
      prefetchComposeExamplePickerFirstPage({
        filter: filter
          ? { dimension: filter.dimension, value: filter.value }
          : null,
      });
    }
    if (shouldPrefetchGenerateDockPanel(pathname)) {
      // Sticker landing: wait until load so we never compete with LCP thumb.
      if (isStickerGenerateDockPath(pathname)) {
        if (document.readyState === "complete") warmSticker();
        else window.addEventListener("load", warmSticker, { once: true });
        return;
      }
      prefetchPanelAndBootstrap();
      return;
    }

    if (isGenerateDockListingPath(pathname)) {
      if (document.readyState === "complete") {
        scheduleAfterLoadIdle();
      } else {
        window.addEventListener("load", scheduleAfterLoadIdle, { once: true });
      }
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    idleId = window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    timer = window.setTimeout(run, 400);
  }

  return () => {
    cancelled = true;
    window.removeEventListener("load", prefetchPanelAndBootstrap);
    window.removeEventListener("load", warmSticker);
    window.removeEventListener("load", scheduleAfterLoadIdle);
    if (idleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
    if (postLoadIdleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(postLoadIdleId);
    }
    if (timer) window.clearTimeout(timer);
  };
}
