const DEFAULT_IMAGEPROMPT_ORIGIN = "https://imageprompt.tools";

const DEFAULT_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/ai-image-describer/ccidgdhgephaicccgjenjilnjjippkkl";

export function getImagePromptApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_IMAGEPROMPT_API_ORIGIN?.trim();
  return (raw || DEFAULT_IMAGEPROMPT_ORIGIN).replace(/\/+$/, "");
}

export function getImagePromptAnalyzeUrl(): string {
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
