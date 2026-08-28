import { buildExtractPrompt, SECTION_SPEC_ORDER } from "@/lib/extension-prompt-sections";
import {
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";
import { extensionLog } from "@/lib/extension-pipeline-log";
import type { createSupabaseServer } from "@/lib/supabase";
import type { ParsedAnalyzeImage } from "@/lib/image-prompt-analyze-image";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export const ANALYZE_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com";
export const GEMINI_TIMEOUT_MS = 30_000;

const CRITICAL_RULES_EN = `CRITICAL RULES
- Preserve: face structure, features, skin tone, eye color, proportions.
- Subject must look naturally photographed in the setting, not pasted.
- Photorealistic output, high textural detail, high quality, 8K-grade resolution and micro-detail.`;

const CRITICAL_RULES_RU = `CRITICAL RULES
- Сохранить: структуру лица, черты, тон кожи, цвет глаз, пропорции.
- Объект должен выглядеть естественно сфотографированным в сцене, а не вставленным.
- Фотореалистичный результат, высокая детализация текстур, высокое качество, разрешение и микродетали уровня 8K.`;

export class PhotorealAnalyzeError extends Error {
  constructor(
    readonly code: "fetch_failed" | "gemini_http" | "bad_response" | "empty_prompt",
    readonly httpStatus: number,
    readonly upstreamStatus?: number,
  ) {
    super(code);
    this.name = "PhotorealAnalyzeError";
  }
}

export function normalizeAnalyzeLocale(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 32) return "en";
  try {
    return new Intl.Locale(value.trim()).toString();
  } catch {
    return "en";
  }
}

export function appendAnalyzeCriticalRules(rawText: string, locale: string): string {
  const criticalRules = locale.split("-")[0] === "ru" ? CRITICAL_RULES_RU : CRITICAL_RULES_EN;
  return `${rawText}\n\n${criticalRules}`;
}

export function analyzePromptDiagnostics(text: string, finishReason: unknown) {
  const missing = SECTION_SPEC_ORDER.filter(
    (section) => !new RegExp(`^${section}:`, "im").test(text),
  );
  const truncated = finishReason === "MAX_TOKENS" || missing.length > 0;
  return { missing, truncated };
}

export async function resolveAnalyzeGeminiBaseUrl(
  supabase: SupabaseServer,
): Promise<string> {
  const proxy = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
  try {
    const { data } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", "gemini_use_proxy")
      .maybeSingle();
    const raw = String(data?.value ?? "").trim().toLowerCase();
    const useProxy = !raw || ["true", "1", "yes", "y", "on"].includes(raw);
    if (useProxy && proxy) return proxy;
  } catch {
    if (proxy) return proxy;
  }
  return GEMINI_DIRECT_BASE_URL;
}

export async function generatePhotorealPromptFromImage(params: {
  image: ParsedAnalyzeImage;
  locale: string;
  supabase: SupabaseServer;
  apiKey: string;
  logPrefix: string;
  requestId: string;
  correlationId: string;
  timeoutMs?: number;
  thinkingBudget?: number;
}): Promise<{
  promptText: string;
  rawText: string;
  missing: string[];
  truncated: boolean;
  summary: ReturnType<typeof summarizeGeminiApiResponse>;
  baseUrl: string;
}> {
  const localeInstruction =
    params.locale === "en"
      ? ""
      : `\n\nWrite descriptive section bodies in ${params.locale}. Keep every section heading exactly in English.`;
  const prompt = `${buildExtractPrompt("photoreal")}${localeInstruction}`;
  const geminiBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: params.image.mimeType, data: params.image.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      thinkingConfig: {
        thinkingBudget:
          typeof params.thinkingBudget === "number" ? params.thinkingBudget : 256,
      },
    },
  };
  const timeoutMs =
    typeof params.timeoutMs === "number" && params.timeoutMs > 0
      ? params.timeoutMs
      : GEMINI_TIMEOUT_MS;
  const baseUrl = await resolveAnalyzeGeminiBaseUrl(params.supabase);
  extensionLog(`${params.logPrefix}.gemini_request`, {
    requestId: params.requestId,
    correlationId: params.correlationId,
    model: ANALYZE_GEMINI_MODEL,
    endpointHost: new URL(baseUrl).hostname,
    viaProxy: baseUrl !== GEMINI_DIRECT_BASE_URL,
    body: redactGenerateContentBody(geminiBody),
  });

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/v1beta/models/${ANALYZE_GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify(geminiBody),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    extensionLog(`${params.logPrefix}.gemini_fetch_failed`, {
      requestId: params.requestId,
      message: error instanceof Error ? error.message : String(error),
      cause:
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error && error.cause
            ? String(error.cause)
            : undefined,
    });
    throw new PhotorealAnalyzeError("fetch_failed", 503);
  }
  if (!response.ok) {
    extensionLog(`${params.logPrefix}.gemini_http_error`, {
      requestId: params.requestId,
      status: response.status,
      body: (await response.text().catch(() => "")).slice(0, 300),
    });
    throw new PhotorealAnalyzeError("gemini_http", 502, response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new PhotorealAnalyzeError("bad_response", 502);
  }
  const summary = summarizeGeminiApiResponse(data);
  const candidate = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = candidate.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!rawText) throw new PhotorealAnalyzeError("empty_prompt", 502);

  const diagnostics = analyzePromptDiagnostics(rawText, summary.finishReason);
  return {
    promptText: appendAnalyzeCriticalRules(rawText, params.locale),
    rawText,
    missing: diagnostics.missing,
    truncated: diagnostics.truncated,
    summary,
    baseUrl,
  };
}
