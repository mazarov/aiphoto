import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  assembleVibeFinalPrompt,
  buildVibeExpandRuntimeContext,
  EXPAND_PROMPTS_INSTRUCTION,
  coerceStylePayload,
  getGeminiVibeExpandModelRuntime,
  getOpenAiVibeExpandModelRuntime,
  getVibeAttachReferenceImageToGeneration,
  getVibeExpandLlmProvider,
  getVibeOneShotExtractPromptEnabled,
  MIN_VIBE_SCENE_PROMPT_CHARS,
  type StylePayload,
} from "@/lib/vibe-gemini-instructions";
import { openAiChatCompletionText, openAiExpandStyleToPromptJson } from "@/lib/vibe-llm-openai";
import {
  buildLegacyExpandUserText,
  legacyStyleFromUnknownRowStyle,
  parseLegacyExpandVariantsFromLlmText,
  resolveMergedPromptWithFallback,
  runLegacyAccentMerge,
} from "@/lib/vibe-legacy-prompt-chain";
import { VIBE_PROMPT_CHAIN_LEGACY_2C23 } from "@/lib/vibe-legacy-config";
import {
  fetchErrorDetails,
  isGeminiVibeDebug,
  parseGeminiJsonArray,
  parseGeminiJsonObject,
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";
import {
  combineSceneAndGroomingForDefaultDisplay,
  combineVibePromptBody,
  DEFAULT_GROOMING_POLICY,
  hasUsableGroomingReference,
  parseExpandStructuredResult,
  parseGroomingReferenceFromRow,
  validateVibePersistParts,
  type GroomingReference,
} from "@/lib/vibe-grooming-assembly";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

const GEMINI_EXPAND_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Single-scene expand output; accent is fixed for API compatibility / save route. */
const SINGLE_PROMPT_ACCENT = "scene" as const;
type PromptVariant = { accent: typeof SINGLE_PROMPT_ACCENT; prompt: string };

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
  if (normalized.length < MIN_VIBE_SCENE_PROMPT_CHARS) return null;
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
        if (normalized.length >= MIN_VIBE_SCENE_PROMPT_CHARS) return normalized;
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
    const oneShotExtractConfigEnabled = await getVibeOneShotExtractPromptEnabled(supabase);

    let style: StylePayload | null = coerceStylePayload(body.style);
    let hasReferenceUrl = false;
    let prefilledPrompt: string | null = null;
    let prefilledVibeGroomingControlsAvailable = false;

    type VibeRowExpand = {
      style: unknown;
      user_id: string;
      source_image_url: string | null;
      prefilled_generation_prompt: string | null;
      prompt_scene_core: string | null;
      grooming_reference: unknown;
      last_monolithic_prompt: string | null;
      prompt_chain: string | null;
    };
    let vibeOwned: VibeRowExpand | null = null;

    if (body.vibeId) {
      const { data: vibe } = await supabase
        .from("vibes")
        .select(
          "style,user_id,source_image_url,prefilled_generation_prompt,prompt_scene_core,grooming_reference,last_monolithic_prompt,prompt_chain",
        )
        .eq("id", body.vibeId)
        .single();
      if (vibe && vibe.user_id === user.id) {
        vibeOwned = vibe as VibeRowExpand;
        hasReferenceUrl = Boolean(String(vibe.source_image_url || "").trim());
        if (vibe.prompt_chain !== VIBE_PROMPT_CHAIN_LEGACY_2C23) {
          if (!style) {
            style = coerceStylePayload(vibe.style);
          }
          const { combinedUnprefixed } = combineVibePromptBody(
            {
              prompt_scene_core: vibe.prompt_scene_core as string | null,
              grooming_reference: vibe.grooming_reference,
              last_monolithic_prompt: vibe.last_monolithic_prompt as string | null,
              prefilled_generation_prompt: vibe.prefilled_generation_prompt as string | null,
            },
            DEFAULT_GROOMING_POLICY,
          );
          if (combinedUnprefixed.length >= MIN_VIBE_SCENE_PROMPT_CHARS) {
            prefilledPrompt = combinedUnprefixed;
          }
          const gr = parseGroomingReferenceFromRow(vibe.grooming_reference);
          prefilledVibeGroomingControlsAvailable =
            Boolean(String(vibe.prompt_scene_core ?? "").trim()) && hasUsableGroomingReference(gr);
        }
      }
    }

    if (vibeOwned?.prompt_chain === VIBE_PROMPT_CHAIN_LEGACY_2C23) {
      const legacyStyle =
        legacyStyleFromUnknownRowStyle(body.style) ?? legacyStyleFromUnknownRowStyle(vibeOwned.style);
      if (!legacyStyle) {
        return NextResponse.json({ error: "missing_style" }, { status: 400 });
      }

      const willAttachReferenceInline =
        (await getVibeAttachReferenceImageToGeneration(supabase)) && hasReferenceUrl;

      const expandLlm = await getVibeExpandLlmProvider(supabase);
      const textModel =
        expandLlm === "openai"
          ? await getOpenAiVibeExpandModelRuntime(supabase)
          : await getGeminiVibeExpandModelRuntime(supabase);

      console.warn("[vibe.expand] request_begin", {
        userId: user.id,
        hasStyleInBody: body.style !== undefined && body.style !== null,
        vibeId: body.vibeId ?? null,
        hasReferenceUrl,
        referencePixelsInGeneration: willAttachReferenceInline,
        expandSource: "legacy_2c23",
        llmProvider: expandLlm,
        legacyPromptChain: true,
      });

      const expandUserText = buildLegacyExpandUserText(legacyStyle);
      let text = "";
      let llmHttpOk = false;
      let llmHttpStatus = 0;
      let llmError: string | null = null;
      const llmStarted = Date.now();

      if (expandLlm === "openai") {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
          console.error("[vibe.expand] missing OPENAI_API_KEY for openai legacy expand");
          return NextResponse.json({ error: "expand_failed" }, { status: 500 });
        }
        const oaRes = await openAiChatCompletionText({
          apiKey: openaiKey,
          model: textModel,
          messages: [{ role: "user", content: expandUserText }],
          timeoutMs: 120_000,
        });
        text = oaRes.text;
        llmHttpOk = oaRes.ok;
        llmHttpStatus = oaRes.status;
        llmError = oaRes.errorMessage ?? null;
        console.warn("[vibe.expand] openai_response", {
          userId: user.id,
          llm: "openai",
          model: textModel,
          legacyPromptChain: true,
          httpStatus: llmHttpStatus,
          durationMs: Date.now() - llmStarted,
          textChars: text.length,
          error: llmError,
        });
      } else {
        const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
        const geminiUrl = `${geminiBaseUrl}/v1beta/models/${textModel}:generateContent`;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return NextResponse.json({ error: "expand_failed" }, { status: 500 });
        }

        const geminiBody = {
          contents: [{ role: "user", parts: [{ text: expandUserText }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        };

        let geminiRes: Response;
        let fetchAttempt = 0;
        while (true) {
          try {
            geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify(geminiBody),
              signal: AbortSignal.timeout(45_000),
            });
          } catch (err) {
            console.error("[vibe.expand] gemini_fetch_failed", {
              userId: user.id,
              model: textModel,
              legacyPromptChain: true,
              durationMs: Date.now() - llmStarted,
              ...toErrorMeta(err),
              ...fetchErrorDetails(err),
            });
            return NextResponse.json({ error: "expand_failed", detail: "network" }, { status: 503 });
          }

          const status = geminiRes.status;
          const retryable = status === 503 || status === 429;
          if (retryable && fetchAttempt < GEMINI_EXPAND_MAX_ATTEMPTS - 1) {
            try {
              await geminiRes.text();
            } catch {
              /* ignore */
            }
            const retryAfterHeader = geminiRes.headers.get("retry-after");
            const parsedRa = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
            const baseDelay = Math.min(4000, 400 * 2 ** fetchAttempt);
            const jitter = Math.floor(Math.random() * 250);
            const waitMs =
              Number.isFinite(parsedRa) && parsedRa > 0
                ? Math.min(10_000, parsedRa * 1000)
                : baseDelay + jitter;
            console.warn("[vibe.expand] gemini_retry", {
              userId: user.id,
              model: textModel,
              legacyPromptChain: true,
              httpStatus: status,
              attempt: fetchAttempt + 1,
              maxAttempts: GEMINI_EXPAND_MAX_ATTEMPTS,
              waitMs,
            });
            fetchAttempt += 1;
            await sleep(waitMs);
            continue;
          }
          break;
        }

        let geminiData: {
          error?: { message?: string; status?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        try {
          geminiData = (await geminiRes.json()) as typeof geminiData;
        } catch (err) {
          console.error("[vibe.expand] gemini_response_body_not_json", {
            userId: user.id,
            model: textModel,
            legacyPromptChain: true,
            httpStatus: geminiRes.status,
            durationMs: Date.now() - llmStarted,
            ...fetchErrorDetails(err),
          });
          return NextResponse.json({ error: "expand_failed", detail: "bad_response" }, { status: 502 });
        }

        if (!geminiRes.ok) {
          const errMsg = geminiData?.error?.message ?? null;
          const errStatus = geminiData?.error?.status ?? null;
          const unavailable =
            geminiRes.status === 503 || errStatus === "UNAVAILABLE" || errStatus === "RESOURCE_EXHAUSTED";
          return NextResponse.json(
            {
              error: "expand_failed",
              detail: unavailable ? "gemini_unavailable" : "gemini_error",
            },
            {
              status: unavailable ? 503 : geminiRes.status >= 400 && geminiRes.status < 600 ? geminiRes.status : 502,
            },
          );
        }

        text =
          geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
        llmHttpOk = geminiRes.ok;
        llmHttpStatus = geminiRes.status;
        llmError = geminiData?.error?.message ?? null;

        console.warn("[vibe.expand] gemini_response", {
          userId: user.id,
          llm: "gemini",
          model: textModel,
          legacyPromptChain: true,
          httpStatus: geminiRes.status,
          durationMs: Date.now() - llmStarted,
          textChars: text.length,
          ...summarizeGeminiApiResponse(geminiData),
        });
      }

      if (!llmHttpOk) {
        console.error("[vibe.expand] legacy_expand_http_fail", {
          userId: user.id,
          llm: expandLlm,
          httpStatus: llmHttpStatus,
          llmError,
        });
        return NextResponse.json({ error: "expand_failed" }, { status: 500 });
      }

      const variants = parseLegacyExpandVariantsFromLlmText(text);
      if (!variants) {
        console.error("[vibe.expand] legacy_expand_parse_failed", {
          userId: user.id,
          llm: expandLlm,
          model: textModel,
          textLen: text.length,
          textHead: text.slice(0, 500),
        });
        return NextResponse.json({ error: "expand_failed" }, { status: 500 });
      }

      const mergeStarted = Date.now();
      const mergeApiKey =
        expandLlm === "openai" ? String(process.env.OPENAI_API_KEY || "") : String(process.env.GEMINI_API_KEY || "");
      const geminiBaseForMerge =
        expandLlm === "gemini" ? await getGeminiBaseUrlRuntime(supabase) : DIRECT_GEMINI_BASE_URL;

      const mergeResult = await runLegacyAccentMerge({
        provider: expandLlm,
        geminiBaseUrl: geminiBaseForMerge,
        model: textModel,
        apiKey: mergeApiKey,
        style: legacyStyle,
        variants,
      });
      const { mergedPrompt, mergeFallbackReason } = resolveMergedPromptWithFallback(mergeResult, variants);
      const mergeMs = Date.now() - mergeStarted;

      if (!mergeResult.usedLlm || mergeFallbackReason) {
        console.warn("[vibe.merge] fallback_used", {
          userId: user.id,
          mergeOk: mergeResult.usedLlm,
          mergeFallbackReason: mergeFallbackReason ?? mergeResult.fallbackReason ?? null,
          mergedLen: mergedPrompt.length,
          mergeMs,
        });
      }

      const assembled = assembleVibeFinalPrompt(mergedPrompt, willAttachReferenceInline, false);
      const finalPromptPreviews = variants.map((v) => ({ accent: v.accent, fullText: assembled }));

      console.warn("[vibe.expand] expand_parse_ok", {
        userId: user.id,
        llm: expandLlm,
        legacyPromptChain: true,
        promptsCount: variants.length,
        mergedPromptChars: mergedPrompt.length,
        mergeMs,
      });

      return NextResponse.json({
        prompts: variants,
        mergedPrompt,
        mergeModelUsed: mergeResult.mergeModelUsed,
        mergeOk: mergeResult.usedLlm,
        mergeMs,
        mergeFallbackReason: mergeFallbackReason ?? null,
        modelUsed: textModel,
        llmProvider: expandLlm,
        finalPromptPreviews,
        finalPromptForGeneration: assembled,
        finalPromptAssumesTwoImages: willAttachReferenceInline,
        vibeReferenceInlinePixels: willAttachReferenceInline,
        vibeGroomingControlsAvailable: false,
        legacyPromptChain: true,
      });
    }

    if (!style) {
      return NextResponse.json({ error: "missing_style" }, { status: 400 });
    }

    const willAttachReferenceInline =
      (await getVibeAttachReferenceImageToGeneration(supabase)) && hasReferenceUrl;

    const expandLlm = await getVibeExpandLlmProvider(supabase);
    const textModel =
      expandLlm === "openai"
        ? await getOpenAiVibeExpandModelRuntime(supabase)
        : await getGeminiVibeExpandModelRuntime(supabase);

    if (prefilledPrompt) {
      console.warn("[vibe.expand] request_begin", {
        userId: user.id,
        hasStyleInBody: body.style !== undefined && body.style !== null,
        vibeId: body.vibeId ?? null,
        hasReferenceUrl,
        referencePixelsInGeneration: willAttachReferenceInline,
        expandSource: "prefilled_generation_prompt",
        llmProvider: expandLlm,
      });

      const variant: PromptVariant = { accent: SINGLE_PROMPT_ACCENT, prompt: prefilledPrompt };
      const prompts: PromptVariant[] = [variant];
      const assembled = assembleVibeFinalPrompt(
        prefilledPrompt,
        willAttachReferenceInline,
        oneShotExtractConfigEnabled,
      );
      const finalPromptPreviews = [{ accent: SINGLE_PROMPT_ACCENT, fullText: assembled }];

      return NextResponse.json({
        prompts,
        modelUsed: textModel,
        llmProvider: expandLlm,
        finalPromptPreviews,
        finalPromptForGeneration: assembled,
        finalPromptAssumesTwoImages: willAttachReferenceInline,
        vibeReferenceInlinePixels: willAttachReferenceInline,
        vibeGroomingControlsAvailable: prefilledVibeGroomingControlsAvailable,
      });
    }

    const expandUserText = `${EXPAND_PROMPTS_INSTRUCTION}\n\n${buildVibeExpandRuntimeContext(willAttachReferenceInline)}\n\nStyle description:\n${JSON.stringify(style, null, 2)}`;

    let text = "";
    let llmHttpOk = false;
    let llmHttpStatus = 0;
    let llmError: string | null = null;

    const llmStarted = Date.now();

    if (expandLlm === "openai") {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.error("[vibe.expand] missing OPENAI_API_KEY for openai expand");
        return NextResponse.json({ error: "expand_failed" }, { status: 500 });
      }

      console.warn("[vibe.expand] request_begin", {
        userId: user.id,
        hasStyleInBody: body.style !== undefined && body.style !== null,
        vibeId: body.vibeId ?? null,
        hasReferenceUrl,
        referencePixelsInGeneration: willAttachReferenceInline,
        expandSource: "openai",
        llmProvider: expandLlm,
      });

      console.warn("[vibe.expand] openai_request", {
        userId: user.id,
        llm: "openai",
        model: textModel,
        userTextChars: expandUserText.length,
        styleKeys: Object.keys(style),
        timeoutMs: 120000,
      });

      const oaRes = await openAiExpandStyleToPromptJson({
        apiKey: openaiKey,
        model: textModel,
        userText: expandUserText,
        timeoutMs: 120000,
      });
      text = oaRes.text;
      llmHttpOk = oaRes.ok;
      llmHttpStatus = oaRes.status;
      llmError = oaRes.errorMessage ?? null;

      console.warn("[vibe.expand] openai_response", {
        userId: user.id,
        llm: "openai",
        model: textModel,
        httpStatus: llmHttpStatus,
        durationMs: Date.now() - llmStarted,
        textChars: text.length,
        error: llmError,
      });
      if (isGeminiVibeDebug() && text.length > 0) {
        console.warn("[vibe.expand] openai_response_text_preview", {
          userId: user.id,
          preview: text.slice(0, 2500),
          tail: text.length > 2500 ? text.slice(-400) : undefined,
        });
      }
    } else {
      console.warn("[vibe.expand] request_begin", {
        userId: user.id,
        hasStyleInBody: body.style !== undefined && body.style !== null,
        vibeId: body.vibeId ?? null,
        hasReferenceUrl,
        referencePixelsInGeneration: willAttachReferenceInline,
        expandSource: "gemini",
        llmProvider: expandLlm,
      });

      const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
      const geminiUrl = `${geminiBaseUrl}/v1beta/models/${textModel}:generateContent`;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "expand_failed" }, { status: 500 });
      }

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
        llm: "gemini",
        model: textModel,
        endpointHost: geminiEndpointHost,
        userTextChars: expandUserText.length,
        styleKeys: Object.keys(style),
        timeoutMs: 45000,
      });
      if (isGeminiVibeDebug()) {
        console.warn("[vibe.expand] gemini_request_body_redacted", redactGenerateContentBody(geminiBody));
      }

      let geminiRes: Response;
      let fetchAttempt = 0;
      while (true) {
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
            durationMs: Date.now() - llmStarted,
            ...toErrorMeta(err),
            ...fetchErrorDetails(err),
          });
          return NextResponse.json({ error: "expand_failed", detail: "network" }, { status: 503 });
        }

        const status = geminiRes.status;
        const retryable = status === 503 || status === 429;
        if (retryable && fetchAttempt < GEMINI_EXPAND_MAX_ATTEMPTS - 1) {
          try {
            await geminiRes.text();
          } catch {
            /* ignore */
          }
          const retryAfterHeader = geminiRes.headers.get("retry-after");
          const parsedRa = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
          const baseDelay = Math.min(4000, 400 * 2 ** fetchAttempt);
          const jitter = Math.floor(Math.random() * 250);
          const waitMs =
            Number.isFinite(parsedRa) && parsedRa > 0
              ? Math.min(10_000, parsedRa * 1000)
              : baseDelay + jitter;
          console.warn("[vibe.expand] gemini_retry", {
            userId: user.id,
            model: textModel,
            httpStatus: status,
            attempt: fetchAttempt + 1,
            maxAttempts: GEMINI_EXPAND_MAX_ATTEMPTS,
            waitMs,
          });
          fetchAttempt += 1;
          await sleep(waitMs);
          continue;
        }
        break;
      }

      let geminiData: {
        error?: { message?: string; status?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      try {
        geminiData = (await geminiRes.json()) as typeof geminiData;
      } catch (err) {
        console.error("[vibe.expand] gemini_response_body_not_json", {
          userId: user.id,
          model: textModel,
          httpStatus: geminiRes.status,
          durationMs: Date.now() - llmStarted,
          ...fetchErrorDetails(err),
        });
        return NextResponse.json({ error: "expand_failed", detail: "bad_response" }, { status: 502 });
      }

      if (!geminiRes.ok) {
        const errMsg = geminiData?.error?.message ?? null;
        const errStatus = geminiData?.error?.status ?? null;
        console.error("[vibe.expand] gemini_http_error", {
          userId: user.id,
          model: textModel,
          httpStatus: geminiRes.status,
          llmError: errMsg,
          errorStatus: errStatus,
          attempts: fetchAttempt + 1,
        });
        const unavailable =
          geminiRes.status === 503 || errStatus === "UNAVAILABLE" || errStatus === "RESOURCE_EXHAUSTED";
        return NextResponse.json(
          {
            error: "expand_failed",
            detail: unavailable ? "gemini_unavailable" : "gemini_error",
          },
          { status: unavailable ? 503 : geminiRes.status >= 400 && geminiRes.status < 600 ? geminiRes.status : 502 },
        );
      }

      text = geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
      const responseSummary = summarizeGeminiApiResponse(geminiData);
      llmHttpOk = geminiRes.ok;
      llmHttpStatus = geminiRes.status;
      llmError = geminiData?.error?.message ?? null;

      console.warn("[vibe.expand] gemini_response", {
        userId: user.id,
        llm: "gemini",
        model: textModel,
        httpStatus: geminiRes.status,
        durationMs: Date.now() - llmStarted,
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
    }

    const objectParse = parseGeminiJsonObject(text);
    const arrayParse = parseGeminiJsonArray(text);
    const parseStages = [...objectParse.stages, ...arrayParse.stages];

    const structured = parseExpandStructuredResult(
      objectParse.value,
      arrayParse.value,
      MIN_VIBE_SCENE_PROMPT_CHARS,
    );
    let sceneCore: string;
    let grooming: GroomingReference;
    if (structured) {
      sceneCore = structured.scene;
      grooming = structured.grooming;
    } else {
      const legacy = coerceExpandPrompt(objectParse.value, arrayParse.value);
      if (!legacy) {
        const stageLine = parseStages
          .map((s) => `${s.stage}:${s.ok ? "ok" : "fail"}${s.message ? `(${String(s.message).slice(0, 120)})` : ""}`)
          .join(" | ");
        console.error(
          `[vibe.expand] PIPELINE_FAIL user=${user.id} llm=${expandLlm} http=${llmHttpStatus} promptOk=false stages=${stageLine}`,
        );
        console.error("[vibe.expand] expand_pipeline_failed", {
          userId: user.id,
          llm: expandLlm,
          model: textModel,
          httpStatus: llmHttpStatus,
          llmError,
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
      sceneCore = legacy;
      grooming = { hair: "", makeup: "" };
    }

    if (!llmHttpOk) {
      const stageLine = parseStages
        .map((s) => `${s.stage}:${s.ok ? "ok" : "fail"}${s.message ? `(${String(s.message).slice(0, 120)})` : ""}`)
        .join(" | ");
      console.error(
        `[vibe.expand] PIPELINE_FAIL user=${user.id} llm=${expandLlm} http=${llmHttpStatus} stages=${stageLine}`,
      );
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    const combinedUnprefixed = combineSceneAndGroomingForDefaultDisplay(sceneCore, grooming);
    const validated = validateVibePersistParts(sceneCore, grooming, combinedUnprefixed);
    if (!validated.ok) {
      console.error("[vibe.expand] persist_validation_failed", {
        userId: user.id,
        vibeId: body.vibeId ?? null,
        reason: validated.reason,
        sceneLen: sceneCore.trim().length,
        hairLen: grooming.hair.length,
        makeupLen: grooming.makeup.length,
        combinedLen: combinedUnprefixed.length,
      });
      return NextResponse.json(
        { error: "vibe_prompt_too_large", detail: validated.reason },
        { status: 400 },
      );
    }

    const { sceneCore: scenePersist, grooming: groomingPersist, combinedUnprefixed: combinedPersist } =
      validated;

    if (body.vibeId) {
      const { data: updatedRows, error: upErr } = await supabase
        .from("vibes")
        .update({
          prompt_scene_core: scenePersist,
          grooming_reference: groomingPersist,
          last_monolithic_prompt: combinedPersist,
        })
        .eq("id", body.vibeId)
        .eq("user_id", user.id)
        .select("id");

      if (upErr) {
        console.error("[vibe.expand] failed to persist prompt parts", {
          userId: user.id,
          vibeId: body.vibeId,
          message: upErr.message,
        });
        return NextResponse.json({ error: "expand_persist_failed" }, { status: 500 });
      }
      if (!updatedRows?.length) {
        console.error("[vibe.expand] persist_no_matching_row", {
          userId: user.id,
          vibeId: body.vibeId,
        });
        return NextResponse.json({ error: "expand_persist_failed" }, { status: 500 });
      }
    }

    const variant: PromptVariant = { accent: SINGLE_PROMPT_ACCENT, prompt: combinedPersist };
    const prompts: PromptVariant[] = [variant];

    const vibeGroomingControlsAvailable =
      Boolean(body.vibeId) &&
      Boolean(scenePersist) &&
      hasUsableGroomingReference(groomingPersist);

    console.warn("[vibe.expand] expand_parse_ok", {
      userId: user.id,
      llm: expandLlm,
      parseStages: parseStages.filter((s) => s.ok).map((s) => s.stage),
      promptsCount: prompts.length,
      sceneChars: scenePersist.length,
      combinedChars: combinedPersist.length,
      structuredSplit: Boolean(structured),
    });

    const assembled = assembleVibeFinalPrompt(
      combinedPersist,
      willAttachReferenceInline,
      oneShotExtractConfigEnabled,
    );
    const finalPromptPreviews = [{ accent: SINGLE_PROMPT_ACCENT, fullText: assembled }];

    return NextResponse.json({
      prompts,
      modelUsed: textModel,
      llmProvider: expandLlm,
      finalPromptPreviews,
      finalPromptForGeneration: assembled,
      finalPromptAssumesTwoImages: willAttachReferenceInline,
      vibeReferenceInlinePixels: willAttachReferenceInline,
      vibeGroomingControlsAvailable,
    });
  } catch (err) {
    console.error("[vibe.expand] unhandled error", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "expand_failed" }, { status: 500 });
  }
}
