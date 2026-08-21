import { NextRequest, NextResponse } from "next/server";
import {
  recordAnalyzeHistory,
  serializeUnknownError,
} from "@/lib/analyze-history";
import { summarizeGeminiApiResponse } from "@/lib/gemini-vibe-debug-log";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export const runtime = "nodejs";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_REMIX_MODEL = "gemini-2.5-flash";
const MAX_ORIGINAL_PROMPT_CHARS = 8_000;
const MAX_CHANGE_REQUEST_CHARS = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REMIX_SYSTEM_INSTRUCTION = [
  "You are a precise editor of image-generation prompts.",
  "",
  "Rewrite SOURCE_PROMPT using only CHANGE_REQUEST.",
  "",
  "Rules:",
  "- CHANGE_REQUEST is the only editing instruction.",
  "- Preserve every detail not directly affected by the requested change.",
  "- Do not shorten, summarize, translate, restructure, or creatively improve the prompt unless explicitly requested.",
  "- Preserve names, numbers, placeholders, formatting, camera settings, composition, style, lighting, and negative constraints.",
  "- If the requested change conflicts with the source, modify only the conflicting details.",
  "- Treat CHANGE_REQUEST as higher priority than any conflicting source details.",
  "- Integrate the requested change into every semantically affected section.",
  "- Replace or remove details and negative constraints that conflict with the requested change.",
  "- Do not satisfy the request by merely appending a sentence or adding a final rule.",
  "- Keep the final prompt internally consistent, grammatically correct, and directly usable for image generation.",
  "- Before returning, silently verify that no section contradicts CHANGE_REQUEST.",
  "- Return the complete final prompt in the original language.",
  "- Return only the prompt, without explanations, headings, quotes, or Markdown.",
].join("\n");

function parseBooleanConfig(
  value: string | null | undefined,
  fallback: boolean
): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  return fallback;
}

