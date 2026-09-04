import { isPhotoPromptEphemeralId } from "./generate-photo-prompt";
import { restoreSelectedPhotoIds } from "./generation-enqueue-core";
import type { GenerateDockComposeIntent } from "./generate-dock-seed";
import type { GenerateComposeMode } from "./generate-compose-mode";
import type { UserGenerationPhoto } from "./user-generation-photos";

/** Bytes we can POST to the library. http(s) previews are already stored. */
export function isPersistableIdentityDataUrl(
  value: string | null | undefined,
): boolean {
  return Boolean(value?.startsWith("data:image/"));
}

/**
 * Guest preview stays in memory. Authed identity photos used for generation
 * must land in `landing_user_photos`. photo_prompt analyze stays ephemeral.
 */
export function shouldPersistEphemeralIdentityPhoto(input: {
  isAuthed: boolean;
  intent: GenerateDockComposeIntent;
  composeMode?: GenerateComposeMode | null;
}): boolean {
  if (!input.isAuthed) return false;
  if (input.intent === "photo_prompt") return false;
  if (input.composeMode === "photo_prompt") return false;
  return true;
}

/**
 * Hydrate GET is not a barrier: keep in-session uploads and the identity
 * data-URL until persist replaces it. Stale GET must not drop a just-saved row.
 */
export function mergeLibraryHydratePhotos<T extends { id: string }>(input: {
  incomingLibrary: readonly T[];
  current: readonly T[];
  pendingEphemeral: T | null;
}): T[] {
  const incomingIds = new Set(input.incomingLibrary.map((photo) => photo.id));
  const localOnly = input.current.filter(
    (photo) =>
      !isPhotoPromptEphemeralId(photo.id) && !incomingIds.has(photo.id),
  );
  const seedEphemeral =
    input.pendingEphemeral && isPhotoPromptEphemeralId(input.pendingEphemeral.id)
      ? input.pendingEphemeral
      : null;
  const currentEphemeral =
    input.current.find((photo) => isPhotoPromptEphemeralId(photo.id)) ?? null;
  const ephemeral = seedEphemeral ?? currentEphemeral;
  const library = [...localOnly, ...input.incomingLibrary];
  if (!ephemeral) return library;
  return [
    ephemeral,
    ...library.filter((photo) => !isPhotoPromptEphemeralId(photo.id)),
  ];
}

/**
 * Identity selfie and in-session selection beat stored prefs. Prefs apply only
 * when this mount has not chosen a photo yet.
 */
export function mergeLibraryHydrateSelection(input: {
  pendingEphemeralId: string | null;
  currentSelectedIds: readonly string[];
  mergedPhotoIds: readonly string[];
  preferencePhotoIds: readonly string[];
}): string[] {
  const available = new Set(input.mergedPhotoIds);
  if (input.pendingEphemeralId && available.has(input.pendingEphemeralId)) {
    return [input.pendingEphemeralId];
  }
  const currentKept = input.currentSelectedIds.filter((id) => available.has(id));
  if (currentKept.length > 0) return currentKept;
  return restoreSelectedPhotoIds({
    availablePhotoIds: [...input.mergedPhotoIds],
    storedPhotoIds: [...input.preferencePhotoIds],
  });
}

export function libraryStoragePaths(
  photos: ReadonlyArray<{ storagePath?: string | null }>,
): string[] {
  return photos
    .map((photo) => (photo.storagePath || "").trim())
    .filter(Boolean);
}

export async function uploadDataUrlToGenerationLibrary(input: {
  dataUrl: string;
  filename?: string;
}): Promise<UserGenerationPhoto> {
  const blob = await (await fetch(input.dataUrl)).blob();
  const mime =
    blob.type === "image/png" || blob.type === "image/webp"
      ? blob.type
      : "image/jpeg";
  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const typedFile = new File(
    [blob],
    input.filename?.trim() || `photo.${ext}`,
    { type: mime },
  );
  const form = new FormData();
  form.append("file", typedFile);
  form.append("saveToLibrary", "true");
  const upRes = await fetch("/api/upload-generation-photo", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const upData = (await upRes.json().catch(() => ({}))) as {
    photo?: UserGenerationPhoto;
    error?: string;
    message?: string;
  };
  if (!upRes.ok || !upData.photo?.id || !upData.photo.storagePath) {
    throw new Error(upData.message || upData.error || "Ошибка загрузки фото");
  }
  return upData.photo;
}
