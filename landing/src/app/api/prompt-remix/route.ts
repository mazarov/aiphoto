import { NextRequest, NextResponse } from "next/server";
import {
  recordAnalyzeHistory,
  serializeUnknownError,
} from "@/lib/analyze-history";
import { summarizeGeminiApiResponse } from "@/lib/gemini-vibe-debug-log";
import {
  buildRemixGenerationConfig,
  buildRemixUserText,
  hasStructuredRemixSections,
  listRemixHeadings,
  normalizeRemixPrompt,
  parseRemixModelJson,
  remixPromptsEqual,
  remixSystemInstruction,
  resolveRemixPrompt,
  type RemixAttemptMode,
} from "@/lib/prompt-remix";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export const runtime = "nodejs";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_REMIX_MODEL = "gemini-2.5-flash";
const MAX_ORIGINAL_PROMPT_CHARS = 8_000;
const MAX_CHANGE_REQUEST_CHARS = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REMIX_ATTEMPTS = 2;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const headings = listRemixHeadings(originalPrompt);
    const structured = hasStructuredRemixSections(originalPrompt);
    const userGeminiText = buildRemixUserText({
      originalPrompt,
      changeRequest,
      headings,
    });
    const identity = {
      authUserId: user.id,
      dbUserId,
      identitySource: resolved?.source ?? null,
      parentPresent: Boolean(parentGenerationId),
      parentGenerationId: parentGenerationId || null,
      model,
      endpointHost: endpointHostOf(base.url),
      viaProxy: base.proxy,
    };

    let nextPrompt = "";
    let lastMode: RemixAttemptMode = structured ? "section_edits" : "full_rewrite";
    let lastAppliedHeadings: string[] = [];
    let lastUnknownHeadings: string[] = [];
    let lastResultChars = 0;
    let lastChanged = false;

    for (let attempt = 1; attempt <= MAX_REMIX_ATTEMPTS; attempt++) {
      const mode: RemixAttemptMode =
        attempt === 1 && structured ? "section_edits" : "full_rewrite";
      lastMode = mode;
      const generationConfig = buildRemixGenerationConfig(mode, {
        temperature: attempt === 1 ? 0.2 : 0.45,
      });
      remixLog("gemini_request", requestId, {
        ...identity,
        attempt,
        remixMode: mode,
        structured,
        headings,
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
            parts: [{ text: remixSystemInstruction(mode) }],
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
      const rawText = extractGeminiText(payload);
      const candidate = (
        payload.candidates as
          | Array<{ finishReason?: string; content?: { parts?: unknown[] } }>
          | undefined
      )?.[0];
      const finishReason = candidate?.finishReason || null;
      const outputTruncated = finishReason === "MAX_TOKENS";
      const plan = parseRemixModelJson(rawText);
      const resolvedPrompt = resolveRemixPrompt(originalPrompt, plan, rawText);
      lastAppliedHeadings = resolvedPrompt.appliedHeadings;
      lastUnknownHeadings = resolvedPrompt.unknownHeadings;
      lastResultChars = resolvedPrompt.prompt.length;
      lastChanged = Boolean(resolvedPrompt.prompt) &&
        !remixPromptsEqual(resolvedPrompt.prompt, originalPrompt);
      remixLog("gemini_response", requestId, {
        ...identity,
        attempt,
        remixMode: mode,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        finishReason,
        outputTruncated,
        parseOk: Boolean(plan),
        changeApplied: plan?.changeApplied ?? null,
        resolveMode: resolvedPrompt.mode,
        appliedHeadings: resolvedPrompt.appliedHeadings,
        unknownHeadings: resolvedPrompt.unknownHeadings,
        changed: lastChanged,
        originalChars: originalPrompt.length,
        resultChars: lastResultChars,
        extractedPrompt: rawText,
        resolvedPrompt: lastChanged ? resolvedPrompt.prompt : undefined,
        google: summarizeGeminiApiResponse(payload),
        usageMetadata: payload.usageMetadata ?? null,
        googleError: payload.error ?? null,
        googleCandidates: payload.candidates ?? null,
      });
      if (!response.ok || !rawText || outputTruncated) {
        const retryable = response.status === 429 || response.status >= 500;
        const usage = payload.usageMetadata as
          | { thoughtsTokenCount?: number; candidatesTokenCount?: number }
          | undefined;
        console.error("[prompt.remix]", {
          step: "gemini_failed",
          requestId,
          ...identity,
          attempt,
          remixMode: mode,
          status: response.status,
          retryable,
          finishReason,
          candidateCount: Array.isArray(payload.candidates)
            ? payload.candidates.length
            : 0,
          resultChars: rawText.length,
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

      if (lastChanged) {
        nextPrompt = normalizeRemixPrompt(resolvedPrompt.prompt);
        break;
      }

      remixLog("unchanged_attempt", requestId, {
        ...identity,
        attempt,
        remixMode: mode,
        resolveMode: resolvedPrompt.mode,
        appliedHeadings: resolvedPrompt.appliedHeadings,
        unknownHeadings: resolvedPrompt.unknownHeadings,
        originalChars: originalPrompt.length,
        changeChars: changeRequest.length,
        resultChars: lastResultChars,
      });
    }

    if (!lastChanged || !nextPrompt) {
      remixLog("unchanged", requestId, {
        ...identity,
        remixMode: lastMode,
        appliedHeadings: lastAppliedHeadings,
        unknownHeadings: lastUnknownHeadings,
        originalChars: originalPrompt.length,
        changeChars: changeRequest.length,
        resultChars: lastResultChars,
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
      ...identity,
      remixMode: lastMode,
      appliedHeadings: lastAppliedHeadings,
      changed: true,
      originalChars: originalPrompt.length,
      changeChars: changeRequest.length,
      resultChars: nextPrompt.length,
      durationMs: Date.now() - startedAt,
    });
    recordAnalyzeHistory(supabase, req, {
      kind: "remix",
      prompt: nextPrompt,
      changeRequest,
      model,
      userId: dbUserId,
      authenticated: true,
    });
    return NextResponse.json({ prompt: nextPrompt, model });
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
