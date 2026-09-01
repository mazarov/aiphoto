/** In-memory photo→prompt payload. Never persist data URLs (sessionStorage quota / PII). */

export const PHOTO_PROMPT_PROGRESS_LABEL = "Создание промта";
export const PHOTO_PROMPT_NEEDS_PHOTO = "Для промта выберите одно фото";
export const PHOTO_PROMPT_MAX_SELECTED = 1;
export const PHOTO_PROMPT_EPHEMERAL_ID = "ephemeral-photo-prompt";
/** After analyze: same sheet as clicking the prompt field (textarea + Готово). */
export const PHOTO_PROMPT_SUCCESS_DOCK_SURFACE = "prompt" as const;
/** Landing / guest pick: smaller than generate-upload 1024 so analyze JSON stays proxy-safe. */
export const PHOTO_PROMPT_UPLOAD_MAX_PX = 512;
export const PHOTO_PROMPT_UPLOAD_QUALITY = 0.72;

export type PhotoPromptPayload = {
  previewUrl: string;
  dataUrl: string;
};

let pendingPhotoPrompt: PhotoPromptPayload | null = null;
let completedPhotoPromptDataUrl: string | null = null;

type SharedPhotoPromptAnalyze<T> = {
  key: string;
  promise: Promise<T>;
  controller: AbortController;
};

let sharedPhotoPromptAnalyze: SharedPhotoPromptAnalyze<unknown> | null = null;

export function shouldReuseInFlightPhotoPromptAnalyze(input: {
  inFlightDataUrl?: string | null;
  nextDataUrl?: string | null;
}): boolean {
  const inFlight = input.inFlightDataUrl?.trim() || "";
  const next = input.nextDataUrl?.trim() || "";
  return Boolean(inFlight && inFlight === next);
}

/**
 * One Gemini POST per data URL. Remount / Strict Mode must reuse, not abort:
 * abort-on-unmount kills a 4–30s extract (portrait hangs at 92%, tiny canvas
 * sometimes finishes). Abort only when a different photo starts.
 */
export function sharePhotoPromptAnalyze<T>(
  dataUrl: string,
  start: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const key = dataUrl.trim();
  if (
    sharedPhotoPromptAnalyze &&
    shouldReuseInFlightPhotoPromptAnalyze({
      inFlightDataUrl: sharedPhotoPromptAnalyze.key,
      nextDataUrl: key,
    })
  ) {
    return sharedPhotoPromptAnalyze.promise as Promise<T>;
  }
  sharedPhotoPromptAnalyze?.controller.abort();
  const controller = new AbortController();
  const promise = start(controller.signal).finally(() => {
    if (sharedPhotoPromptAnalyze?.controller === controller) {
      sharedPhotoPromptAnalyze = null;
    }
  });
  sharedPhotoPromptAnalyze = { key, promise, controller };
  return promise;
}

export function resetPhotoPromptAnalyzeShare(): void {
  sharedPhotoPromptAnalyze?.controller.abort();
  sharedPhotoPromptAnalyze = null;
}

export function setPendingPhotoPrompt(payload: PhotoPromptPayload): void {
  const previewUrl = payload.previewUrl.trim();
  const dataUrl = payload.dataUrl.trim();
  if (!previewUrl || !dataUrl) {
    pendingPhotoPrompt = null;
    return;
  }
  completedPhotoPromptDataUrl = null;
  pendingPhotoPrompt = { previewUrl, dataUrl };
}

export function consumePendingPhotoPrompt(): PhotoPromptPayload | null {
  const next = pendingPhotoPrompt;
  pendingPhotoPrompt = null;
  return next;
}

export function peekPendingPhotoPrompt(): PhotoPromptPayload | null {
  return pendingPhotoPrompt;
}

export function clearPendingPhotoPrompt(): void {
  pendingPhotoPrompt = null;
}

export function composePhotoPromptBusyLabel(progress: number): string {
  return `${PHOTO_PROMPT_PROGRESS_LABEL} · ${Math.round(progress)}%`;
}

/** Guest analyze allowance shown on the dock CTA. Matches `ANALYZE_FREE_PER_DAY_DEFAULT`. */
export const PHOTO_PROMPT_GUEST_FREE_PER_DAY = 10;

/** Right-side CTA pill for a guest: remaining free analyzes, not a credit cost. */
export function composePhotoPromptGuestQuotaLabel(remaining: number): string {
  return `${remaining} бесплатно`;
}

