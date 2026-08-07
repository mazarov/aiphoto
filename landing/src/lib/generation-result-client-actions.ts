export async function downloadGenerationResult(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download_failed");

  const blob = await res.blob();
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
