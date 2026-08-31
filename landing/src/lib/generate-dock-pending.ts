import {
  DEFAULT_GENERATE_DOCK_SEED,
  photoshootTileUrlsFromUnknown,
  type GenerateDockComposeIntent,
  type GenerateDockSeed,
} from "./generate-dock-seed";

export const PENDING_GENERATE_DOCK_KEY = "promptshot:pending-generate-dock";

export type PendingGenerateDockSurface = "prompt" | "photos" | "model" | null;

export type PendingGenerateDock = {
  seed: GenerateDockSeed;
  dockSurface: PendingGenerateDockSurface;
};

const INTENTS = new Set<GenerateDockComposeIntent>([
  "resume",
  "text",
  "photo_prompt",
  "photoshoot",
  "animate",
  "result",
]);

function isSeed(value: unknown): value is GenerateDockSeed {
  if (!value || typeof value !== "object") return false;
  const seed = value as Partial<GenerateDockSeed>;
  return (
    (seed.source === "blank" || seed.source === "card") &&
    typeof seed.promptText === "string" &&
    (seed.cardId === null || typeof seed.cardId === "string") &&
    typeof seed.intent === "string" &&
    INTENTS.has(seed.intent)
  );
}

function isSurface(value: unknown): value is PendingGenerateDockSurface {
  return value === null || value === "prompt" || value === "photos" || value === "model";
}

export function parsePendingGenerateDock(raw: string | null): PendingGenerateDock | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingGenerateDock>;
    if (!isSeed(parsed.seed) || !isSurface(parsed.dockSurface ?? null)) return null;
    return {
      seed: {
        source: parsed.seed.source,
        promptText: parsed.seed.promptText,
        cardId: parsed.seed.cardId,
        intent: parsed.seed.intent,
        parentGenerationId: parsed.seed.parentGenerationId ?? null,
        previewUrl: parsed.seed.previewUrl ?? null,
        resultGenerationId: parsed.seed.resultGenerationId ?? null,
        resultModality:
          parsed.seed.resultModality === "video" || parsed.seed.resultModality === "image"
            ? parsed.seed.resultModality
            : null,
        isPublished: Boolean(parsed.seed.isPublished),
        editKind: typeof parsed.seed.editKind === "string" ? parsed.seed.editKind : null,
        photoshootTileUrls: photoshootTileUrlsFromUnknown(parsed.seed.photoshootTileUrls),
      },
      dockSurface: parsed.dockSurface ?? null,
    };
  } catch {
    return null;
  }
}

/** Never persist data:/blob: previews — sessionStorage quota and PII. */
export function previewUrlForPendingDock(url?: string | null): string | null {
  const value = (url || "").trim();
  if (!value) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return null;
  return value;
}

export function stripPendingGenerateDock(pending: PendingGenerateDock): PendingGenerateDock {
  return {
    seed: {
      ...pending.seed,
      previewUrl: previewUrlForPendingDock(pending.seed.previewUrl),
    },
    dockSurface: pending.dockSurface,
  };
}

export function seedForAuthReturnDock(
  overlayIntent: GenerateDockComposeIntent,
  pending: PendingGenerateDock | null
): PendingGenerateDock {
  const intent = INTENTS.has(overlayIntent) ? overlayIntent : "resume";
  if (!pending) {
    return {
      seed: { ...DEFAULT_GENERATE_DOCK_SEED, intent },
      dockSurface: null,
    };
  }
  return stripPendingGenerateDock({
    seed: {
      ...pending.seed,
      intent: pending.seed.intent || intent,
    },
    dockSurface: pending.dockSurface,
  });
}

export function persistPendingGenerateDock(pending: PendingGenerateDock): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PENDING_GENERATE_DOCK_KEY,
      JSON.stringify(stripPendingGenerateDock(pending))
    );
  } catch {
    // Private mode / quota — auth can still proceed without resume.
  }
}

export function peekPendingGenerateDock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      parsePendingGenerateDock(
        window.sessionStorage.getItem(PENDING_GENERATE_DOCK_KEY)
      ) !== null
    );
  } catch {
    return false;
  }
}

export function consumePendingGenerateDock(): PendingGenerateDock | null {
  if (typeof window === "undefined") return null;
  try {
    const pending = parsePendingGenerateDock(
      window.sessionStorage.getItem(PENDING_GENERATE_DOCK_KEY),
    );
    window.sessionStorage.removeItem(PENDING_GENERATE_DOCK_KEY);
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingGenerateDock(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_GENERATE_DOCK_KEY);
  } catch {
    // ignore
  }
}

export const EMPTY_PENDING_SEED: GenerateDockSeed = DEFAULT_GENERATE_DOCK_SEED;
