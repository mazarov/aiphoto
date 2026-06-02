const DEFAULT_IMAGEPROMPT_ORIGIN = "https://imageprompt.tools";

const DEFAULT_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/ai-image-describer/ccidgdhgephaicccgjenjilnjjippkkl";

export function getImagePromptApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN?.trim();
  return (raw || DEFAULT_IMAGEPROMPT_ORIGIN).replace(/\/+$/, "");
}

export function getImagePromptAnalyzeUrl(): string {
  // In `next dev`, same-origin proxy avoids CORS (localhost, LAN IP, etc.).
  // Prod / preview: direct cross-origin call; imageprompt CORS must allow promptshot.ru.
  const forceDirect = process.env.NEXT_PUBLIC_IMAGEPROMPT_DIRECT === "1";
  if (process.env.NODE_ENV === "development" && !forceDirect) {
    return "/api/imageprompt-proxy/extension/analyze";
  }
  return `${getImagePromptApiOrigin()}/api/extension/analyze`;
}

export function getImagePromptSiteUrl(): string {
  return getImagePromptApiOrigin();
}

export function getAiImageDescriberChromeUrl(): string {
  return (
    process.env.NEXT_PUBLIC_AI_IMAGE_DESCRIBER_CHROME_URL?.trim() || DEFAULT_CHROME_STORE_URL
  );
}
