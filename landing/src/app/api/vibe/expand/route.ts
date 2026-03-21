import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  assembleVibeFinalPrompt,
  buildVibeExpandRuntimeContext,
  EXPAND_PROMPTS_INSTRUCTION,
  getGeminiVibeExpandModelRuntime,
  coerceStylePayload,
  getVibeAttachReferenceImageToGeneration,
  type StylePayload,
} from "@/lib/vibe-gemini-instructions";
import {
  fetchErrorDetails,
  isGeminiVibeDebug,
  parseGeminiJsonArray,
  parseGeminiJsonObject,
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

/** Single-scene expand output; accent is fixed for API compatibility / save route. */
const SINGLE_PROMPT_ACCENT = "scene" as const;
type PromptVariant = { accent: typeof SINGLE_PROMPT_ACCENT; prompt: string };

/** ~100+ words expected; expand instructs 200–380 words */
const MIN_EXPAND_PROMPT_CHARS = 600;

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  const withCause = err as Error & { cause?: { code?: string; errno?: number } };
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    causeCode: withCause.cause?.code,
    causeErrno: withCause.cause?.errno,
  };
}

function parseBooleanConfig(value: string | null | undefined, fallback: boolean): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "y", "on"].includes(raw)) return true;
  if (["false", "0", "no", "n", "off"].includes(raw)) return false;
  return fallback;
}

async function shouldUseGeminiProxy(supabase: ReturnType<typeof createSupabaseServer>): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("photo_app_config")
      .select("value")
      .eq("key", "gemini_use_proxy")
      .maybeSingle();
    return parseBooleanConfig(data?.value, true);
  } catch (err) {
    console.warn("[vibe.expand] failed to read photo_app_config.gemini_use_proxy", toErrorMeta(err));
    return true;
  }
}

async function getGeminiBaseUrlRuntime(
  supabase: ReturnType<typeof createSupabaseServer>,
): Promise<string> {
  const useProxy = await shouldUseGeminiProxy(supabase);
  const proxyBase = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
  if (useProxy && proxyBase) return proxyBase;
  return DIRECT_GEMINI_BASE_URL;
}

function coerceExpandSinglePromptFromObject(obj: Record<string, unknown>): string | null {
  const prompt = obj.prompt;
  if (typeof prompt !== "string") return null;
  const normalized = prompt.trim();
  if (normalized.length < MIN_EXPAND_PROMPT_CHARS) return null;
  return normalized;
}

/**
 * Primary: { "prompt": "..." }. Fallback: legacy array of one { accent, prompt }.
 */
function coerceExpandPrompt(
  parsedObject: Record<string, unknown> | null,
  parsedArray: unknown[] | null,
): string | null {
  if (parsedObject) {
    const fromObj = coerceExpandSinglePromptFromObject(parsedObject);
    if (fromObj) return fromObj;
  }
  if (parsedArray?.length === 1) {
    const item = parsedArray[0];
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.prompt === "string") {
        const normalized = row.prompt.trim();
        if (normalized.length >= MIN_EXPAND_PROMPT_CHARS) return normalized;
      }
    }
  }
  return null;
}

