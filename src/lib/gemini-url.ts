const DEFAULT_BASE = "https://generativelanguage.googleapis.com";

/**
 * Returns Gemini API base URL.
 * Uses GEMINI_PROXY_BASE_URL env when set, otherwise direct Google endpoint.
 */
export function getGeminiBaseUrl(): string {
  const proxy = process.env.GEMINI_PROXY_BASE_URL;
  return (proxy || DEFAULT_BASE).replace(/\/+$/, "");
}

export function getGeminiGenerateContentUrl(model: string): string {
  return `${getGeminiBaseUrl()}/v1beta/models/${model}:generateContent`;
}
