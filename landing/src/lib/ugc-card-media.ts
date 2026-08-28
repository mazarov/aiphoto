export type UgcCardMediaRow = {
  media_index: number;
  storage_path: string;
};

export type UgcCardMediaSyncPlan =
  | { action: "noop" }
  | { action: "append"; paths: string[]; startIndex: number }
  | { action: "replace"; paths: string[] };

export function cleanUgcCardMediaPaths(paths: string[]): string[] {
  return paths.map((path) => String(path || "").trim()).filter(Boolean);
}

export function buildUgcCardMediaInserts(params: {
  cardId: string;
  bucket: string;
  paths: string[];
  startIndex?: number;
}): Array<{
  card_id: string;
  media_index: number;
  media_type: "photo";
  storage_bucket: string;
  storage_path: string;
  original_relative_path: string;
  is_primary: boolean;
}> {
  const startIndex = params.startIndex ?? 0;
  return params.paths.map((path, offset) => {
    const mediaIndex = startIndex + offset;
    return {
      card_id: params.cardId,
      media_index: mediaIndex,
      media_type: "photo" as const,
      storage_bucket: params.bucket,
      storage_path: path,
      original_relative_path: path,
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
