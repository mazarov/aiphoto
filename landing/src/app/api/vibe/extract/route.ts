import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  EXTRACT_STYLE_INSTRUCTION,
  getGeminiVibeExtractModel,
  coerceStylePayload,
  getStyleCoerceDiagnostics,
} from "@/lib/vibe-gemini-instructions";
import {
  isGeminiVibeDebug,
  parseGeminiJsonObject,
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

    const body = (await req.json()) as { imageUrl?: string };
    const imageUrl = String(body?.imageUrl || "").trim();
    if (!imageUrl) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    const safeUrl = await validateSafeImageUrl(imageUrl);
    if (!safeUrl) {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    let inlineData: { mimeType: string; data: string };
    try {
      inlineData = await fetchImageAsInlineData(safeUrl.toString());
    } catch (err) {
      console.warn("[vibe.extract] image fetch failed", {
        userId: user.id,
        imageUrl: safeUrl.toString(),
        ...toErrorMeta(err),
      });
      return NextResponse.json({ error: "fetch_failed" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const visionModel = getGeminiVibeExtractModel();
    const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
    const geminiUrl = `${geminiBaseUrl}/v1beta/models/${visionModel}:generateContent`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "extract_failed" }, { status: 500 });
    }

    const geminiBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: EXTRACT_STYLE_INSTRUCTION }, { inlineData }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    console.info("[vibe.extract] gemini_request", {
      userId: user.id,
      model: visionModel,
      endpointHost: (() => {
        try {
          return new URL(geminiBaseUrl).hostname;
        } catch {
          return "invalid_base_url";
        }
      })(),
      inlineImageBase64Chars: inlineData.data.length,
      instructionTextChars: EXTRACT_STYLE_INSTRUCTION.length,
    });
    if (isGeminiVibeDebug()) {
      console.info("[vibe.extract] gemini_request_body_redacted", redactGenerateContentBody(geminiBody));
    }

    const geminiStarted = Date.now();
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(geminiBody),
      signal: AbortSignal.timeout(45000),
    });

    const geminiData = (await geminiRes.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
    const responseSummary = summarizeGeminiApiResponse(geminiData);

    console.info("[vibe.extract] gemini_response", {
      userId: user.id,
      model: visionModel,
      httpStatus: geminiRes.status,
      durationMs: Date.now() - geminiStarted,
      textChars: text.length,
      ...responseSummary,
    });
    if (isGeminiVibeDebug() && text.length > 0) {
      console.info("[vibe.extract] gemini_response_text_preview", {
        userId: user.id,
        preview: text.slice(0, 2500),
        tail: text.length > 2500 ? text.slice(-400) : undefined,
      });
    }

    const { value: parsed, stages: parseStages } = parseGeminiJsonObject(text);
    const style = parsed ? coerceStylePayload(parsed) : null;

    if (!geminiRes.ok || !style) {
      const coerceDiag = parsed ? getStyleCoerceDiagnostics(parsed) : null;
      console.error("[vibe.extract] gemini_pipeline_failed", {
        userId: user.id,
        model: visionModel,
        httpStatus: geminiRes.status,
        geminiError: geminiData?.error?.message ?? null,
        textLen: text.length,
        jsonObjectParsed: Boolean(parsed),
        parseStages,
        parsedKeys: parsed ? Object.keys(parsed) : [],
        coerceAccepted: style ? true : coerceDiag?.accepted ?? false,
        coerceMissingRequired: coerceDiag?.missingRequired ?? null,
        coerceRawKeys: coerceDiag?.rawKeys ?? [],
        textHead: text.slice(0, 500),
        textTail: text.length > 500 ? text.slice(-300) : undefined,
      });
      return NextResponse.json({ error: "extract_failed" }, { status: 500 });
    }

    console.info("[vibe.extract] gemini_parse_ok", {
      userId: user.id,
      parseStages: parseStages.filter((s) => s.ok).map((s) => s.stage),
      styleFieldCount: Object.keys(style).length,
    });

    const { data: vibe, error: insertError } = await supabase
      .from("vibes")
      .insert({
        user_id: user.id,
        source_image_url: safeUrl.toString(),
        style,
      })
      .select("id")
      .single();

    if (insertError || !vibe) {
      console.error("[vibe.extract] insert failed", {
        userId: user.id,
        error: insertError?.message ?? null,
      });
      return NextResponse.json({ error: "extract_failed" }, { status: 500 });
    }

    return NextResponse.json({
      vibeId: vibe.id,
      style,
      modelUsed: visionModel,
    });
  } catch (err) {
    console.error("[vibe.extract] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "extract_failed" }, { status: 500 });
  }
}
