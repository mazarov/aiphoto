import { mapPromptshotPathToSource } from "./client-source";
import {
  FOTO_V_PROMT_ANALYZE_LOCALE,
  getImagePromptAnalyzeUrl,
} from "./foto-v-promt-config";

export const IMAGE_PROMPT_ANALYZE_STYLE = "photoreal" as const;

export type ImagePromptAnalyzeBody = {
  image_base64: string;
  style: typeof IMAGE_PROMPT_ANALYZE_STYLE;
  locale: typeof FOTO_V_PROMT_ANALYZE_LOCALE;
};

export type AnalyzeImageToPromptResult =
  | { ok: true; prompt: string }
  | {
      ok: false;
      message: string;
      authRequired?: boolean;
      rateLimited?: boolean;
    };

export function buildImagePromptAnalyzeBody(
  imageBase64: string
): ImagePromptAnalyzeBody {
  return {
    image_base64: imageBase64,
    style: IMAGE_PROMPT_ANALYZE_STYLE,
    locale: FOTO_V_PROMT_ANALYZE_LOCALE,
  };
}

/** Same-origin analyze headers; `x-client` comes from the calling page path. */
export function buildAnalyzeRequestHeaders(pathname?: string): Record<string, string> {
  const path =
    pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "");
  return {
    "Content-Type": "application/json",
    "x-client": mapPromptshotPathToSource(path),
  };
}

export async function analyzeImageToPrompt(
  imageBase64: string,
  options?: { signal?: AbortSignal }
): Promise<AnalyzeImageToPromptResult> {
  let response: Response;
  try {
    response = await fetch(getImagePromptAnalyzeUrl(), {
      method: "POST",
      headers: buildAnalyzeRequestHeaders(),
      credentials: "include",
      signal: options?.signal,
      body: JSON.stringify(buildImagePromptAnalyzeBody(imageBase64)),
    });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return {
      ok: false,
      message:
        "Не удалось обработать фото. Проверьте соединение и попробуйте снова.",
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    prompt?: string;
    message?: string;
    error?: string;
    auth_required?: boolean;
  };

  if (!response.ok || !payload.prompt?.trim()) {
    const rateLimited = payload.error === "rate_limited";
    const authRequired = Boolean(payload.auth_required);
    return {
      ok: false,
      authRequired,
      rateLimited,
      message:
        payload.message ||
        (authRequired
          ? "Войдите в PromptShot и повторите анализ."
          : "Не удалось составить промт. Попробуйте другое фото."),
    };
  }

  return { ok: true, prompt: payload.prompt.trim() };
}

export async function dataUrlFromImageUrl(
  url: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error("preview_fetch_failed");
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:")) {
        reject(new Error("preview_read_failed"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("preview_read_failed"));
    reader.readAsDataURL(blob);
  });
}
