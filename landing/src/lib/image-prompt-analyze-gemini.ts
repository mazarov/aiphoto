import {
  buildLockedExtractPrompt,
  buildRouterExtractPrompt,
  isAnalyzePatternRouterFlagValue,
  parseAnalyzeDraft,
  normalizeAnalyzeLayout,
  patternCriticalRules,
  rejectionSuffix,
  sectionOrderFor,
  validateAnalyzeDraft,
  type AnalyzeMedium,
  type AnalyzePattern,
} from "@/lib/analyze-pattern";
import {
  buildExtractLanguageContract,
  buildExtractPrompt,
  SECTION_SPEC_ORDER,
} from "@/lib/extension-prompt-sections";
import {
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";
import { extensionLog } from "@/lib/extension-pipeline-log";
import type { createSupabaseServer } from "@/lib/supabase";
import {
  ANALYZE_GEMINI_MAX_BYTES,
  ANALYZE_GEMINI_MAX_EDGE,
  prepareAnalyzeImageForGemini,
  type ParsedAnalyzeImage,
} from "@/lib/image-prompt-analyze-image";
import { isSharpBusyError } from "@/lib/sharp-runtime";

type SupabaseServer = ReturnType<typeof createSupabaseServer>;

export const ANALYZE_GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com";
/** One-shot extract. 20KB JPEG finishes in ~4–8s; 85KB via proxy never completes. */
export const GEMINI_TIMEOUT_MS = 30_000;
/** Flash extract: thinking 256 + portrait regularly dies on DO proxy (~25s EPIPE). */
export const ANALYZE_THINKING_BUDGET = 0;
/** Two routed attempts must finish inside the route maxDuration of 60s. */
export const ANALYZE_ROUTER_ATTEMPT_TIMEOUT_MS = 22_000;
const ANALYZE_ROUTER_TEMPERATURE = 0.3;
const ANALYZE_ROUTER_ATTEMPTS = 2;

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
    readonly code:
      | "fetch_failed"
      | "gemini_http"
      | "bad_response"
      | "empty_prompt"
      | "payload",
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

export async function isAnalyzePatternRouterEnabled(
  supabase: SupabaseServer,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("landing_generation_config")
      .select("value")
      .eq("key", "analyze_pattern_router_enabled")
      .maybeSingle();
    if (error) {
      extensionLog("analyze.pattern_flag_failed", { message: error.message });
      return false;
    }
    return isAnalyzePatternRouterFlagValue(data?.value);
  } catch (error) {
    extensionLog("analyze.pattern_flag_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

type AnalyzeImageParams = {
  image: ParsedAnalyzeImage;
  locale: string;
  supabase: SupabaseServer;
  apiKey: string;
  logPrefix: string;
  requestId: string;
  correlationId: string;
  timeoutMs?: number;
  thinkingBudget?: number;
  imageMaxEdge?: number;
  imageMaxBytes?: number;
};

export type AnalyzePromptResult = {
  promptText: string;
  rawText: string;
  missing: string[];
  truncated: boolean;
  summary: ReturnType<typeof summarizeGeminiApiResponse>;
  baseUrl: string;
  pattern: AnalyzePattern | null;
  medium: AnalyzeMedium | null;
  attempts: number;
};

function resolveAttemptTimeout(value: number | undefined, fallback: number): number {
  return typeof value === "number" && value > 0 ? value : fallback;
}

async function prepareAnalyzeImage(
  params: AnalyzeImageParams,
): Promise<ParsedAnalyzeImage> {
  try {
    return await prepareAnalyzeImageForGemini(params.image, {
      maxEdge: params.imageMaxEdge ?? ANALYZE_GEMINI_MAX_EDGE,
      maxBytes: params.imageMaxBytes ?? ANALYZE_GEMINI_MAX_BYTES,
    });
  } catch (error) {
    if (isSharpBusyError(error)) throw error;
    throw new PhotorealAnalyzeError("payload", 503);
  }
}

async function postPreparedAnalyzeImage(params: {
  prompt: string;
  image: ParsedAnalyzeImage;
  sourceBase64Chars: number;
  locale: string;
  systemInstruction: string;
  apiKey: string;
  baseUrl: string;
  logPrefix: string;
  requestId: string;
  correlationId: string;
  timeoutMs: number;
  thinkingBudget: number;
  temperature: number;
  attempt: number;
}): Promise<{ rawText: string; summary: ReturnType<typeof summarizeGeminiApiResponse> }> {
  const body = {
    systemInstruction: {
      parts: [{ text: params.systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: params.prompt },
          { inlineData: { mimeType: params.image.mimeType, data: params.image.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: params.thinkingBudget },
    },
  };
  extensionLog(`${params.logPrefix}.gemini_request`, {
    requestId: params.requestId,
    correlationId: params.correlationId,
    model: ANALYZE_GEMINI_MODEL,
    locale: params.locale,
    endpointHost: new URL(params.baseUrl).hostname,
    viaProxy: params.baseUrl !== GEMINI_DIRECT_BASE_URL,
    imageBase64CharsIn: params.sourceBase64Chars,
    imageBase64CharsOut: params.image.data.length,
    attempt: params.attempt,
    body: redactGenerateContentBody(body),
  });

  let response: Response;
  try {
    response = await fetch(
      `${params.baseUrl}/v1beta/models/${ANALYZE_GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(params.timeoutMs),
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
      attempt: params.attempt,
    });
    throw new PhotorealAnalyzeError("fetch_failed", 503);
  }
  if (!response.ok) {
    extensionLog(`${params.logPrefix}.gemini_http_error`, {
      requestId: params.requestId,
      status: response.status,
      body: (await response.text().catch(() => "")).slice(0, 300),
      attempt: params.attempt,
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
  return { rawText, summary };
}

export async function generatePhotorealPromptFromImage(
  params: AnalyzeImageParams,
): Promise<Omit<AnalyzePromptResult, "pattern" | "medium" | "attempts">> {
  const thinkingBudget =
    typeof params.thinkingBudget === "number"
      ? params.thinkingBudget
      : ANALYZE_THINKING_BUDGET;
  const timeoutMs = resolveAttemptTimeout(params.timeoutMs, GEMINI_TIMEOUT_MS);
  const baseUrl = await resolveAnalyzeGeminiBaseUrl(params.supabase);
  const image = await prepareAnalyzeImage(params);
  const posted = await postPreparedAnalyzeImage({
    prompt: buildExtractPrompt("photoreal", params.locale),
    image,
    sourceBase64Chars: params.image.data.length,
    locale: params.locale,
    systemInstruction: buildExtractLanguageContract(params.locale),
    apiKey: params.apiKey,
    baseUrl,
    logPrefix: params.logPrefix,
    requestId: params.requestId,
    correlationId: params.correlationId,
    timeoutMs,
    thinkingBudget,
    temperature: 0.3,
    attempt: 1,
  });
  const diagnostics = analyzePromptDiagnostics(posted.rawText, posted.summary.finishReason);
  return {
    promptText: appendAnalyzeCriticalRules(posted.rawText, params.locale),
    rawText: posted.rawText,
    missing: diagnostics.missing,
    truncated: diagnostics.truncated,
    summary: posted.summary,
    baseUrl,
  };
}

async function generateRoutedPromptFromImage(
  params: AnalyzeImageParams & {
    patternLock?: { pattern: "person"; medium: "photo" };
  },
): Promise<AnalyzePromptResult> {
  const thinkingBudget =
    typeof params.thinkingBudget === "number"
      ? params.thinkingBudget
      : ANALYZE_THINKING_BUDGET;
  const timeoutMs = resolveAttemptTimeout(
    params.timeoutMs,
    params.patternLock ? GEMINI_TIMEOUT_MS : ANALYZE_ROUTER_ATTEMPT_TIMEOUT_MS,
  );
  const baseUrl = await resolveAnalyzeGeminiBaseUrl(params.supabase);
  const image = await prepareAnalyzeImage(params);
  const locked = params.patternLock;
  let reasons: string[] = [];
  let lastSummary: ReturnType<typeof summarizeGeminiApiResponse> | null = null;

  for (let attempt = 1; attempt <= ANALYZE_ROUTER_ATTEMPTS; attempt += 1) {
    const prompt = locked
      ? buildLockedExtractPrompt(locked.pattern, locked.medium, params.locale)
      : buildRouterExtractPrompt(params.locale);
    const posted = await postPreparedAnalyzeImage({
      prompt: reasons.length ? `${prompt}\n\n${rejectionSuffix(reasons, Boolean(locked))}` : prompt,
      image,
      sourceBase64Chars: params.image.data.length,
      locale: params.locale,
      systemInstruction: locked
        ? "Headings stay English. Bodies follow the LANGUAGE block in the user message. Do not output Pattern or Medium lines."
        : "Headings stay English. Bodies follow the LANGUAGE block in the user message. The first line is Pattern and the second line is Medium.",
      apiKey: params.apiKey,
      baseUrl,
      logPrefix: params.logPrefix,
      requestId: params.requestId,
      correlationId: params.correlationId,
      timeoutMs,
      thinkingBudget,
      temperature: ANALYZE_ROUTER_TEMPERATURE,
      attempt,
    });
    lastSummary = posted.summary;
    const draft = parseAnalyzeDraft(posted.rawText);
    const pattern = locked?.pattern ?? draft.pattern;
    const medium = locked?.medium ?? draft.medium;
    if (
      !locked &&
      (!pattern || !medium || draft.patternLineInvalid || draft.mediumLineInvalid)
    ) {
      reasons = [
        draft.patternLineInvalid || !pattern ? "Pattern line missing or invalid" : "",
        draft.mediumLineInvalid || !medium ? "Medium line missing or invalid" : "",
      ].filter(Boolean);
      extensionLog(`${params.logPrefix}.pattern_rejected`, {
        requestId: params.requestId,
        attempt,
        reasons,
      });
      continue;
    }
    if (!pattern || !medium) {
      reasons = ["Pattern line missing or invalid"];
      continue;
    }
    const body = normalizeAnalyzeLayout(draft.body);
    const validation = validateAnalyzeDraft({ pattern, medium, body });
    if (!validation.ok) {
      reasons = validation.reasons;
      extensionLog(`${params.logPrefix}.pattern_rejected`, {
        requestId: params.requestId,
        attempt,
        pattern,
        medium,
        reasons,
      });
      continue;
    }
    const missing = sectionOrderFor(pattern).filter(
      (heading) => !new RegExp(`^${escapeRegExp(heading)}:`, "im").test(body),
    );
    return {
      promptText: `${body}\n\n${patternCriticalRules(pattern, medium, params.locale)}`,
      rawText: posted.rawText,
      missing,
      truncated: posted.summary.finishReason === "MAX_TOKENS" || missing.length > 0,
      summary: posted.summary,
      baseUrl,
      pattern,
      medium,
      attempts: attempt,
    };
  }

  extensionLog(`${params.logPrefix}.pattern_rejected`, {
    requestId: params.requestId,
    attempt: ANALYZE_ROUTER_ATTEMPTS,
    reasons,
    finishReason: lastSummary?.finishReason ?? null,
  });
  throw new PhotorealAnalyzeError("bad_response", 502);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function generateAnalyzePrompt(
  params: AnalyzeImageParams & {
    routerEnabled: boolean;
    patternLock?: { pattern: "person"; medium: "photo" };
  },
): Promise<AnalyzePromptResult> {
  if (!params.routerEnabled) {
    const generated = await generatePhotorealPromptFromImage(params);
    return { ...generated, pattern: null, medium: null, attempts: 1 };
  }
  return generateRoutedPromptFromImage(params);
}