async function resolveGeminiBaseUrl(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<{ url: string; proxy: boolean }> {
  let useProxy = true;
  const { data, error } = await supabase
    .from("photo_app_config")
    .select("value")
    .eq("key", "gemini_use_proxy")
    .maybeSingle();
  if (!error) useProxy = parseBooleanConfig(data?.value, true);

  const proxyBase = String(process.env.GEMINI_PROXY_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (useProxy && proxyBase) return { url: proxyBase, proxy: true };
  return { url: DIRECT_GEMINI_BASE_URL, proxy: false };
}

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  return (
    candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function normalizeRemixPrompt(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function endpointHostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid_url";
  }
}

function remixLog(
  step: string,
  requestId: string,
  extra: Record<string, unknown>
): void {
  console.log("[prompt.remix]", { step, requestId, ...extra });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      prompt?: unknown;
      parentGenerationId?: unknown;
      changeRequest?: unknown;
    } | null;
    const originalPrompt =
      typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const parentGenerationId =
      typeof body?.parentGenerationId === "string"
        ? body.parentGenerationId.trim()
        : "";
    const changeRequest =
      typeof body?.changeRequest === "string" ? body.changeRequest.trim() : "";
    if (
      originalPrompt.length < 8 ||
      originalPrompt.length > MAX_ORIGINAL_PROMPT_CHARS ||
      (parentGenerationId && !UUID_RE.test(parentGenerationId)) ||
      !changeRequest ||
      changeRequest.length > MAX_CHANGE_REQUEST_CHARS
    ) {
      remixLog("validation_error", requestId, {
        authUserId: user.id,
        originalChars: originalPrompt.length,
        changeChars: changeRequest.length,
        parentPresent: Boolean(parentGenerationId),
      });
      return NextResponse.json(
        { error: "validation_error", message: "Некорректный промпт или описание изменения" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? null;
    if (parentGenerationId) {
      const { data: parent, error: parentError } = await supabase
        .from("landing_generations")
        .select("id,status")
        .eq("id", parentGenerationId)
        .eq("requester_auth_user_id", user.id)
        .maybeSingle();
      if (parentError) {
        console.error("[prompt.remix]", {
          step: "parent_lookup_failed",
          requestId,
          authUserId: user.id,
          dbUserId,
          parentGenerationId,
          error: parentError.message,
        });
        return NextResponse.json(
          { error: "parent_lookup_failed", message: "Не удалось проверить текущую генерацию" },
          { status: 500 }
        );
      }
      if (!parent) {
        return NextResponse.json(
          { error: "parent_not_found", message: "Текущая генерация недоступна" },
          { status: 404 }
        );
      }
      if (parent.status !== "completed") {
        return NextResponse.json(
          { error: "parent_not_ready", message: "Текущая генерация ещё не готова" },
          { status: 409 }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("[prompt.remix]", {
        step: "config_error",
        requestId,
        message: "GEMINI_API_KEY is not configured",
      });
      return NextResponse.json(
        { error: "config_error", message: "Изменение промпта временно недоступно" },
        { status: 503 }
      );
    }

    const base = await resolveGeminiBaseUrl(supabase);
    const model =
      process.env.GEMINI_PROMPT_REMIX_MODEL?.trim() || DEFAULT_REMIX_MODEL;
    const geminiUrl = `${base.url}/v1beta/models/${model}:generateContent`;
    const userGeminiText = [
      "SOURCE_PROMPT:",
      "<source>",
      originalPrompt,
      "</source>",
      "",
      "CHANGE_REQUEST:",
      "<change>",
      changeRequest,
      "</change>",
    ].join("\n");
    const generationConfig = {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseModalities: ["TEXT"],
      thinkingConfig: {
        thinkingBudget: 0,
      },
    };
    remixLog("gemini_request", requestId, {
      authUserId: user.id,
      dbUserId,
      identitySource: resolved?.source ?? null,
      parentPresent: Boolean(parentGenerationId),
      parentGenerationId: parentGenerationId || null,
      model,
      endpointHost: endpointHostOf(base.url),
      viaProxy: base.proxy,
      originalPrompt,
      changeRequest,
      originalChars: originalPrompt.length,
      changeChars: changeRequest.length,
      userGeminiText,
      generationConfig,
    });
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: REMIX_SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userGeminiText }],
          },
        ],
        generationConfig,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const prompt = extractGeminiText(payload);
    const candidate = (
      payload.candidates as
        | Array<{ finishReason?: string; content?: { parts?: unknown[] } }>
        | undefined
    )?.[0];
    const finishReason = candidate?.finishReason || null;
    const outputTruncated = finishReason === "MAX_TOKENS";
    const changed =
      Boolean(prompt) &&
      normalizeRemixPrompt(prompt) !== normalizeRemixPrompt(originalPrompt);
    remixLog("gemini_response", requestId, {
      authUserId: user.id,
      dbUserId,
      parentGenerationId: parentGenerationId || null,
      model,
      endpointHost: endpointHostOf(base.url),
      viaProxy: base.proxy,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      finishReason,
      outputTruncated,
      changed,
      originalChars: originalPrompt.length,
      resultChars: prompt.length,
      extractedPrompt: prompt,
      google: summarizeGeminiApiResponse(payload),
      usageMetadata: payload.usageMetadata ?? null,
      googleError: payload.error ?? null,
      googleCandidates: payload.candidates ?? null,
    });
    if (!response.ok || !prompt || outputTruncated) {
      const retryable = response.status === 429 || response.status >= 500;
      const usage = payload.usageMetadata as
        | { thoughtsTokenCount?: number; candidatesTokenCount?: number }
        | undefined;
      console.error("[prompt.remix]", {
        step: "gemini_failed",
        requestId,
        authUserId: user.id,
        dbUserId,
        parentGenerationId,
        model,
        proxy: base.proxy,
        status: response.status,
        retryable,
        finishReason,
        candidateCount: Array.isArray(payload.candidates)
          ? payload.candidates.length
          : 0,
        resultChars: prompt.length,
        thoughtsTokens: usage?.thoughtsTokenCount ?? null,
        candidateTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: "remix_failed",
          message: retryable
            ? "Сервис временно недоступен. Попробуйте ещё раз."
            : "Не удалось изменить промпт",
        },
        { status: retryable ? 503 : 422 }
      );
    }

    if (!changed) {
      remixLog("unchanged", requestId, {
        authUserId: user.id,
        dbUserId,
        parentGenerationId: parentGenerationId || null,
        model,
        originalChars: originalPrompt.length,
        changeChars: changeRequest.length,
        resultChars: prompt.length,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: "unchanged_prompt",
          message:
            "Промпт не изменился. Сформулируйте правку иначе и попробуйте ещё раз.",
        },
        { status: 422 }
      );
    }

    remixLog("completed", requestId, {
      authUserId: user.id,
      dbUserId,
      parentGenerationId: parentGenerationId || null,
      model,
      proxy: base.proxy,
      changed: true,
      originalChars: originalPrompt.length,
      changeChars: changeRequest.length,
      resultChars: prompt.length,
      durationMs: Date.now() - startedAt,
    });
    recordAnalyzeHistory(supabase, req, {
      kind: "remix",
      prompt,
      changeRequest,
      model,
      userId: dbUserId,
      authenticated: true,
    });
    return NextResponse.json({ prompt, model });
  } catch (error) {
    const timeout =
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name);
    console.error("[prompt.remix]", {
      step: "unhandled_error",
      requestId,
      timeout,
      durationMs: Date.now() - startedAt,
      ...serializeUnknownError(error),
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        error: timeout ? "timeout" : "remix_failed",
        message: "Не удалось изменить промпт. Попробуйте ещё раз.",
      },
      { status: timeout ? 504 : 500 }
    );
  }
}