function diagnoseExpandParse(
  parsedObject: Record<string, unknown> | null,
  parsedArray: unknown[] | null,
): Record<string, unknown> {
  return {
    objectKeys: parsedObject ? Object.keys(parsedObject) : [],
    objectPromptLen:
      parsedObject && typeof parsedObject.prompt === "string"
        ? (parsedObject.prompt as string).length
        : null,
    arrayLength: parsedArray?.length ?? null,
    array0Keys:
      parsedArray?.[0] && typeof parsedArray[0] === "object"
        ? Object.keys(parsedArray[0] as object)
        : [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      vibeId?: string;
      style?: unknown;
    };

    const supabase = createSupabaseServer();

    let style: StylePayload | null = coerceStylePayload(body.style);
    let hasReferenceUrl = false;

    if (body.vibeId) {
      const { data: vibe } = await supabase
        .from("vibes")
        .select("style,user_id,source_image_url")
        .eq("id", body.vibeId)
        .single();
      if (vibe && vibe.user_id === user.id) {
        hasReferenceUrl = Boolean(String(vibe.source_image_url || "").trim());
        if (!style) {
          style = coerceStylePayload(vibe.style);
        }
      }
    }

    if (!style) {
      return NextResponse.json({ error: "missing_style" }, { status: 400 });
    }

    const willAttachReferenceInline =
      (await getVibeAttachReferenceImageToGeneration(supabase)) && hasReferenceUrl;

    console.warn("[vibe.expand] request_begin", {
      userId: user.id,
      hasStyleInBody: body.style !== undefined && body.style !== null,
      vibeId: body.vibeId ?? null,
      hasReferenceUrl,
      referencePixelsInGeneration: willAttachReferenceInline,
    });

    const textModel = await getGeminiVibeExpandModelRuntime(supabase);
    const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
    const geminiUrl = `${geminiBaseUrl}/v1beta/models/${textModel}:generateContent`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    const expandUserText = `${EXPAND_PROMPTS_INSTRUCTION}\n\n${buildVibeExpandRuntimeContext(willAttachReferenceInline)}\n\nStyle description:\n${JSON.stringify(style, null, 2)}`;
    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: expandUserText }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    const geminiEndpointHost = (() => {
      try {
        return new URL(geminiBaseUrl).hostname;
      } catch {
        return "invalid_base_url";
      }
    })();

    console.warn("[vibe.expand] gemini_request", {
      userId: user.id,
      model: textModel,
      endpointHost: geminiEndpointHost,
      userTextChars: expandUserText.length,
      styleKeys: Object.keys(style),
      timeoutMs: 45000,
    });
    if (isGeminiVibeDebug()) {
      console.warn("[vibe.expand] gemini_request_body_redacted", redactGenerateContentBody(geminiBody));
    }

    const geminiStarted = Date.now();
    let geminiRes: Response;
    try {
      geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(geminiBody),
        signal: AbortSignal.timeout(45000),
      });
    } catch (err) {
      console.error("[vibe.expand] gemini_fetch_failed", {
        userId: user.id,
        model: textModel,
        endpointHost: geminiEndpointHost,
        durationMs: Date.now() - geminiStarted,
        ...toErrorMeta(err),
        ...fetchErrorDetails(err),
      });
      return NextResponse.json({ error: "expand_failed" }, { status: 503 });
    }

    let geminiData: {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    try {
      geminiData = (await geminiRes.json()) as typeof geminiData;
    } catch (err) {
      console.error("[vibe.expand] gemini_response_body_not_json", {
        userId: user.id,
        model: textModel,
        httpStatus: geminiRes.status,
        durationMs: Date.now() - geminiStarted,
        ...fetchErrorDetails(err),
      });
      return NextResponse.json({ error: "expand_failed" }, { status: 502 });
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
    const responseSummary = summarizeGeminiApiResponse(geminiData);

    console.warn("[vibe.expand] gemini_response", {
      userId: user.id,
      model: textModel,
      httpStatus: geminiRes.status,
      durationMs: Date.now() - geminiStarted,
      textChars: text.length,
      ...responseSummary,
    });
    if (isGeminiVibeDebug() && text.length > 0) {
      console.warn("[vibe.expand] gemini_response_text_preview", {
        userId: user.id,
        preview: text.slice(0, 2500),
        tail: text.length > 2500 ? text.slice(-400) : undefined,
      });
    }

    const objectParse = parseGeminiJsonObject(text);
    const arrayParse = parseGeminiJsonArray(text);
    const promptText = coerceExpandPrompt(objectParse.value, arrayParse.value);
    const parseStages = [...objectParse.stages, ...arrayParse.stages];

    if (!geminiRes.ok || !promptText) {
      const stageLine = parseStages
        .map((s) => `${s.stage}:${s.ok ? "ok" : "fail"}${s.message ? `(${String(s.message).slice(0, 120)})` : ""}`)
        .join(" | ");
      console.error(
        `[vibe.expand] PIPELINE_FAIL user=${user.id} http=${geminiRes.status} promptOk=${Boolean(promptText)} stages=${stageLine}`,
      );
      console.error("[vibe.expand] gemini_pipeline_failed", {
        userId: user.id,
        model: textModel,
        httpStatus: geminiRes.status,
        geminiError: geminiData?.error?.message ?? null,
        textLen: text.length,
        jsonObjectParsed: Boolean(objectParse.value),
        jsonArrayParsed: Boolean(arrayParse.value),
        parseStages,
        expandDiagnose: diagnoseExpandParse(objectParse.value, arrayParse.value),
        textHead: text.slice(0, 500),
        textTail: text.length > 500 ? text.slice(-300) : undefined,
      });
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    const variant: PromptVariant = { accent: SINGLE_PROMPT_ACCENT, prompt: promptText };
    const prompts: PromptVariant[] = [variant];

    console.warn("[vibe.expand] gemini_parse_ok", {
      userId: user.id,
      parseStages: parseStages.filter((s) => s.ok).map((s) => s.stage),
      promptsCount: prompts.length,
      promptChars: promptText.length,
    });

    const assembled = assembleVibeFinalPrompt(promptText, willAttachReferenceInline);
    const finalPromptPreviews = [{ accent: SINGLE_PROMPT_ACCENT, fullText: assembled }];

    return NextResponse.json({
      prompts,
      modelUsed: textModel,
      finalPromptPreviews,
      finalPromptForGeneration: assembled,
      finalPromptAssumesTwoImages: willAttachReferenceInline,
      vibeReferenceInlinePixels: willAttachReferenceInline,
    });
  } catch (err) {
    console.error("[vibe.expand] unhandled error", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "expand_failed" }, { status: 500 });
  }
}
