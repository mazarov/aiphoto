import { clearPendingGenerateDock } from "@/lib/generate-dock-pending";
import {
  sanitizeAuthReturnDestination,
} from "@/lib/auth-return-path";
import {
  bindAuthReturnOverlay,
  rememberAuthReturnScreen,
  sanitizeAuthReturnOverlay,
  setLiveAuthReturnOverlay,
  type AuthReturnOverlay,
} from "@/lib/auth-return-screen";
import {
  isListingOverlayPath,
  peekLastListingPath,
} from "@/lib/scroll-preservation";

export type CardRepeatAction = "wait" | "auth" | "generate";
export type CardRepeatComposeIntent = "resume" | "animate";

/**
 * Published video cards repeat as image-to-video (own photo + card motion prompt).
 * Photo / photoshoot cards stay on image compose.
 */
export function cardRepeatComposeIntent(input: {
  videoUrl?: string | null;
}): CardRepeatComposeIntent {
  return input.videoUrl?.trim() ? "animate" : "resume";
}

/**
 * Video repeat needs a source photo the visitor owns — open «Ваши фото» immediately.
 * Photo repeat keeps the compact plate (same as before).
 */
export function dockSurfaceForCardRepeat(
  intent: CardRepeatComposeIntent
): "photos" | null {
  return intent === "animate" ? "photos" : null;
}

/**
 * Card «Повторить» SSOT. Guest compose (FAB / tab) still opens the dock;
 * this gate is only the prompt-card CTA.
 */
export function resolveCardRepeatAction(input: {
  isAuthed: boolean;
  authLoading: boolean;
}): CardRepeatAction {
  if (input.authLoading) return "wait";
  if (!input.isAuthed) return "auth";
  return "generate";
}

/** Never `history.back()` after OAuth — the IdP page can still sit in history. */
export function listingPathForGenerateLeave(input: {
  lastListingPath?: string | null;
  fallback?: string;
}): string {
  const listing = input.lastListingPath
    ? sanitizeAuthReturnDestination(input.lastListingPath)
    : null;
  if (listing && !isListingOverlayPath(listing)) return listing;
  const fallback = sanitizeAuthReturnDestination(input.fallback ?? "/");
  return isListingOverlayPath(fallback) ? "/" : fallback;
}

export function shouldKeepCardAuthReturnOverlay(
  live: AuthReturnOverlay | null | undefined
): boolean {
  return live?.type === "card";
}

/** Guest «Повторить»: keep the card, persist listing+overlay, do not open the dock. */
export function beginGuestCardRepeatAuth(slug: string): AuthReturnOverlay | null {
  clearPendingGenerateDock();
  const overlay = sanitizeAuthReturnOverlay({ type: "card", slug });
  if (!overlay || overlay.type !== "card") return null;
  bindAuthReturnOverlay(overlay);
  setLiveAuthReturnOverlay({
    originPath: listingPathForGenerateLeave({
      lastListingPath: peekLastListingPath(),
    }),
    overlay,
  });
  rememberAuthReturnScreen();
  return overlay;
}
