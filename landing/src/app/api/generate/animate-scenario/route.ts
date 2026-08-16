import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import {
  isStoragePathOwnedByAuthUser,
  USER_GENERATION_PHOTOS_BUCKET,
} from "@/lib/user-generation-photos";
import { IMAGE_GENERATION_MODALITY } from "@/lib/generation/image-options";
import { isVideoAnimateUnlocked } from "@/lib/video-generation-contract";
import {
  ANIMATE_SCENARIO_MODEL,
  ANIMATE_SCENARIO_SYSTEM_PROMPT,
  buildAnimateScenarioUserText,
  sanitizeAnimateScenario,
} from "@/lib/video-animate-scenario";

export const runtime = "nodejs";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_IMAGE_PX = 1280;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBooleanConfig(value: string | null | undefined, fallback: boolean): boolean {
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

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      parentGenerationId?: unknown;
      photoStoragePath?: unknown;
      sourcePrompt?: unknown;
    } | null;
    const parentGenerationId =
      typeof body?.parentGenerationId === "string" ? body.parentGenerationId.trim() : "";
    const photoStoragePath =
      typeof body?.photoStoragePath === "string" ? body.photoStoragePath.trim() : "";
    const sourcePrompt =
      typeof body?.sourcePrompt === "string" ? body.sourcePrompt.slice(0, 8_000) : "";

    if (parentGenerationId && photoStoragePath) {
      return NextResponse.json(
        { error: "validation_error", message: "Укажите либо фото, либо готовую генерацию" },
        { status: 400 }
      );
    }
    if (parentGenerationId && !UUID_RE.test(parentGenerationId)) {
      return NextResponse.json(
        { error: "validation_error", message: "Некорректная генерация" },
        { status: 400 }
      );
    }
    if (photoStoragePath && !isStoragePathOwnedByAuthUser(photoStoragePath, user.id)) {
      return NextResponse.json({ error: "forbidden", message: "Недоступное фото" }, { status: 403 });
    }
    if (!parentGenerationId && !photoStoragePath) {
      return NextResponse.json(
        { error: "validation_error", message: "Для сценария нужно одно фото" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    const { data: flagRow } = await supabase
      .from("landing_generation_config")
      .select("value")
      .eq("key", "video_animate_enabled")
      .maybeSingle();
    if (!isVideoAnimateUnlocked(flagRow?.value, user.email)) {
      return NextResponse.json(
        { error: "video_disabled", message: "Оживление фото пока недоступно" },
        { status: 503 }
      );
    }

    let imageBytes: Buffer | null = null;
    let resolvedSourcePrompt = sourcePrompt;
    if (parentGenerationId) {
      const resolved = await resolveSharedDbUserId(supabase, user);
      const dbUserId = resolved?.dbUserId ?? user.id;
      const { data: parent, error: parentError } = await supabase
        .from("landing_generations")
        .select(
          "id,status,modality,result_storage_bucket,result_storage_path,prompt_text"
        )
        .eq("id", parentGenerationId)
        .or(landingGenerationsOwnerOrFilter(user.id, dbUserId))
        .maybeSingle();
      if (parentError) {
        console.error("[animate.scenario] parent lookup failed", {
          userId: user.id,
          parentGenerationId,
          error: parentError.message,
        });
        return NextResponse.json(
          { error: "parent_lookup_failed", message: "Не удалось проверить генерацию" },
          { status: 500 }
        );
      }
      if (!parent) {
        return NextResponse.json({ error: "forbidden", message: "Генерация недоступна" }, { status: 403 });
      }
      if (
        parent.status !== "completed" ||
        (parent.modality || "image") !== IMAGE_GENERATION_MODALITY ||
        !parent.result_storage_bucket ||
        !parent.result_storage_path
      ) {
        return NextResponse.json(
          { error: "parent_not_ready", message: "Оживить можно только готовое фото" },
          { status: 409 }
        );
      }
      if (!resolvedSourcePrompt.trim() && typeof parent.prompt_text === "string") {
        resolvedSourcePrompt = parent.prompt_text;
      }
      const { data: file, error: downloadError } = await supabase.storage
        .from(parent.result_storage_bucket)
        .download(parent.result_storage_path);
      if (downloadError || !file) {
        return NextResponse.json(
          { error: "input_missing", message: "Не удалось прочитать фото" },
          { status: 500 }
        );
      }
      imageBytes = Buffer.from(await file.arrayBuffer());
    } else {
      const { data: file, error: downloadError } = await supabase.storage
        .from(USER_GENERATION_PHOTOS_BUCKET)
        .download(photoStoragePath);
      if (downloadError || !file) {
        return NextResponse.json(
          { error: "input_missing", message: "Не удалось прочитать фото" },
          { status: 500 }
        );
      }
      imageBytes = Buffer.from(await file.arrayBuffer());
    }

    if (!imageBytes?.length) {
      return NextResponse.json(
        { error: "input_missing", message: "Фото пустое" },
        { status: 400 }
      );
    }

    const resized = await sharp(imageBytes)
      .rotate()
      .resize(MAX_IMAGE_PX, MAX_IMAGE_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("[animate.scenario] GEMINI_API_KEY is not configured");
      return NextResponse.json(
        { error: "config_error", message: "Сценарий временно недоступен" },
        { status: 503 }
      );
    }

    const base = await resolveGeminiBaseUrl(supabase);
    const model =
      process.env.GEMINI_ANIMATE_SCENARIO_MODEL?.trim() || ANIMATE_SCENARIO_MODEL;
    const geminiUrl = `${base.url}/v1beta/models/${model}:generateContent`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: ANIMATE_SCENARIO_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: resized.toString("base64"),
                },
              },
              { text: buildAnimateScenarioUserText(resolvedSourcePrompt) },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 256,
          responseModalities: ["TEXT"],
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const scenario = sanitizeAnimateScenario(extractGeminiText(payload));
    if (!response.ok || !scenario) {
      const retryable = response.status === 429 || response.status >= 500;
      console.error("[animate.scenario] Gemini failed", {
        userId: user.id,
        parentGenerationId: parentGenerationId || null,
        model,
        proxy: base.proxy,
        status: response.status,
        retryable,
        resultChars: scenario.length,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: "scenario_failed",
          message: retryable
            ? "Сервис временно недоступен. Попробуйте ещё раз."
            : "Не удалось придумать сценарий",
        },
        { status: retryable ? 503 : 422 }
      );
    }

    console.log("[animate.scenario] completed", {
      userId: user.id,
      parentGenerationId: parentGenerationId || null,
      model,
      proxy: base.proxy,
      resultChars: scenario.length,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ scenario, model });
  } catch (error) {
    console.error("[animate.scenario] failed", error);
    return NextResponse.json(
      { error: "scenario_failed", message: "Не удалось придумать сценарий" },
      { status: 500 }
    );
  }
}
