import { isPhotoPromptEphemeralId } from "./generate-photo-prompt";

export const USER_GENERATION_PHOTOS_CACHE_KEY = "promptshot:user-generation-photos";
export const PHOTO_GUIDE_PORTRAIT_SRC = "/generate/photo-guide-portrait.webp";
/** Signed URLs live 24h; treat cached signed URLs as fresh for 6h before re-warming. */
export const USER_GENERATION_PHOTOS_SIGNED_FRESH_MS = 6 * 60 * 60 * 1000;

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

export type CachedLibraryMeta = {
  photos: CachedUserGenerationPhoto[];
  signedAt: number | null;
  hasMorePhotos: boolean;
};

type CachedLibraryPayload = {
  userId: string;
  photos: CachedUserGenerationPhoto[];
  signedAt?: number | null;
  hasMorePhotos?: boolean;
};

let memory: CachedLibraryPayload | null = null;
const warmedPreviewUrls = new Set<string>();

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

function parseCachedLibraryMeta(
  raw: unknown,
  userId: string,
): CachedLibraryPayload | null {
  const photos = parseCachedUserGenerationPhotos(raw, userId);
  if (!photos) return null;
  const payload = raw as CachedLibraryPayload;
  const signedAt =
    typeof payload.signedAt === "number" && Number.isFinite(payload.signedAt)
      ? payload.signedAt
      : null;
  return {
    userId,
    photos,
    signedAt,
    hasMorePhotos: payload.hasMorePhotos === true,
  };
}

export function readCachedUserGenerationPhotosMeta(
  userId: string | null | undefined,
): CachedLibraryMeta | null {
  if (!userId) {
    return { photos: [], signedAt: null, hasMorePhotos: false };
  }
  if (memory?.userId === userId) {
    return {
      photos: memory.photos,
      signedAt: memory.signedAt ?? null,
      hasMorePhotos: memory.hasMorePhotos === true,
    };
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USER_GENERATION_PHOTOS_CACHE_KEY);
    if (!raw) return null;
    const parsed = parseCachedLibraryMeta(JSON.parse(raw), userId);
    if (!parsed) return null;
    memory = parsed;
    return {
      photos: parsed.photos,
      signedAt: parsed.signedAt ?? null,
      hasMorePhotos: parsed.hasMorePhotos === true,
    };
  } catch {
    return null;
  }
}

export function readCachedUserGenerationPhotos(
  userId: string | null | undefined,
): CachedUserGenerationPhoto[] | null {
  const meta = readCachedUserGenerationPhotosMeta(userId);
  return meta ? meta.photos : null;
}

export function writeCachedUserGenerationPhotos(
  userId: string | null | undefined,
  photos: CachedUserGenerationPhoto[],
  options?: {
    signedAt?: number | null;
    hasMorePhotos?: boolean;
  },
): void {
  if (!userId) {
    memory = null;
    return;
  }
  const previous = memory?.userId === userId ? memory : null;
  const next: CachedLibraryPayload = {
    userId,
    photos: libraryPhotosForCache(photos),
    signedAt:
      options && "signedAt" in options
        ? options.signedAt ?? null
        : previous?.signedAt ?? Date.now(),
    hasMorePhotos:
      options && typeof options.hasMorePhotos === "boolean"
        ? options.hasMorePhotos
        : previous?.hasMorePhotos === true,
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

export function resetUserGenerationPhotosCacheForTests(): void {
  memory = null;
  warmedPreviewUrls.clear();
}

export function warmupPhotoPreviewImages(
  photos: Array<{ previewUrl: string | null | undefined }>,
): void {
  if (typeof window === "undefined" || typeof Image === "undefined") return;
  for (const photo of photos) {
    const url = photo.previewUrl?.trim() || "";
    if (!url || warmedPreviewUrls.has(url)) continue;
    warmedPreviewUrls.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

export function prefetchPhotoGuideImage(): void {
  if (typeof window === "undefined" || typeof Image === "undefined") return;
  if (warmedPreviewUrls.has(PHOTO_GUIDE_PORTRAIT_SRC)) return;
  warmedPreviewUrls.add(PHOTO_GUIDE_PORTRAIT_SRC);
  const img = new Image();
  img.decoding = "async";
  img.src = PHOTO_GUIDE_PORTRAIT_SRC;
}

export function prefetchUserPhotoLibrary(userId: string | null | undefined): void {
  prefetchPhotoGuideImage();
  if (!userId || typeof window === "undefined") return;
  const cached = readCachedUserGenerationPhotosMeta(userId);
  if (
    cached &&
    cached.signedAt !== null &&
    Date.now() - cached.signedAt < USER_GENERATION_PHOTOS_SIGNED_FRESH_MS
  ) {
    warmupPhotoPreviewImages(cached.photos);
    return;
  }
  void fetch("/api/user-generation-photos", { credentials: "include" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { photos?: CachedUserGenerationPhoto[] } | null) => {
      if (!Array.isArray(data?.photos)) return;
      writeCachedUserGenerationPhotos(userId, data.photos, {
        signedAt: Date.now(),
        hasMorePhotos: false,
      });
      warmupPhotoPreviewImages(data.photos);
    })
    .catch(() => {
      /* warm-up only */
    });
}
