const DEFAULT_IMAGEPROMPT_ORIGIN = "https://imageprompt.tools";

const DEFAULT_CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/ai-image-describer/bebnhekhnoaacojmbjoajndkankmppoj";

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

/** Placement for Chrome Web Store UTM — forwarded to CWS GA4 on page_view + install. */
export type AiImageDescriberChromePlacement =
  | "foto_v_promt_floating_cta"
  | "foto_v_promt_remix_hint"
  | "foto_v_promt_json_ld";

const CHROME_STORE_UTM = {
  source: "promptshot.ru",
  /** Рекламная разметка для отчётов GA4 Chrome Web Store (install attribution). */
  medium: "cpc",
  campaign: "foto_v_promt",
} as const;

export function getAiImageDescriberChromeUrl(
  placement: AiImageDescriberChromePlacement = "foto_v_promt_floating_cta",
): string {
  const base =
    process.env.NEXT_PUBLIC_AI_IMAGE_DESCRIBER_CHROME_URL?.trim() || DEFAULT_CHROME_STORE_URL;
  const url = new URL(base);
  url.searchParams.set("utm_source", CHROME_STORE_UTM.source);
  url.searchParams.set("utm_medium", CHROME_STORE_UTM.medium);
  url.searchParams.set("utm_campaign", CHROME_STORE_UTM.campaign);
  url.searchParams.set("utm_content", placement);
  return url.toString();
}

export function getPromptRemixUrl(): string {
  // Mirror getImagePromptAnalyzeUrl: dev → same-origin proxy (avoids CORS),
  // prod/preview → direct cross-origin call to imageprompt.tools.
  const forceDirect = process.env.NEXT_PUBLIC_IMAGEPROMPT_DIRECT === "1";
  if (process.env.NODE_ENV === "development" && !forceDirect) {
    return "/api/imageprompt-proxy/extension/remix";
  }
  return `${getImagePromptApiOrigin()}/api/extension/remix`;
}