export function guestPhotoPromptRemainingFree(input: {
  isAuthed: boolean;
  remainingFree?: number | null;
}): number | null {
  if (input.isAuthed) return null;
  const remaining = input.remainingFree;
  if (remaining == null || !Number.isFinite(remaining)) {
    return PHOTO_PROMPT_GUEST_FREE_PER_DAY;
  }
  return Math.max(0, Math.floor(remaining));
}

/** Source photo uses generation-result chrome; progress stays on the CTA only. */
export function shouldHoldPhotoPromptResultChrome(input: {
  composeMode?: string | null;
  resultUrl?: string | null;
}): boolean {
  return isPhotoPromptComposeMode(input.composeMode) && Boolean(input.resultUrl?.trim());
}

export function isPhotoPromptComposeMode(mode: string | null | undefined): boolean {
  return mode === "photo_prompt";
}

/** Start analyze when intent is photo_prompt and a data URL exists. Share in-flight by data URL — do not abort on remount. */
export function shouldStartPhotoPromptAnalyze(input: {
  intent?: string | null;
  dataUrl?: string | null;
}): boolean {
  const dataUrl = input.dataUrl?.trim() || "";
  if (input.intent !== "photo_prompt" || !dataUrl) return false;
  return dataUrl !== completedPhotoPromptDataUrl;
}

export function markPhotoPromptAnalyzeCompleted(dataUrl: string): void {
  const next = dataUrl.trim();
  completedPhotoPromptDataUrl = next || null;
}

export function resetPhotoPromptAnalyzeCompletion(): void {
  completedPhotoPromptDataUrl = null;
}

/** Peek first; seed preview is the fallback after Strict Mode remount consumed nothing. */
export function resolvePhotoPromptDataUrl(seedPreviewUrl?: string | null): string {
  const pending = peekPendingPhotoPrompt()?.dataUrl.trim() || "";
  if (pending) return pending;
  const preview = (seedPreviewUrl || "").trim();
  return preview.startsWith("data:") ? preview : "";
}

/**
 * Guest landing upload never enters «Ваши фото». Analyze must still see the
 * in-memory payload; library preview is the fallback for an explicit pick.
 */
export function resolvePhotoPromptAnalyzeSource(input: {
  selectedPreviewUrl?: string | null;
  seedPreviewUrl?: string | null;
}): { dataUrl: string; previewUrl: string } | null {
  const pending = peekPendingPhotoPrompt();
  if (pending) {
    return { dataUrl: pending.dataUrl, previewUrl: pending.previewUrl };
  }
  const selected = (input.selectedPreviewUrl || "").trim();
  if (selected.startsWith("data:")) {
    return { dataUrl: selected, previewUrl: selected };
  }
  const fromSeed = resolvePhotoPromptDataUrl(input.seedPreviewUrl);
  if (fromSeed) {
    return { dataUrl: fromSeed, previewUrl: fromSeed };
  }
  if (selected) {
    return { dataUrl: "", previewUrl: selected };
  }
  return null;
}

export function isPhotoPromptEphemeralId(id: string | null | undefined): boolean {
  return id === PHOTO_PROMPT_EPHEMERAL_ID;
}

/** Radio: one selected photo, or none. Toggle-off clears. */
export function nextPhotoPromptSelection(input: {
  current: Iterable<string>;
  toggledId: string;
}): string[] {
  const toggledId = input.toggledId.trim();
  if (!toggledId) return [];
  const current = new Set(
    [...input.current].map((id) => id.trim()).filter(Boolean)
  );
  if (current.has(toggledId)) return [];
  return [toggledId];
}

export function clampPhotoPromptSelection(ids: Iterable<string>): string[] {
  const list = [...ids].map((id) => id.trim()).filter(Boolean);
  if (list.length <= PHOTO_PROMPT_MAX_SELECTED) return list;
  return list.slice(-PHOTO_PROMPT_MAX_SELECTED);
}

export function photoPromptSelectionCap(
  mode: string | null | undefined,
  maxPhotos: number
): number {
  return isPhotoPromptComposeMode(mode) || mode === "video"
    ? PHOTO_PROMPT_MAX_SELECTED
    : Math.max(1, maxPhotos);
}

export function makeEphemeralPhotoPromptPhoto(dataUrl: string): {
  id: string;
  storagePath: string;
  previewUrl: string;
  originalFilename: string;
  width: null;
  height: null;
  createdAt: string;
} {
  return {
    id: PHOTO_PROMPT_EPHEMERAL_ID,
    storagePath: "",
    previewUrl: dataUrl,
    originalFilename: "photo",
    width: null,
    height: null,
    createdAt: new Date().toISOString(),
  };
}
