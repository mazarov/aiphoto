import { prefetchComposeExamplePickerFirstPage } from "./compose-example-audience-client";
import {
  listingComposeExampleInitialFilter,
  shouldPrefetchGenerateDockPanel,
} from "./generate-dock-path";
import { writeCachedPhotoshootEnabled } from "./photoshoot-availability";
import { prefetchUserPhotoLibrary } from "./user-generation-photos-cache";

export { shouldPrefetchGenerateDockPanel };

function prefetchGenerationConfigCache(): void {
  void fetch("/api/generation-config?modality=image", {
    credentials: "same-origin",
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { photoshootEnabled?: boolean } | null) => {
      if (typeof data?.photoshootEnabled === "boolean") {
        writeCachedPhotoshootEnabled(data.photoshootEnabled);
      }
    })
    .catch(() => {
      /* warm-up only */
    });
}

/** Idle warmup: compose chunk + photoshoot flag + library previews + example grid. */
export function prefetchGenerateDockWarmup(userId?: string | null): void {
  void import("@/components/CardInlineGeneratePanel");
  prefetchGenerationConfigCache();
  prefetchUserPhotoLibrary(userId);
  prefetchComposeExamplePickerFirstPage();
}

export function scheduleGenerateDockPrefetch(
  pathname: string,
  userId?: string | null,
): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => {
    prefetchUserPhotoLibrary(userId);
    const filter = listingComposeExampleInitialFilter(pathname);
    prefetchComposeExamplePickerFirstPage({
      filter: filter
        ? { dimension: filter.dimension, value: filter.value }
        : null,
    });
    if (shouldPrefetchGenerateDockPanel(pathname)) {
      void import("@/components/CardInlineGeneratePanel");
      prefetchGenerationConfigCache();
    }
  };
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = window.setTimeout(run, 400);
  return () => window.clearTimeout(timer);
}
