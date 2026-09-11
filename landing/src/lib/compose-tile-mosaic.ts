/** Equal-cell mosaic for library / style previews inside an 84px compose tile. */

export function composePreviewImageUrls(
  urls: Array<string | null | undefined>,
): string[] {
  const out: string[] = [];
  for (const url of urls) {
    const next = url?.trim() || "";
    if (next) out.push(next);
  }
  return out;
}

export function composePhotosPreviewUrls(
  photos: Array<{ previewUrl?: string | null }>,
): string[] {
  return composePreviewImageUrls(photos.map((photo) => photo.previewUrl));
}

export function composeTileMosaicGrid(count: number): {
  columns: number;
  rows: number;
} {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count === 2) return { columns: 2, rows: 1 };
  if (count === 3) return { columns: 3, rows: 1 };
  const columns = Math.ceil(Math.sqrt(count));
  return { columns, rows: Math.ceil(count / columns) };
}
