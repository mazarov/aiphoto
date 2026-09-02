import { isGeneraciyaFotoScenarioPath } from "./generaciya-foto-routes";
import type { GenerateDockComposeIntent } from "./generate-dock-seed";
import { isPromtyDlyaIiFotosessiiPath } from "./promty-dlya-ii-fotosessii-cluster";

/** SEO acquisition route where blank text-to-image is allowed. */
export function isGenerateDockSeoPagePath(pathname: string): boolean {
  const normalized = normalizeGenerateDockPath(pathname);
  return (
    normalized === "/generaciya-foto" ||
    normalized === "/nano-banana" ||
    isGeneraciyaFotoScenarioPath(normalized)
  );
}

export function normalizeGenerateDockPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Canonical `/foto-v-promt` listing — FAB opens «Промт по фото». */
export function isFotoVPromtDockPath(pathname: string): boolean {
  return normalizeGenerateDockPath(pathname) === "/foto-v-promt";
}

const LEGACY_PROMTY_DLYA_II_FOTOSESSII_PREFIX = "/promty-dlya-ii-fotosessii";

/** Pre-rename hub/L2. 301 to `/ii-fotosessiya`, but idle CTA/intent still match. */
export function isLegacyPromtyDlyaIiFotosessiiDockPath(pathname: string): boolean {
  const np = normalizeGenerateDockPath(pathname);
  return (
    np === LEGACY_PROMTY_DLYA_II_FOTOSESSII_PREFIX ||
    np.startsWith(`${LEGACY_PROMTY_DLYA_II_FOTOSESSII_PREFIX}/`)
  );
}

/** Canonical `/ii-fotosessiya*` plus the legacy `/promty-dlya-ii-fotosessii*` scenario. */
export function isFotosessiiGenerateDockPath(pathname: string): boolean {
  return (
    isPromtyDlyaIiFotosessiiPath(pathname) ||
    isLegacyPromtyDlyaIiFotosessiiDockPath(pathname)
  );
}

/** Prefetch the compose chunk + config only on upload-first landings. */
export function shouldPrefetchGenerateDockPanel(pathname: string): boolean {
  return isFotoVPromtDockPath(pathname) || isFotosessiiGenerateDockPath(pathname);
}

/** Non-null: FAB / tab must seed this intent instead of blank resume. */
export function listingGenerateIdleIntent(
  pathname: string
): GenerateDockComposeIntent | null {
  if (isFotoVPromtDockPath(pathname)) return "photo_prompt";
  if (isFotosessiiGenerateDockPath(pathname)) return "photoshoot";
  return null;
}

/** Listing routes where the floating generate dock is mounted. */
export function isGenerateDockListingPath(pathname: string): boolean {
  const np = normalizeGenerateDockPath(pathname);

  if (
    np === "/" ||
    np === "/trends" ||
    np === "/catalog" ||
    np === "/search" ||
    np === "/favorites" ||
    np === "/generate" ||
    np === "/generations" ||
    np === "/analyses" ||
    np === "/foto-v-promt" ||
    isGenerateDockSeoPagePath(np)
  ) {
    return true;
  }

  const blockedExact = new Set([
    "/pricing",
    "/admin",
    "/embed",
    "/auth",
    "/extension-stv",
    "/privacy",
    "/terms",
    "/policy",
    "/p",
  ]);
  if (blockedExact.has(np)) return false;

  const blockedPrefixes = [
    "/p/",
    "/pricing/",
    "/admin/",
    "/embed/",
    "/auth/",
    "/extension-stv/",
  ];
  if (blockedPrefixes.some((prefix) => np.startsWith(prefix))) return false;

  // Tag / SEO listing catch-all (`app/[...slug]`)
  return np.startsWith("/") && np.length > 1;
}
