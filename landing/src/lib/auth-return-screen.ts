import {
  AUTH_RETURN_TTL_SEC,
  appendAuthReturnMarker,
  peekAuthReturnScrollY,
  persistAuthReturnPath,
  persistAuthReturnScrollY,
  readAuthCookie,
  readAuthReturnOverlayFromHref,
  readAuthReturnScrollFromHref,
  sanitizeAuthReturnDestination,
  writeAuthCookie,
} from "@/lib/auth-return-path";

export { peekAuthReturnScrollY };
import {
  isListingOverlayPath,
  peekLastListingPath,
  peekSavedListingScrollY,
  readListingScrollY,
  resolveListingScrollYForAuthReturn,
  writeSavedListingScrollY,
} from "@/lib/scroll-preservation";

export const AUTH_RETURN_OVERLAY_KEY = "promptshot:auth-return-overlay";
export const AUTH_RETURN_OVERLAY_COOKIE = "ps_auth_ov";
const OVERLAY_SLUG_MAX = 200;

export type AuthReturnOverlay =
  | { type: "card"; slug: string }
  | { type: "pricing" }
  | { type: "foto-v-promt" };

export type AuthReturnScreen = {
  path: string;
  overlay: AuthReturnOverlay | null;
  scrollY: number;
};

export type LiveAuthReturnOverlay = {
  originPath: string;
  overlay: AuthReturnOverlay;
};

let liveOverlay: LiveAuthReturnOverlay | null = null;
/** Frozen at «Повторить» / auth start so a snap neighbor cannot rewrite `ps_ov`. */
let boundOverlay: AuthReturnOverlay | null = null;

export function sanitizeOverlaySlug(raw: string): string | null {
  const slug = raw.trim();
  if (!slug || slug.length > OVERLAY_SLUG_MAX) return null;
  if (
    slug.includes("/") ||
    slug.includes("?") ||
    slug.includes("#") ||
    slug.includes("://") ||
    slug.includes("..")
  ) {
    return null;
  }
  return slug;
}

export function sanitizeAuthReturnOverlay(raw: unknown): AuthReturnOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const overlay = raw as { type?: unknown; slug?: unknown };
  if (overlay.type === "pricing" || overlay.type === "foto-v-promt") {
    return { type: overlay.type };
  }
  if (overlay.type === "card" && typeof overlay.slug === "string") {
    const slug = sanitizeOverlaySlug(overlay.slug);
    return slug ? { type: "card", slug } : null;
  }
  return null;
}

export function serializeAuthReturnOverlay(overlay: AuthReturnOverlay): string {
  if (overlay.type === "card") return `card:${overlay.slug}`;
  return overlay.type;
}

export function parseAuthReturnOverlay(
  raw: string | null | undefined
): AuthReturnOverlay | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === "pricing" || value === "foto-v-promt") {
    return { type: value };
  }
  if (value.startsWith("card:")) {
    return sanitizeAuthReturnOverlay({ type: "card", slug: value.slice(5) });
  }
  return null;
}

export function setLiveAuthReturnOverlay(
  next: LiveAuthReturnOverlay | null
): void {
  if (!next) {
    liveOverlay = null;
    return;
  }
  const overlay = sanitizeAuthReturnOverlay(next.overlay);
  if (!overlay) {
    liveOverlay = null;
    return;
  }
  liveOverlay = {
    originPath: sanitizeAuthReturnDestination(next.originPath),
    overlay,
  };
}

export function getLiveAuthReturnOverlay(): LiveAuthReturnOverlay | null {
  return liveOverlay;
}

export function resetLiveAuthReturnOverlayForTests(): void {
  liveOverlay = null;
  boundOverlay = null;
}

export function bindAuthReturnOverlay(overlay: AuthReturnOverlay | null): void {
  boundOverlay = overlay ? sanitizeAuthReturnOverlay(overlay) : null;
}

export function peekAuthReturnOverlayBind(): AuthReturnOverlay | null {
  return boundOverlay;
}

export function resolveAuthReturnCaptureOverlay(input: {
  live: AuthReturnOverlay | null;
  bound: AuthReturnOverlay | null;
}): AuthReturnOverlay | null {
  return input.bound ?? input.live;
}

export function cardSlugFromPath(path: string): string | null {
  const pathname = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  if (!pathname.startsWith("/p/")) return null;
  return sanitizeOverlaySlug(decodeURIComponent(pathname.slice(3)));
}

