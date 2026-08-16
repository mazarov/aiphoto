export const FOTO_V_PROMT_RESULT_SNAPSHOT_KEY = "promptshot:foto-v-promt-result";
const MAX_PREVIEW_CHARS = 400_000;

export type FotoVPromtResultSnapshot = {
  promptText: string;
  previewUrl?: string;
};

function persistablePreview(previewUrl: string | null | undefined): string | undefined {
  if (!previewUrl || !previewUrl.startsWith("data:")) return undefined;
  if (previewUrl.length > MAX_PREVIEW_CHARS) return undefined;
  return previewUrl;
}

export function parseFotoVPromtResultSnapshot(
  raw: string | null,
): FotoVPromtResultSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FotoVPromtResultSnapshot>;
    if (typeof parsed.promptText !== "string" || !parsed.promptText.trim()) return null;
    const previewUrl =
      typeof parsed.previewUrl === "string" ? persistablePreview(parsed.previewUrl) : undefined;
    return {
      promptText: parsed.promptText,
      ...(previewUrl ? { previewUrl } : {}),
    };
  } catch {
    return null;
  }
}

export function persistFotoVPromtResultSnapshot(snapshot: {
  promptText: string;
  previewUrl?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const promptText = snapshot.promptText.trim();
  if (!promptText) return;
  const next: FotoVPromtResultSnapshot = {
    promptText,
    ...(persistablePreview(snapshot.previewUrl) ?
      { previewUrl: persistablePreview(snapshot.previewUrl) }
    : {}),
  };
  try {
    window.sessionStorage.setItem(FOTO_V_PROMT_RESULT_SNAPSHOT_KEY, JSON.stringify(next));
  } catch {
    try {
      window.sessionStorage.setItem(
        FOTO_V_PROMT_RESULT_SNAPSHOT_KEY,
        JSON.stringify({ promptText }),
      );
    } catch {
      // ignore
    }
  }
}

export function readFotoVPromtResultSnapshot(): FotoVPromtResultSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    return parseFotoVPromtResultSnapshot(
      window.sessionStorage.getItem(FOTO_V_PROMT_RESULT_SNAPSHOT_KEY),
    );
  } catch {
    return null;
  }
}

export function clearFotoVPromtResultSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(FOTO_V_PROMT_RESULT_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}
