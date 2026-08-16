import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { recordAnalyzeEvent } from "@/lib/analyze-events";
import { recordAnalyzeHistory } from "@/lib/analyze-history";
import {
  ANALYZE_QUOTA_MESSAGES,
  analyzeQuotaPublicFields,
  confirmAnalyzeQuota,
  releaseAnalyzeQuota,
  reserveAnalyzeQuota,
  resolveAnalyzeQuotaSnapshot,
  type AnalyzeQuotaSession,
  type AnalyzeQuotaSnapshot,
} from "@/lib/analyze-quota";
import { resolveClientSource } from "@/lib/client-source";
import {
  inferAspectRatioFromDimensions,
  type ExtensionImageSettings,
} from "@/lib/extension-image-settings";
import { extensionLog } from "@/lib/extension-pipeline-log";
import {
  buildExtractPrompt,
  SECTION_SPEC_ORDER,
} from "@/lib/extension-prompt-sections";
import {
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";
import { createSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES * (4 / 3)) + 100;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const GEMINI_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com";

type ParsedImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string;
};

const CRITICAL_RULES_EN = `CRITICAL RULES
- Preserve: face structure, features, skin tone, eye color, proportions.
- Subject must look naturally photographed in the setting, not pasted.
- Photorealistic output, high textural detail, high quality, 8K-grade resolution and micro-detail.`;

const CRITICAL_RULES_RU = `CRITICAL RULES
- Сохранить: структуру лица, черты, тон кожи, цвет глаз, пропорции.
- Объект должен выглядеть естественно сфотографированным в сцене, а не вставленным.
- Фотореалистичный результат, высокая детализация текстур, высокое качество, разрешение и микродетали уровня 8K.`;

function normalizeLocale(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 32) return "en";
  try {
    return new Intl.Locale(value.trim()).toString();
  } catch {
    return "en";
  }
}

function sniffImageMime(buffer: Uint8Array): ParsedImage["mimeType"] | null {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function parseDataUrl(value: string): ParsedImage | null {
  const match = /^data:\s*([^;,]+)\s*;\s*base64\s*,\s*([\s\S]+)$/i.exec(
    value.trim(),
  );
  if (!match) return null;
  const compact = match[2].replace(/\s/g, "");
  if (
    !compact ||
    compact.length > MAX_BASE64_CHARS ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)
  ) {
    return null;
  }
  const buffer = Buffer.from(compact, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  const mimeType = sniffImageMime(buffer);
  return mimeType ? { mimeType, data: buffer.toString("base64") } : null;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertPublicImageUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_protocol");
  }
  if (url.username || url.password) throw new Error("invalid_url");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.includes("metadata.google") ||
    host.endsWith(".internal")
  ) {
    throw new Error("invalid_host");
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("invalid_host");
  }
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error("too_large");
  if (!response.body) throw new Error("empty_body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchImage(urlValue: string): Promise<ParsedImage> {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error("invalid_url");
  }
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicImageUrl(url);
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "promptshot-image-fetch/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("bad_redirect");
      }
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    const bytes = await readLimitedBody(response);
    const mimeType = sniffImageMime(bytes);
    if (!mimeType) throw new Error("unsupported_image");
    return { mimeType, data: Buffer.from(bytes).toString("base64") };
  }
  throw new Error("bad_redirect");
}

async function imageSettings(data: string): Promise<ExtensionImageSettings | null> {
  try {
    const metadata = await sharp(Buffer.from(data, "base64")).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const aspectRatio = inferAspectRatioFromDimensions(width, height);
    return aspectRatio ? { aspectRatio, width, height } : null;
  } catch {
    return null;
  }
}

