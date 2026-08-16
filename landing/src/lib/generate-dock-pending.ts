import {
  DEFAULT_GENERATE_DOCK_SEED,
  type GenerateDockComposeIntent,
  type GenerateDockSeed,
} from "./generate-dock-seed";

export const PENDING_GENERATE_DOCK_KEY = "promptshot:pending-generate-dock";

export type PendingGenerateDockSurface = "prompt" | "photos" | "model" | null;

export type PendingGenerateDock = {
  seed: GenerateDockSeed;
  dockSurface: PendingGenerateDockSurface;
};

const INTENTS = new Set<GenerateDockComposeIntent>(["resume", "text", "photo_prompt"]);

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
      },
      dockSurface: parsed.dockSurface ?? null,
    };
  } catch {
    return null;
  }
}

export function persistPendingGenerateDock(pending: PendingGenerateDock): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_GENERATE_DOCK_KEY, JSON.stringify(pending));
  } catch {
    // Private mode / quota — auth can still proceed without resume.
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
