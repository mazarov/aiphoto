import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  EXPAND_PROMPTS_INSTRUCTION,
  getGeminiVibeExpandModel,
} from "@/lib/vibe-gemini-instructions";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const STYLE_FIELDS = [
  "scene",
  "genre",
  "lighting",
  "camera",
  "mood",
  "color",
  "clothing",
  "composition",
] as const;
const ALLOWED_ACCENTS = ["lighting", "mood", "composition"] as const;

type StyleField = (typeof STYLE_FIELDS)[number];
type PromptAccent = (typeof ALLOWED_ACCENTS)[number];
type StylePayload = Record<StyleField, string>;
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

function extractJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const tryParse = (candidate: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const inside = tryParse(fenced[1]);
    if (inside) return inside;
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return tryParse(trimmed.slice(firstBracket, lastBracket + 1));
  }
  return null;
}

function coerceStylePayload(input: unknown): StylePayload | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const style = {} as StylePayload;
  for (const field of STYLE_FIELDS) {
    const value = row[field];
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    if (!normalized && field !== "clothing") return null;
    style[field] = normalized;
  }
  return style;
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

    const textModel = getGeminiVibeExpandModel();
    const geminiBaseUrl = await getGeminiBaseUrlRuntime(supabase);
    const geminiUrl = `${geminiBaseUrl}/v1beta/models/${textModel}:generateContent`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${EXPAND_PROMPTS_INSTRUCTION}\n\nStyle description:\n${JSON.stringify(style, null, 2)}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    const geminiData = (await geminiRes.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = geminiData?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text || "";
    const parsed = extractJsonArray(text);
    const prompts = parsed ? coercePromptVariants(parsed) : null;
    if (!geminiRes.ok || !prompts) {
      console.error("[vibe.expand] gemini parse failed", {
        userId: user.id,
        status: geminiRes.status,
        geminiError: geminiData?.error?.message ?? null,
        textPreview: text.slice(0, 300),
      });
      return NextResponse.json({ error: "expand_failed" }, { status: 500 });
    }

    return NextResponse.json({ prompts, modelUsed: textModel });
  } catch (err) {
    console.error("[vibe.expand] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "expand_failed" }, { status: 500 });
  }
}
