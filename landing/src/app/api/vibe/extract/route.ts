import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  getGeminiVibeExtractModelRuntime,
  getOpenAiVibeExtractModelRuntime,
  getVibeExtractLlmProvider,
} from "@/lib/vibe-gemini-instructions";
import { openAiExtractImageJson } from "@/lib/vibe-llm-openai";
import {
  fetchErrorDetails,
  isGeminiVibeDebug,
  parseGeminiJsonObject,
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";
import {
  coerceLegacyVibeStylePayload,
  LEGACY_EXTRACT_PROMPT_2C23CE94,
} from "@/lib/vibe-legacy-prompt-chain";
import { VIBE_PROMPT_CHAIN_LEGACY_2C23 } from "@/lib/vibe-legacy-config";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Optional client override for vision instruction (A/B extract prompts). */
const MIN_EXTRACT_INSTRUCTION_OVERRIDE_LEN = 80;
const MAX_EXTRACT_INSTRUCTION_OVERRIDE_LEN = 48_000;

function resolveExtractInstruction(override: unknown): { instruction: string; custom: boolean } | { error: string } {
  if (override === undefined || override === null) {
    return { instruction: LEGACY_EXTRACT_PROMPT_2C23CE94, custom: false };
  }
  if (typeof override !== "string") {
    return { error: "extractInstructionOverride must be a string when provided" };
  }
  const trimmed = override.trim();
  if (!trimmed) {
    return { instruction: LEGACY_EXTRACT_PROMPT_2C23CE94, custom: false };
  }
  if (trimmed.length < MIN_EXTRACT_INSTRUCTION_OVERRIDE_LEN) {
    return {
      error: `extractInstructionOverride must be at least ${MIN_EXTRACT_INSTRUCTION_OVERRIDE_LEN} characters`,
    };
  }
  if (trimmed.length > MAX_EXTRACT_INSTRUCTION_OVERRIDE_LEN) {
    return { error: `extractInstructionOverride exceeds ${MAX_EXTRACT_INSTRUCTION_OVERRIDE_LEN} characters` };
  }
  return { instruction: trimmed, custom: true };
}

const EXTRACT_TEMPERATURE_MIN = 0;
const EXTRACT_TEMPERATURE_MAX = 2;

/**
 * Optional client override for sampling during style extract. Omitted / null = provider default.
 * Invalid types → 400 (do not silently ignore malformed client input).
 */
function parseOptionalExtractTemperature(raw: unknown): { ok: true; value?: number } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { ok: false };
  const clamped = Math.min(
    EXTRACT_TEMPERATURE_MAX,
    Math.max(EXTRACT_TEMPERATURE_MIN, raw),
  );
  return { ok: true, value: clamped };
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
    console.warn("[vibe.extract] failed to read photo_app_config.gemini_use_proxy", toErrorMeta(err));
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

function isBlockedIpLiteral(ip: string): boolean {
  if (isIP(ip) === 4) {
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("127.")) return true;
    if (ip.startsWith("169.254.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
    return false;
  }
  if (isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    return false;
  }
  return true;
}

async function validateSafeImageUrl(imageUrl: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (!parsed.hostname) return null;

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return null;

  if (isIP(host) !== 0) {
    return isBlockedIpLiteral(host) ? null : parsed;
  }

  try {
    const resolved = await lookup(host, { all: true, verbatim: true });
    if (!resolved.length) return null;
    if (resolved.some((row) => isBlockedIpLiteral(row.address))) return null;
  } catch {
    return null;
  }

  return parsed;
}

function normalizeMimeType(contentType: string | null): string {
  const raw = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (raw === "image/png" || raw === "image/jpeg" || raw === "image/webp") return raw;
  return "image/jpeg";
}

async function fetchImageAsInlineData(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent": "PromptShotBot/1.0 (+https://promptshot.ru)",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`image download failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (!String(contentType || "").startsWith("image/")) {
    throw new Error("url does not point to image");
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error("image is too large");
  }

  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error("image is too large");
  }

  return {
    mimeType: normalizeMimeType(contentType),
    data: buf.toString("base64"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      imageUrl?: string;
      extractTemperature?: unknown;
      extractInstructionOverride?: unknown;
    };
    const pipelineTrace = getStvPipelineTrace(req, body);
    const imageUrl = String(body?.imageUrl || "").trim();
    if (!imageUrl) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    const instrResolved = resolveExtractInstruction(body.extractInstructionOverride);
    if ("error" in instrResolved) {
      return NextResponse.json(
        { error: "validation_error", message: instrResolved.error },
        { status: 400 },
      );
    }
    const extractInstruction = instrResolved.instruction;
    const extractInstructionCustom = instrResolved.custom;

    const tempParsed = parseOptionalExtractTemperature(body.extractTemperature);
    if (!tempParsed.ok) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "extractTemperature must be a finite number between 0 and 2, or null/omitted",
        },
        { status: 400 },
      );
    }
    const extractTemperature = tempParsed.value;

    const safeUrl = await validateSafeImageUrl(imageUrl);
    if (!safeUrl) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    console.warn("[vibe.extract] request_begin", {
      userId: user.id,
      pipelineTrace,
      imageHost: safeUrl.hostname,
      extractTemperature: extractTemperature ?? "default",
      extractInstructionCustom,
      instructionChars: extractInstruction.length,
    });
    stvLog("vibe.extract.begin", {
      pipelineTrace,
      userId: user.id,
      imageUrlHost: safeUrl.hostname,
      instructionChars: extractInstruction.length,
      extractInstructionCustom,
      extractTemperature: extractTemperature ?? "default",
    });

    let inlineData: { mimeType: string; data: string };
    try {
      console.warn("[vibe.extract] image_download_begin", {
        userId: user.id,
        imageHost: safeUrl.hostname,
        timeoutMs: 15000,
      });
      inlineData = await fetchImageAsInlineData(safeUrl.toString());
      console.warn("[vibe.extract] image_download_ok", {
        userId: user.id,
        mimeType: inlineData.mimeType,
        base64Chars: inlineData.data.length,
      });
    } catch (err) {
      console.error("[vibe.extract] image_download_failed", {
        userId: user.id,
        imageHost: safeUrl.hostname,
        ...toErrorMeta(err),
        ...fetchErrorDetails(err),
      });
      return NextResponse.json({ error: "fetch_failed" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const extractLlm = await getVibeExtractLlmProvider(supabase);

    let text = "";
    let httpOk = false;
    let httpStatus = 0;
    let modelUsed = "";
    let llmError: string | null = null;

    const llmStarted = Date.now();

    if (extractLlm === "openai") {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.error("[vibe.extract] missing OPENAI_API_KEY for openai extract");
        return NextResponse.json({ error: "extract_failed" }, { status: 500 });
      }
      modelUsed = await getOpenAiVibeExtractModelRuntime(supabase);
      console.warn("[vibe.extract] openai_request", {
        userId: user.id,
        pipelineTrace,
        llm: "openai",
        model: modelUsed,
        inlineImageBase64Chars: inlineData.data.length,
        legacyPromptChain: true,
        instructionTextChars: extractInstruction.length,
        extractTemperature: extractTemperature ?? "default",
        timeoutMs: 120000,
      });
      const oaRes = await openAiExtractImageJson({
        apiKey: openaiKey,
        model: modelUsed,
        instructionText: extractInstruction,
        imageMimeType: inlineData.mimeType,
        imageBase64: inlineData.data,
        temperature: extractTemperature,
      });
      text = oaRes.text;
      httpOk = oaRes.ok;
      httpStatus = oaRes.status;
      llmError = oaRes.errorMessage ?? null;
      console.warn("[vibe.extract] openai_response", {
        userId: user.id,
        pipelineTrace,
        llm: "openai",
        model: modelUsed,
        httpStatus,
        durationMs: Date.now() - llmStarted,
        textChars: text.length,
        error: llmError,
      });
      if (isGeminiVibeDebug() && text.length > 0) {
        console.warn("[vibe.extract] openai_response_text_preview", {
          userId: user.id,
          preview: text.slice(0, 2500),
          tail: text.length > 2500 ? text.slice(-400) : undefined,
        });
      }
    } else {
      const visionModel = await getGeminiVibeExtractModelRuntime(supabase);
      modelUsed = visionModel;
      const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
      const geminiUrl = `${geminiBaseUrl}/v1beta/models/${visionModel}:generateContent`;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "extract_failed" }, { status: 500 });
      }

      const generationConfig: Record<string, unknown> = {
        responseMimeType: "application/json",
      };
      if (extractTemperature !== undefined) {
        generationConfig.temperature = extractTemperature;
      }

      const geminiBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: extractInstruction }, { inlineData }],
          },
        ],
        generationConfig,
      };

      const geminiEndpointHost = (() => {
        try {
          return new URL(geminiBaseUrl).hostname;
        } catch {
          return "invalid_base_url";
        }
      })();

      console.warn("[vibe.extract] gemini_request", {
        userId: user.id,
        pipelineTrace,
        llm: "gemini",
        model: visionModel,
        endpointHost: geminiEndpointHost,
        inlineImageBase64Chars: inlineData.data.length,
        legacyPromptChain: true,
        instructionTextChars: extractInstruction.length,
        extractTemperature: extractTemperature ?? "default",
        timeoutMs: 45000,
      });
      if (isGeminiVibeDebug()) {
        console.warn("[vibe.extract] gemini_request_body_redacted", redactGenerateContentBody(geminiBody));
      }

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
        console.error("[vibe.extract] gemini_fetch_failed", {
          userId: user.id,
          model: visionModel,
          endpointHost: geminiEndpointHost,
          durationMs: Date.now() - llmStarted,
          ...toErrorMeta(err),
          ...fetchErrorDetails(err),
        });
        return NextResponse.json({ error: "extract_failed" }, { status: 503 });
      }

      let geminiData: {
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      try {
        geminiData = (await geminiRes.json()) as typeof geminiData;
      } catch (err) {
        console.error("[vibe.extract] gemini_response_body_not_json", {
          userId: user.id,
          model: visionModel,
          httpStatus: geminiRes.status,
          durationMs: Date.now() - llmStarted,
          ...fetchErrorDetails(err),
        });
        return NextResponse.json({ error: "extract_failed" }, { status: 502 });
      }

      text = geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
      const responseSummary = summarizeGeminiApiResponse(geminiData);
      httpOk = geminiRes.ok;
      httpStatus = geminiRes.status;
      llmError = geminiData?.error?.message ?? null;

      console.warn("[vibe.extract] gemini_response", {
        userId: user.id,
        pipelineTrace,
        llm: "gemini",
        model: visionModel,
        httpStatus: geminiRes.status,
        durationMs: Date.now() - llmStarted,
        textChars: text.length,
        ...responseSummary,
      });
      if (isGeminiVibeDebug() && text.length > 0) {
        console.warn("[vibe.extract] gemini_response_text_preview", {
          userId: user.id,
          preview: text.slice(0, 2500),
          tail: text.length > 2500 ? text.slice(-400) : undefined,
        });
      }
    }

    stvLog("vibe.extract.llm_done", {
      pipelineTrace,
      userId: user.id,
      llm: extractLlm,
      modelUsed,
      durationMs: Date.now() - llmStarted,
      outputTextChars: text.length,
      httpStatus,
    });

    const { value: parsed, stages: parseStages } = parseGeminiJsonObject(text);

    if (!httpOk) {
      console.error("[vibe.extract] extract_pipeline_failed_legacy_http", {
        userId: user.id,
        pipelineTrace,
        llm: extractLlm,
        httpStatus,
        llmError,
      });
      return NextResponse.json({ error: "extract_failed" }, { status: 500 });
    }

    const legacyStyle = parsed ? coerceLegacyVibeStylePayload(parsed) : null;
    if (!legacyStyle) {
      console.error("[vibe.extract] extract_pipeline_failed_legacy_coerce", {
        userId: user.id,
        pipelineTrace,
        llm: extractLlm,
        model: modelUsed,
        httpStatus,
        parseStages,
        parsedKeys: parsed ? Object.keys(parsed) : [],
      });
      return NextResponse.json({ error: "extract_failed" }, { status: 500 });
    }

    const { data: vibe, error: insertError } = await supabase
      .from("vibes")
      .insert({
        user_id: user.id,
        source_image_url: safeUrl.toString(),
        style: legacyStyle,
        prompt_chain: VIBE_PROMPT_CHAIN_LEGACY_2C23,
      })
      .select("id")
      .single();

    if (insertError || !vibe) {
      console.error("[vibe.extract] insert failed", {
        userId: user.id,
        legacyPromptChain: true,
        error: insertError?.message ?? null,
      });
      return NextResponse.json({ error: "extract_failed" }, { status: 500 });
    }

    console.warn("[vibe.extract] extract_parse_ok", {
      userId: user.id,
      pipelineTrace,
      vibeId: vibe.id,
      llm: extractLlm,
      legacyPromptChain: true,
      styleFieldCount: Object.keys(legacyStyle).length,
    });
    stvLog("vibe.extract.ok", {
      pipelineTrace,
      userId: user.id,
      vibeId: vibe.id,
      modelUsed,
      llmProvider: extractLlm,
      styleFieldCount: Object.keys(legacyStyle).length,
    });

    return NextResponse.json({
      vibeId: vibe.id,
      style: legacyStyle,
      modelUsed,
      llmProvider: extractLlm,
      legacyPromptChain: true,
      extractInstructionCustom,
    });
  } catch (err) {
    console.error("[vibe.extract] unhandled error", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "extract_failed" }, { status: 500 });
  }
}
