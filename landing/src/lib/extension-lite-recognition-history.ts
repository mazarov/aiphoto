/** localStorage key — must stay in sync with extension-lite/content-bridge.js */

export const EXTENSION_LITE_RECOGNITION_HISTORY_KEY = "extension_lite_recognition_history_v1";

const MAX_ENTRIES = 35;

export type LiteRecognitionStyle = "photoreal" | "midjourney" | "sd" | "flux" | "nano" | "dalle";

export type LiteRecognitionImagePayload =
  | { mode: "data_url"; dataUrl: string }
  | { mode: "image_url"; imageUrl: string };

export type LiteRecognitionEntry = {
  id: string;
  createdAt: string;
  style: LiteRecognitionStyle;
  prompt: string;
  image: LiteRecognitionImagePayload;
};

export function liteRecognitionGenerateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeList(raw: unknown): LiteRecognitionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLiteRecognitionEntry);
}

function isLiteRecognitionEntry(o: unknown): o is LiteRecognitionEntry {
  if (!o || typeof o !== "object") return false;
  const x = o as Record<string, unknown>;
  const style = x.style as string;
  if (typeof x.id !== "string" || typeof x.createdAt !== "string") return false;
  if (typeof x.prompt !== "string") return false;
  if (!["photoreal", "midjourney", "sd", "flux", "nano", "dalle"].includes(style)) return false;
  const img = x.image as Record<string, unknown> | null;
  if (!img || typeof img !== "object") return false;
  if (img.mode === "data_url" && typeof img.dataUrl === "string") return true;
  if (img.mode === "image_url" && typeof img.imageUrl === "string") return true;
  return false;
}

export function listLiteRecognitionHistory(): LiteRecognitionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EXTENSION_LITE_RECOGNITION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return normalizeList(parsed);
  } catch {
    return [];
  }
}

/** Newest-first. */
export function mergeLiteRecognitionHistoryLists(
  incomingNewestFirst: LiteRecognitionEntry[],
  existingNewestFirst: LiteRecognitionEntry[],
): LiteRecognitionEntry[] {
  const seen = new Set<string>();
  const out: LiteRecognitionEntry[] = [];
  for (const e of [...incomingNewestFirst, ...existingNewestFirst]) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }
  out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return out.slice(0, MAX_ENTRIES);
}

export function saveLiteRecognitionHistory(entries: LiteRecognitionEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXTENSION_LITE_RECOGNITION_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    /* quota or private mode — ignore */
  }
}

/** One new successful recognition; prepend in storage (newest first). */
export function appendLiteRecognitionHistory(
  patch: Omit<LiteRecognitionEntry, "id" | "createdAt"> & { id?: string; createdAt?: string },
): LiteRecognitionEntry | null {
  if (typeof window === "undefined") return null;

  const entry: LiteRecognitionEntry = {
    id: patch.id ?? liteRecognitionGenerateId(),
    createdAt: patch.createdAt ?? new Date().toISOString(),
    style: patch.style,
    prompt: patch.prompt,
    image: patch.image,
  };

  try {
    const existing = listLiteRecognitionHistory().filter((e) => e.id !== entry.id);
    const merged = mergeLiteRecognitionHistoryLists([entry], existing);
    saveLiteRecognitionHistory(merged);
    return entry;
  } catch {
    return entry;
  }
}
