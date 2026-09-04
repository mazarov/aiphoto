import {
  DEFAULT_GENERATE_DOCK_SEED,
  defaultDockSurfaceForComposeEntry,
  composeExamplePreviewUrlForSeed,
  mergeComposeExampleIntoSeed,
  photoshootTileUrlsFromUnknown,
  type GenerateDockComposeIntent,
  type GenerateDockSeed,
} from "./generate-dock-seed";

export const PENDING_GENERATE_DOCK_KEY = "promptshot:pending-generate-dock";
export const PENDING_COMPOSE_EXAMPLE_KEY = "promptshot:pending-compose-example";

export type PendingGenerateDockSurface =
  | "prompt"
  | "photos"
  | "model"
  | "example"
  | null;

export type PendingGenerateDock = {
  seed: GenerateDockSeed;
  dockSurface: PendingGenerateDockSurface;
};

export type PendingComposeExample = {
  cardId: string;
  promptText: string;
  examplePreviewUrl: string | null;
};

/** OAuth lands on `/auth/callback` first; consume there discards seed before listing remount. */
export function shouldRestorePendingGenerateDock(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return path !== "/auth" && !path.startsWith("/auth/");
}

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
  return (
    value === null ||
    value === "prompt" ||
    value === "photos" ||
    value === "model" ||
    value === "example"
  );
}

export function parsePendingGenerateDock(raw: string | null): PendingGenerateDock | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingGenerateDock>;
    if (!isSeed(parsed.seed) || !isSurface(parsed.dockSurface ?? null)) return null;
    const examplePreviewUrl = composeExamplePreviewUrlForSeed(
      parsed.seed.examplePreviewUrl,
    );
    return {
      seed: {
        source: parsed.seed.source,
        promptText: parsed.seed.promptText,
        cardId: parsed.seed.cardId,
        intent: parsed.seed.intent,
        ...(parsed.seed.attachIdentityPhoto === true
          ? { attachIdentityPhoto: true }
          : {}),
        ...(examplePreviewUrl ? { examplePreviewUrl } : {}),
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
      examplePreviewUrl: composeExamplePreviewUrlForSeed(
        pending.seed.examplePreviewUrl,
      ),
    },
    dockSurface: pending.dockSurface,
  };
}

export function parsePendingComposeExample(
  raw: string | null,
): PendingComposeExample | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingComposeExample>;
    const cardId = typeof parsed.cardId === "string" ? parsed.cardId.trim() : "";
    if (!cardId) return null;
    return {
      cardId,
      promptText: typeof parsed.promptText === "string" ? parsed.promptText : "",
      examplePreviewUrl: composeExamplePreviewUrlForSeed(parsed.examplePreviewUrl),
    };
  } catch {
    return null;
  }
}

export function persistPendingComposeExample(example: PendingComposeExample): void {
  if (typeof window === "undefined") return;
  const cardId = example.cardId.trim();
  if (!cardId) return;
  try {
    window.sessionStorage.setItem(
      PENDING_COMPOSE_EXAMPLE_KEY,
      JSON.stringify({
        cardId,
        promptText: example.promptText.trim(),
        examplePreviewUrl: composeExamplePreviewUrlForSeed(example.examplePreviewUrl),
      }),
    );
  } catch {
    // quota
  }
}

/** Write sidecar when the seed has a catalog pick. Never delete it for a selfie-only persist. */
export function persistComposeExampleFromSeed(seed: GenerateDockSeed): void {
  const cardId = (seed.cardId || "").trim();
  if (!cardId) return;
  persistPendingComposeExample({
    cardId,
    promptText: seed.promptText,
    examplePreviewUrl: seed.examplePreviewUrl ?? null,
  });
}

export function seedForAuthReturnDock(
  overlayIntent: GenerateDockComposeIntent,
  pending: PendingGenerateDock | null,
  example?: PendingComposeExample | null,
): PendingGenerateDock {
  const intent = INTENTS.has(overlayIntent) ? overlayIntent : "resume";
  const base: PendingGenerateDock = !pending
    ? {
        seed: { ...DEFAULT_GENERATE_DOCK_SEED, intent },
        dockSurface: defaultDockSurfaceForComposeEntry(intent, "tab"),
      }
    : stripPendingGenerateDock({
        seed: {
          ...pending.seed,
          intent: pending.seed.intent || intent,
        },
        dockSurface: pending.dockSurface,
      });
  return {
    seed: mergeComposeExampleIntoSeed(base.seed, example ?? null),
    dockSurface: base.dockSurface,
  };
}

export function persistPendingGenerateDock(pending: PendingGenerateDock): void {
  if (typeof window === "undefined") return;
  try {
    const stripped = stripPendingGenerateDock(pending);
    window.sessionStorage.setItem(
      PENDING_GENERATE_DOCK_KEY,
      JSON.stringify(stripped),
    );
    persistComposeExampleFromSeed(stripped.seed);
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

type StickyTake<T> = { ready: boolean; value: T | null };

let pageDock: StickyTake<PendingGenerateDock> = { ready: false, value: null };
let pageExample: StickyTake<PendingComposeExample> = {
  ready: false,
  value: null,
};

export function resetPendingGenerateDockForTests(): void {
  pageDock = { ready: false, value: null };
  pageExample = { ready: false, value: null };
}

export function consumePendingGenerateDock(): PendingGenerateDock | null {
  if (typeof window === "undefined") return null;
  if (pageDock.ready) return pageDock.value;
  try {
    const pending = parsePendingGenerateDock(
      window.sessionStorage.getItem(PENDING_GENERATE_DOCK_KEY),
    );
    window.sessionStorage.removeItem(PENDING_GENERATE_DOCK_KEY);
    pageDock = { ready: true, value: pending };
    return pending;
  } catch {
    pageDock = { ready: true, value: null };
    return null;
  }
}

export function takePendingComposeExample(): PendingComposeExample | null {
  if (typeof window === "undefined") return null;
  if (pageExample.ready) return pageExample.value;
  try {
    const example = parsePendingComposeExample(
      window.sessionStorage.getItem(PENDING_COMPOSE_EXAMPLE_KEY),
    );
    window.sessionStorage.removeItem(PENDING_COMPOSE_EXAMPLE_KEY);
    pageExample = { ready: true, value: example };
    return example;
  } catch {
    pageExample = { ready: true, value: null };
    return null;
  }
}

export function clearPendingGenerateDock(): void {
  pageDock = { ready: false, value: null };
  pageExample = { ready: false, value: null };
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_GENERATE_DOCK_KEY);
    window.sessionStorage.removeItem(PENDING_COMPOSE_EXAMPLE_KEY);
  } catch {
    // ignore
  }
}

export const EMPTY_PENDING_SEED: GenerateDockSeed = DEFAULT_GENERATE_DOCK_SEED;
