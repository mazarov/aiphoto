import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  EXPAND_PROMPTS_INSTRUCTION,
  getGeminiVibeExpandModel,
  coerceStylePayload,
  type StylePayload,
} from "@/lib/vibe-gemini-instructions";
import {
  fetchErrorDetails,
  isGeminiVibeDebug,
  parseGeminiJsonArray,
  redactGenerateContentBody,
  summarizeGeminiApiResponse,
} from "@/lib/gemini-vibe-debug-log";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const ALLOWED_ACCENTS = ["lighting", "mood", "composition"] as const;

type PromptAccent = (typeof ALLOWED_ACCENTS)[number];
type PromptVariant = { accent: PromptAccent; prompt: string };

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

function coercePromptVariants(input: unknown[]): PromptVariant[] | null {
  if (input.length !== 3) return null;
  const variants: PromptVariant[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const accent = row.accent;
    const prompt = row.prompt;
    if (!ALLOWED_ACCENTS.includes(accent as PromptAccent)) return null;
    if (typeof prompt !== "string") return null;
    const normalized = prompt.trim();
    if (normalized.length < 8) return null;
    variants.push({ accent: accent as PromptAccent, prompt: normalized });
  }
  const dedup = new Set(variants.map((v) => v.accent));
  return dedup.size === 3 ? variants : null;
}

function diagnosePromptArray(parsed: unknown[] | null): Record<string, unknown> {
  if (!parsed) return { reason: "no_array" };
  if (parsed.length !== 3) return { reason: "length_not_3", length: parsed.length };
  const items = parsed.map((item, i) => {
    if (!item || typeof item !== "object") return { index: i, shape: typeof item };
    const row = item as Record<string, unknown>;
    return {
      index: i,
      keys: Object.keys(row),
      accent: row.accent,
      promptType: typeof row.prompt,
      promptLen: typeof row.prompt === "string" ? row.prompt.length : null,
    };
  });
  return { items };
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
    if (!style && body.vibeId) {
      const { data } = await supabase
        .from("vibes")
        .select("style,user_id")
        .eq("id", body.vibeId)
        .single();
      if (data && data.user_id === user.id) {
        style = coerceStylePayload(data.style);
      }
    }

    if (!style) {
      return NextResponse.json({ error: "missing_style" }, { status: 400 });
    }

    console.warn("[vibe.expand] request_begin", {
      userId: user.id,
      hasStyleInBody: body.style !== undefined && body.style !== null,
      vibeId: body.vibeId ?? null,
    });

    const textModel = getGeminiVibeExpandModel();
    const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
    const geminiUrl = `${geminiBaseUrl}/v1beta/models/${textModel}:generateContent`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    const expandUserText = `${EXPAND_PROMPTS_INSTRUCTION}\n\nStyle description:\n${JSON.stringify(style, null, 2)}`;
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

    const { value: parsed, stages: parseStages } = parseGeminiJsonArray(text);
    const prompts = parsed ? coercePromptVariants(parsed) : null;

    if (!geminiRes.ok || !prompts) {
      const stageLine = parseStages
        .map((s) => `${s.stage}:${s.ok ? "ok" : "fail"}${s.message ? `(${String(s.message).slice(0, 120)})` : ""}`)
        .join(" | ");
      console.error(
        `[vibe.expand] PIPELINE_FAIL user=${user.id} http=${geminiRes.status} arrayParsed=${Boolean(parsed)} promptsOk=${Boolean(prompts)} stages=${stageLine}`,
      );
      console.error("[vibe.expand] gemini_pipeline_failed", {
        userId: user.id,
        model: textModel,
        httpStatus: geminiRes.status,
        geminiError: geminiData?.error?.message ?? null,
        textLen: text.length,
        jsonArrayParsed: Boolean(parsed),
        parseStages,
        promptCoerceOk: Boolean(prompts),
        promptArrayDiagnose: diagnosePromptArray(parsed),
        textHead: text.slice(0, 500),
        textTail: text.length > 500 ? text.slice(-300) : undefined,
      });
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    console.warn("[vibe.expand] gemini_parse_ok", {
      userId: user.id,
      parseStages: parseStages.filter((s) => s.ok).map((s) => s.stage),
      promptsCount: prompts.length,
    });

    return NextResponse.json({ prompts, modelUsed: textModel });
  } catch (err) {
    console.error("[vibe.expand] unhandled error", {
      ...toErrorMeta(err),
      ...fetchErrorDetails(err),
    });
    return NextResponse.json({ error: "expand_failed" }, { status: 500 });
  }
}
