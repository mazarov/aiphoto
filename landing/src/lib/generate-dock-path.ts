import { isGeneraciyaFotoScenarioPath } from "./generaciya-foto-routes";
import type { GenerateDockComposeIntent } from "./generate-dock-seed";

/** SEO acquisition route where blank text-to-image is allowed. */
export function isGenerateDockSeoPagePath(pathname: string): boolean {
  const normalized = normalizeGenerateDockPath(pathname);
  return (
    normalized === "/generaciya-foto" ||
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

/** Non-null: FAB / tab must seed this intent instead of blank resume. */
export function listingGenerateIdleIntent(
  pathname: string
): GenerateDockComposeIntent | null {
  return isFotoVPromtDockPath(pathname) ? "photo_prompt" : null;
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
