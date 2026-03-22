import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  assembleVibeFinalPrompt,
  getGeminiVibeExpandModelRuntime,
  getOpenAiVibeExpandModelRuntime,
  getVibeAttachReferenceImageToGeneration,
  getVibeExpandLlmProvider,
} from "@/lib/vibe-gemini-instructions";
import { openAiChatCompletionText } from "@/lib/vibe-llm-openai";
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
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

const GEMINI_EXPAND_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    type VibeRowExpand = {
      style: unknown;
      user_id: string;
      source_image_url: string | null;
      prompt_chain: string | null;
    };
    let vibeOwned: VibeRowExpand | null = null;
    let hasReferenceUrl = false;

    if (body.vibeId) {
      const { data: vibe } = await supabase
        .from("vibes")
        .select("style,user_id,source_image_url,prompt_chain")
        .eq("id", body.vibeId)
        .single();
      if (!vibe || vibe.user_id !== user.id) {
        return NextResponse.json({ error: "vibe_not_found" }, { status: 404 });
      }
      if (vibe.prompt_chain !== VIBE_PROMPT_CHAIN_LEGACY_2C23) {
        return NextResponse.json(
          {
            error: "vibe_not_legacy",
            message: "This vibe is not legacy_2c23. Upload the reference again to run extract.",
          },
          { status: 409 },
        );
      }
      vibeOwned = vibe as VibeRowExpand;
      hasReferenceUrl = Boolean(String(vibe.source_image_url || "").trim());
    }

    const legacyStyle =
      legacyStyleFromUnknownRowStyle(body.style) ?? legacyStyleFromUnknownRowStyle(vibeOwned?.style ?? null);
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

    const assembled = assembleVibeFinalPrompt(mergedPrompt, willAttachReferenceInline);
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
  } catch (err) {
    console.error("[vibe.expand] unhandled error", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "expand_failed" }, { status: 500 });
  }
}
