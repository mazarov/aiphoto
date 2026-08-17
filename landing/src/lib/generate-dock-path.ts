import { isGeneraciyaFotoScenarioPath } from "./generaciya-foto-routes";

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