export function captureAuthReturnScreen(input?: {
  currentPath?: string;
  live?: LiveAuthReturnOverlay | null;
  boundOverlay?: AuthReturnOverlay | null;
  lastListingPath?: string | null;
  savedY?: number | null;
  currentY?: number;
}): AuthReturnScreen {
  const currentPath = sanitizeAuthReturnDestination(
    input?.currentPath ??
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/")
  );
  const live = input && "live" in input ? input.live ?? null : liveOverlay;
  const bound =
    input && "boundOverlay" in input ? input.boundOverlay ?? null : boundOverlay;
  const lastListing =
    input && "lastListingPath" in input
      ? input.lastListingPath ?? null
      : peekLastListingPath();

  let path = currentPath;
  let overlay: AuthReturnOverlay | null = null;

  if (live) {
    path = sanitizeAuthReturnDestination(live.originPath) || currentPath;
    overlay = resolveAuthReturnCaptureOverlay({
      live: live.overlay,
      bound,
    });
  } else if (bound) {
    overlay = bound;
    const listing = lastListing
      ? sanitizeAuthReturnDestination(lastListing)
      : null;
    path = listing && !isListingOverlayPath(listing) ? listing : currentPath;
  } else {
    const cardSlug = cardSlugFromPath(currentPath);
    if (cardSlug) {
      const listing = lastListing
        ? sanitizeAuthReturnDestination(lastListing)
        : null;
      path = listing && !isListingOverlayPath(listing) ? listing : currentPath;
      overlay = { type: "card", slug: cardSlug };
    } else if (
      isListingOverlayPath(currentPath) &&
      currentPath.split("?")[0] === "/pricing"
    ) {
      const listing = lastListing
        ? sanitizeAuthReturnDestination(lastListing)
        : null;
      path = listing && !isListingOverlayPath(listing) ? listing : currentPath;
      overlay = { type: "pricing" };
    }
  }

  const scrollY = resolveListingScrollYForAuthReturn({
    overlayOpen: overlay !== null,
    savedY:
      input && "savedY" in input ? input.savedY ?? null : peekSavedListingScrollY(),
    currentY:
      input && "currentY" in input ? input.currentY ?? 0 : readListingScrollY(),
  });

  return { path, overlay, scrollY };
}

export function appendAuthReturnDestination(
  path: string,
  overlay: AuthReturnOverlay | null,
  scrollY?: number | null
): string {
  return appendAuthReturnMarker(
    path,
    overlay ? serializeAuthReturnOverlay(overlay) : null,
    scrollY
  );
}

export function resolveAuthReturnOverlay(href?: string): AuthReturnOverlay | null {
  const fromUrl = parseAuthReturnOverlay(
    readAuthReturnOverlayFromHref(href ?? (typeof window !== "undefined" ? window.location.href : ""))
  );
  return fromUrl ?? peekAuthReturnOverlay();
}

export function resolveAuthReturnScrollY(href?: string): number | null {
  const fromUrl = readAuthReturnScrollFromHref(
    href ?? (typeof window !== "undefined" ? window.location.href : "")
  );
  if (fromUrl !== null) return fromUrl;
  return peekAuthReturnScrollY() ?? peekSavedListingScrollY();
}

export function persistAuthReturnOverlay(
  overlay: AuthReturnOverlay | null
): void {
  const safe = sanitizeAuthReturnOverlay(overlay);
  if (!safe) {
    try {
      sessionStorage.removeItem(AUTH_RETURN_OVERLAY_KEY);
    } catch {
      // ignore
    }
    writeAuthCookie(AUTH_RETURN_OVERLAY_COOKIE, "", 0);
    return;
  }
  const serialized = serializeAuthReturnOverlay(safe);
  try {
    sessionStorage.setItem(AUTH_RETURN_OVERLAY_KEY, serialized);
  } catch {
    // private mode / quota
  }
  writeAuthCookie(AUTH_RETURN_OVERLAY_COOKIE, serialized, AUTH_RETURN_TTL_SEC);
}

export function peekAuthReturnOverlay(): AuthReturnOverlay | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(AUTH_RETURN_OVERLAY_KEY);
  } catch {
    // ignore
  }
  return (
    parseAuthReturnOverlay(stored) ??
    parseAuthReturnOverlay(readAuthCookie(AUTH_RETURN_OVERLAY_COOKIE))
  );
}

export function consumeAuthReturnOverlay(): AuthReturnOverlay | null {
  const overlay = peekAuthReturnOverlay();
  persistAuthReturnOverlay(null);
  return overlay;
}

export function persistAuthReturnScreen(screen: AuthReturnScreen): void {
  persistAuthReturnPath(sanitizeAuthReturnDestination(screen.path));
  persistAuthReturnOverlay(screen.overlay);
  persistAuthReturnScrollY(screen.scrollY);
  writeSavedListingScrollY(screen.scrollY);
}

/** Persist listing (or hard page) + overlay + scroll Y; return the path for `?next=`. */
export function rememberAuthReturnScreen(path?: string): string {
  const screen = captureAuthReturnScreen();
  const safe = sanitizeAuthReturnDestination(path ?? screen.path);
  persistAuthReturnScreen({
    path: safe,
    overlay: screen.overlay,
    scrollY: screen.scrollY,
  });
  return safe;
}

/**
 * Prefer a remembered listing path when `?next=` is the overlay URL
 * (`/p/slug` or `/pricing`) that we will reopen after landing.
 */
export function preferListingPathOverOverlayNext(input: {
  fromQuery: string | null;
  rememberedPath: string | null;
  overlay: AuthReturnOverlay | null;
}): string {
  const fromQuery = input.fromQuery
    ? sanitizeAuthReturnDestination(input.fromQuery)
    : null;
  const remembered = input.rememberedPath
    ? sanitizeAuthReturnDestination(input.rememberedPath)
    : null;

  if (remembered && input.overlay && fromQuery && isListingOverlayPath(fromQuery)) {
    return remembered;
  }
  if (fromQuery && fromQuery !== "/") return fromQuery;
  return remembered ?? fromQuery ?? "/";
}
