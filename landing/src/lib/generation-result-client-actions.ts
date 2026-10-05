export async function downloadGenerationResult(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download_failed");

  const blob = await res.blob();
  saveBlobAs(blob, filename);
}

/**
 * Ready-to-upload sticker for a messenger via `GET /api/generations/:id/sticker-file`.
 * Throws with the server `message` (or a generic one) so the sheet can show it.
 */
export async function downloadStickerPlatformFile(
  generationId: string,
  platformId: string,
  filename: string,
  options?: { tile?: number | null },
) {
  const tile = options?.tile ? `&tile=${encodeURIComponent(String(options.tile))}` : "";
  const res = await fetch(
    `/api/generations/${encodeURIComponent(generationId)}/sticker-file?platform=${encodeURIComponent(platformId)}${tile}`,
    { credentials: "include" },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      data.message || (res.status === 503 ? "Сервер занят, попробуйте ещё раз" : "Не удалось подготовить стикер"),
    );
  }
  saveBlobAs(await res.blob(), filename);
}

/** All 16 stickers of a pack as one archive via `GET /api/generations/:id/sticker-pack.zip`. */
export async function downloadStickerPackZip(generationId: string, filename: string) {
  const res = await fetch(`/api/generations/${encodeURIComponent(generationId)}/sticker-pack.zip`, {
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || "Не удалось собрать архив стикеров");
  }
  saveBlobAs(await res.blob(), filename);
}

function saveBlobAs(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function shareGenerationResult(url: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ url });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }

  await navigator.clipboard.writeText(url);
  return "copied";
}
