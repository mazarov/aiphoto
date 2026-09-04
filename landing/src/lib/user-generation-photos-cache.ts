import { isPhotoPromptEphemeralId } from "./generate-photo-prompt";

export const USER_GENERATION_PHOTOS_CACHE_KEY = "promptshot:user-generation-photos";
export const PHOTO_GUIDE_PORTRAIT_SRC = "/generate/photo-guide-portrait.webp";

export type CachedUserGenerationPhoto = {
  id: string;
  storagePath: string;
  previewUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  audienceTag?: string | null;
};

type CachedLibraryPayload = {
  userId: string;
  photos: CachedUserGenerationPhoto[];
};

let memory: CachedLibraryPayload | null = null;

function isCachedPhoto(value: unknown): value is CachedUserGenerationPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as CachedUserGenerationPhoto;
  return typeof photo.id === "string" && photo.id.length > 0;
}

export function libraryPhotosForCache<T extends { id: string }>(photos: T[]): T[] {
  return photos.filter((photo) => !isPhotoPromptEphemeralId(photo.id));
}

export function parseCachedUserGenerationPhotos(
  raw: unknown,
  userId: string,
): CachedUserGenerationPhoto[] | null {
  if (!userId || !raw || typeof raw !== "object") return null;
  const payload = raw as CachedLibraryPayload;
  if (payload.userId !== userId || !Array.isArray(payload.photos)) return null;
  const photos = payload.photos.filter(isCachedPhoto);
  return photos;
}

export function readCachedUserGenerationPhotos(
  userId: string | null | undefined,
): CachedUserGenerationPhoto[] | null {
  if (!userId) return [];
  if (memory?.userId === userId) return memory.photos;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USER_GENERATION_PHOTOS_CACHE_KEY);
    if (!raw) return null;
    const parsed = parseCachedUserGenerationPhotos(JSON.parse(raw), userId);
    if (!parsed) return null;
    memory = { userId, photos: parsed };
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedUserGenerationPhotos(
  userId: string | null | undefined,
  photos: CachedUserGenerationPhoto[],
): void {
  if (!userId) {
    memory = null;
    return;
  }
  const next: CachedLibraryPayload = {
    userId,
    photos: libraryPhotosForCache(photos),
  };
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      USER_GENERATION_PHOTOS_CACHE_KEY,
      JSON.stringify(next),
    );
  } catch {
    /* quota / private mode */
  }
}

export function warmupPhotoPreviewImages(
  photos: Array<{ previewUrl: string | null | undefined }>,
): void {
  if (typeof window === "undefined") return;
  for (const photo of photos) {
    if (!photo.previewUrl) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = photo.previewUrl;
  }
}

export function prefetchPhotoGuideImage(): void {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = PHOTO_GUIDE_PORTRAIT_SRC;
}

export function prefetchUserPhotoLibrary(userId: string | null | undefined): void {
  prefetchPhotoGuideImage();
  if (!userId || typeof window === "undefined") return;
  void fetch("/api/user-generation-photos", { credentials: "include" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { photos?: CachedUserGenerationPhoto[] } | null) => {
      if (!Array.isArray(data?.photos)) return;
      writeCachedUserGenerationPhotos(userId, data.photos);
      warmupPhotoPreviewImages(data.photos);
    })
    .catch(() => {
      /* warm-up only */
    });
}