async function geminiBaseUrl(
  supabase: ReturnType<typeof createSupabaseServer>,
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

function diagnostics(text: string, finishReason: unknown) {
  const missing = SECTION_SPEC_ORDER.filter(
    (section) => !new RegExp(`^${section}:`, "im").test(text),
  );
  const truncated = finishReason === "MAX_TOKENS" || missing.length > 0;
  return { missing, truncated };
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: "invalid_image", message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = await req.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return errorResponse("Request body must be a JSON object.");
    }
    body = parsedBody as Record<string, unknown>;
  } catch {
    return errorResponse("Request body must be valid JSON.");
  }

  const rawBase64 = body.image_base64;
  const rawUrl = body.image_url;
  const hasBase64 = typeof rawBase64 === "string" && Boolean(rawBase64.trim());
  const hasUrl = typeof rawUrl === "string" && Boolean(rawUrl.trim());
  if (hasBase64 === hasUrl) {
    return errorResponse(
      hasBase64
        ? "Send either image_base64 or image_url, not both."
        : "Provide image_base64 or image_url.",
    );
  }

  let image: ParsedImage;
  try {
    if (hasBase64) {
      const parsed = parseDataUrl(String(rawBase64));
      if (!parsed) {
        return errorResponse(
          "image_base64 must be a valid JPEG, PNG, WebP, or GIF data URL under 10 MB.",
        );
      }
      image = parsed;
    } else {
      image = await fetchImage(String(rawUrl).trim());
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (code === "too_large") return errorResponse("Image exceeds 10 MB limit.");
    if (["invalid_url", "invalid_protocol"].includes(code)) {
      return errorResponse("Invalid image URL.");
    }
    if (code === "invalid_host") return errorResponse("This URL is not allowed.");
    extensionLog("analyze.image_fetch_failed", { code });
    return errorResponse("Could not download a supported image from this URL.");
  }

  const style = "photoreal" as const;
  const locale = normalizeLocale(body.locale);
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") || requestId;
  const supabase = createSupabaseServer();
  const eventBase = {
    locale,
    style,
    model: GEMINI_MODEL,
    correlationId,
  } as const;

  const recordQuotaEvent = (
    snapshot: AnalyzeQuotaSnapshot | AnalyzeQuotaSession | null,
    allowed: boolean,
    extra: {
      outcome: Parameters<typeof recordAnalyzeEvent>[1]["outcome"];
      errorCode?: string;
      httpStatus: number;
      latencyMs?: number;
      truncated?: boolean;
      finishReason?: string;
      missingSections?: number;
    },
  ) => {
    recordAnalyzeEvent(supabase, {
      endpoint: "analyze",
      clientSource: resolveClientSource(req, {
        authenticated: snapshot?.authenticated,
      }),
      ipHash: snapshot?.ipHash || "",
      userId: snapshot?.userId ?? null,
      allowed,
      requestOrigin: req.headers.get("origin"),
      quotaMode:
        snapshot && "mode" in snapshot ? snapshot.mode : snapshot?.nextMode ?? null,
      ...eventBase,
      ...extra,
    });
  };

  extensionLog("analyze.start", {
    requestId,
    correlationId,
    locale,
    mimeType: image.mimeType,
    imageBase64Chars: image.data.length,
  });

  let snapshot: AnalyzeQuotaSnapshot;
  try {
    snapshot = await resolveAnalyzeQuotaSnapshot(req, supabase);
  } catch (error) {
    extensionLog("analyze.quota_unavailable", {
      requestId,
      phase: "snapshot",
      message: error instanceof Error ? error.message : String(error),
    });
    recordQuotaEvent(null, false, {
      outcome: "quota_unavailable",
      errorCode: "quota_unavailable",
      httpStatus: 503,
    });
    return NextResponse.json(
      {
        error: "quota_unavailable",
        message: ANALYZE_QUOTA_MESSAGES.quota_unavailable,
      },
      { status: 503 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordQuotaEvent(snapshot, false, {
      outcome: "config_error",
      errorCode: "config",
      httpStatus: 500,
    });
    return NextResponse.json(
      { error: "upstream_failed", message: "Service configuration error." },
      { status: 500 },
    );
  }

  let reservedSession: AnalyzeQuotaSession | null = null;
  try {
    const reservation = await reserveAnalyzeQuota(supabase, snapshot);
    if (!reservation.ok) {
      const denied = reservation.error;
      const httpStatus = denied === "no_credits" ? 402 : 401;
      recordQuotaEvent(reservation.snapshot, false, {
        outcome: denied,
        errorCode: denied,
        httpStatus,
      });
      return NextResponse.json(
        {
          error: denied,
          auth_required: denied === "auth_required",
          no_credits: denied === "no_credits",
          message: ANALYZE_QUOTA_MESSAGES[denied],
          quota: analyzeQuotaPublicFields(reservation.snapshot),
        },
        { status: httpStatus },
      );
    }
    if (!reservation.session.holdId) {
      throw new Error("analyze_quota_missing_hold");
    }
    reservedSession = reservation.session;
  } catch (error) {
    extensionLog("analyze.quota_unavailable", {
      requestId,
      phase: "reserve",
      message: error instanceof Error ? error.message : String(error),
    });
    recordQuotaEvent(snapshot, false, {
      outcome: "quota_unavailable",
      errorCode: "quota_unavailable",
      httpStatus: 503,
    });
    return NextResponse.json(
      {
        error: "quota_unavailable",
        message: ANALYZE_QUOTA_MESSAGES.quota_unavailable,
      },
      { status: 503 },
    );
  }

  const localeInstruction =
    locale === "en"
      ? ""
      : `\n\nWrite descriptive section bodies in ${locale}. Keep every section heading exactly in English.`;
  const prompt = `${buildExtractPrompt(style)}${localeInstruction}`;
  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: 4096,
    thinkingConfig: { thinkingBudget: 256 },
  };
  const geminiBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: image.mimeType, data: image.data } },
        ],
      },
    ],
    generationConfig,
  };
  const baseUrl = await geminiBaseUrl(supabase);
  const startedAt = Date.now();
  extensionLog("analyze.gemini_request", {
    requestId,
    correlationId,
    model: GEMINI_MODEL,
    endpointHost: new URL(baseUrl).hostname,
    viaProxy: baseUrl !== GEMINI_DIRECT_BASE_URL,
    body: redactGenerateContentBody(geminiBody),
  });

  const fail = async (
    errorCode: string,
    httpStatus: number,
    upstreamStatus?: number,
  ) => {
    if (reservedSession) {
      await releaseAnalyzeQuota(supabase, reservedSession);
    }
    recordQuotaEvent(reservedSession ?? snapshot, false, {
      outcome: "upstream_error",
      errorCode,
      httpStatus: upstreamStatus ?? httpStatus,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "upstream_failed",
        message: "Something went wrong. Please try another image.",
      },
      { status: httpStatus },
    );
  };

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl}/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(geminiBody),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );
  } catch (error) {
    extensionLog("analyze.gemini_fetch_failed", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return fail("fetch_failed", 503);
  }
  if (!response.ok) {
    extensionLog("analyze.gemini_http_error", {
      requestId,
      status: response.status,
      body: (await response.text().catch(() => "")).slice(0, 300),
    });
    return fail("gemini_http", 502, response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return fail("bad_response", 502);
  }
  const summary = summarizeGeminiApiResponse(data);
  const candidate = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = candidate.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!rawText) return fail("empty_prompt", 502);

  const criticalRules = locale.split("-")[0] === "ru"
    ? CRITICAL_RULES_RU
    : CRITICAL_RULES_EN;
  const promptText = `${rawText}\n\n${criticalRules}`;
  const promptDiagnostics = diagnostics(rawText, summary.finishReason);
  const settingsPromise = imageSettings(image.data);
  let finalSession = reservedSession;
  if (reservedSession) {
    try {
      finalSession = await confirmAnalyzeQuota(supabase, reservedSession);
    } catch (error) {
      extensionLog("analyze.quota_confirm_failed", {
        requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  recordQuotaEvent(finalSession ?? snapshot, true, {
    outcome: promptDiagnostics.truncated ? "truncated" : "success",
    errorCode: finalSession?.mode === "paid" ? "paid" : "free",
    truncated: promptDiagnostics.truncated,
    finishReason: String(summary.finishReason ?? ""),
    missingSections: promptDiagnostics.missing.length,
    httpStatus: 200,
    latencyMs: Date.now() - startedAt,
  });
  recordAnalyzeHistory(supabase, req, {
    imageBase64: image.data,
    prompt: promptText,
    style,
    locale,
    model: GEMINI_MODEL,
    userId: finalSession?.userId ?? snapshot.userId,
    ipHash: finalSession?.ipHash ?? snapshot.ipHash,
    correlationId,
    authenticated: finalSession?.authenticated ?? snapshot.authenticated,
    creditsSpent: finalSession?.creditsCharged ?? 0,
    quotaMode: finalSession?.mode ?? "free",
  });

  extensionLog("analyze.gemini_response", {
    requestId,
    correlationId,
    latencyMs: Date.now() - startedAt,
    promptChars: promptText.length,
    missingSections: promptDiagnostics.missing,
    ...summary,
  });

  const settings = await settingsPromise;
  return NextResponse.json({
    prompt: promptText,
    ...(settings ? { imageSettings: settings } : {}),
    quota: analyzeQuotaPublicFields(finalSession ?? snapshot, {
      mode: finalSession?.mode ?? "free",
      creditsCharged: finalSession?.creditsCharged ?? 0,
    }),
  });
}
