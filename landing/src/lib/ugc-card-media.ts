export type UgcCardMediaType = "photo" | "video";

export type UgcCardMediaRow = {
  media_index: number;
  storage_path: string;
};

export type UgcMediaItem = {
  path: string;
  mediaType: UgcCardMediaType;
  bucket?: string;
};

export type UgcCardMediaSyncPlan =
  | { action: "noop" }
  | { action: "append"; paths: string[]; startIndex: number }
  | { action: "replace"; paths: string[] };

export function cleanUgcCardMediaPaths(paths: string[]): string[] {
  return paths.map((path) => String(path || "").trim()).filter(Boolean);
}

export function buildVideoUgcMediaItems(params: {
  posterPath: string;
  videoPath: string;
}): UgcMediaItem[] {
  const posterPath = String(params.posterPath || "").trim();
  const videoPath = String(params.videoPath || "").trim();
  if (!posterPath || !videoPath) return [];
  return [
    { path: posterPath, mediaType: "photo" },
    { path: videoPath, mediaType: "video" },
  ];
}

export function firstInputPhotoPath(inputPhotoPaths: unknown): string | null {
  if (!Array.isArray(inputPhotoPaths)) return null;
  for (const value of inputPhotoPaths) {
    const path = String(value || "").trim();
    if (path) return path;
  }
  return null;
}

export function buildUgcCardMediaInserts(params: {
  cardId: string;
  bucket: string;
  paths?: string[];
  items?: UgcMediaItem[];
  startIndex?: number;
}): Array<{
  card_id: string;
  media_index: number;
  media_type: UgcCardMediaType;
  storage_bucket: string;
  storage_path: string;
  original_relative_path: string;
  is_primary: boolean;
}> {
  const startIndex = params.startIndex ?? 0;
  const items: UgcMediaItem[] = params.items?.length
    ? params.items
    : cleanUgcCardMediaPaths(params.paths || []).map((path) => ({
        path,
        mediaType: "photo",
      }));
  return items
    .map((item) => ({
      path: String(item.path || "").trim(),
      mediaType: item.mediaType,
      bucket: String(item.bucket || params.bucket || "").trim(),
    }))
    .filter((item) => item.path && item.bucket)
    .map((item, offset) => {
      const mediaIndex = startIndex + offset;
      return {
        card_id: params.cardId,
        media_index: mediaIndex,
        media_type: item.mediaType,
        storage_bucket: item.bucket,
        storage_path: item.path,
        original_relative_path: item.path,
        is_primary: mediaIndex === 0,
      };
    });
}

/**
 * Keep one prompt_card as one album.
 * Common photoshoot draft: only tile 1 → append 2–4.
 * Sheet-as-primary or other mismatch → replace the set.
 */
export function planUgcCardMediaSync(
  existing: UgcCardMediaRow[],
  desired: string[],
): UgcCardMediaSyncPlan {
  const paths = cleanUgcCardMediaPaths(desired);
  if (paths.length === 0) return { action: "noop" };

  const rows = [...existing].sort((a, b) => a.media_index - b.media_index);
  const same =
    rows.length === paths.length &&
    rows.every(
      (row, index) => row.media_index === index && row.storage_path === paths[index],
    );
  if (same) return { action: "noop" };

  const prefixMatches =
    rows.length > 0 &&
    rows.length < paths.length &&
    rows.every(
      (row, index) => row.media_index === index && row.storage_path === paths[index],
    );
  if (prefixMatches) {
    return {
      action: "append",
      paths: paths.slice(rows.length),
      startIndex: rows.length,
    };
  }

  return { action: "replace", paths };
}
