/**
 * Mobile catalog shell height — synced to visualViewport so the in-flow search dock
 * stays at the bottom of the visible area after keyboard / browser chrome changes.
 */

import { useEffect } from "react";

export const LISTING_SHELL_HEIGHT_VAR = "--ps-listing-shell-height";

const MOBILE_MQ = "(max-width: 1023px)";

export function readListingShellViewportHeightPx(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  if (vv && Number.isFinite(vv.height) && vv.height > 0) {
    return Math.round(vv.height);
  }
  return Math.round(window.innerHeight);
}

export function syncListingShellViewportHeight(): void {
  if (typeof window === "undefined") return;
  if (!window.matchMedia(MOBILE_MQ).matches) {
    document.documentElement.style.removeProperty(LISTING_SHELL_HEIGHT_VAR);
    return;
  }
  document.documentElement.style.setProperty(
    LISTING_SHELL_HEIGHT_VAR,
    `${readListingShellViewportHeightPx()}px`,
  );
}

/** Re-measure after keyboard/sheet transitions (layout may settle over several frames). */
export function bumpListingShellViewportHeight(): void {
  syncListingShellViewportHeight();
  requestAnimationFrame(() => {
    syncListingShellViewportHeight();
    requestAnimationFrame(syncListingShellViewportHeight);
  });
  window.setTimeout(syncListingShellViewportHeight, 120);
  window.setTimeout(syncListingShellViewportHeight, 320);
}

export function useListingShellViewportSync(): void {
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);

    const onLayoutChange = () => syncListingShellViewportHeight();
    const onVvChange = () => syncListingShellViewportHeight();

    const attachVv = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      vv.addEventListener("resize", onVvChange);
      vv.addEventListener("scroll", onVvChange);
    };

    const detachVv = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      vv.removeEventListener("resize", onVvChange);
      vv.removeEventListener("scroll", onVvChange);
    };

    const onMqChange = () => {
      detachVv();
      onLayoutChange();
      if (mq.matches) attachVv();
    };

    mq.addEventListener("change", onMqChange);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("orientationchange", onLayoutChange);
    window.addEventListener("pageshow", onLayoutChange);

    onLayoutChange();
    if (mq.matches) attachVv();

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("orientationchange", onLayoutChange);
      window.removeEventListener("pageshow", onLayoutChange);
      detachVv();
      document.documentElement.style.removeProperty(LISTING_SHELL_HEIGHT_VAR);
    };
  }, []);
}
