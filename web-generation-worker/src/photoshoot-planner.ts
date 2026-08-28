import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { config } from "./config";
import { ProcessingError } from "./input-source";
import { log } from "./lib/logger";
import {
  extractJsonObject,
  parsePhotoshootPlan,
  type PhotoshootPlan,
} from "../../landing/src/lib/photoshoot";
import {
  PHOTOSHOOT_PLANNER_MODEL,
  PHOTOSHOOT_PLANNER_PROMPT_VERSION,
  PHOTOSHOOT_PLANNER_SYSTEM_PROMPT,
  buildPhotoshootPlannerUserText,
  photoshootPlannerGenerationConfig,
} from "../../landing/src/lib/photoshoot-planner";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const PLANNER_TIMEOUT_MS = 25_000;
const MAX_IMAGE_PX = 1280;

type PlannerImage = { mimeType: string; data: string };

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates as
    | Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }>
    | undefined;
  return (
    candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function plannerDiagnostics(payload: Record<string, unknown>, text: string) {
  const candidate = (payload.candidates as Array<Record<string, unknown>> | undefined)?.[0];
  const feedback = payload.promptFeedback as { blockReason?: string } | undefined;
  return {
    finishReason: typeof candidate?.finishReason === "string" ? candidate.finishReason : null,
    blockReason: feedback?.blockReason || null,
    textLen: text.length,
    textHead: text.slice(0, 180),
  };
}

async function plannerBaseUrl(supabase: SupabaseClient): Promise<{ url: string; proxy: boolean }> {
  const proxyBase = config.geminiProxyBaseUrl;
  if (!proxyBase) {
    throw new ProcessingError(
      "config_error",
      "GEMINI_PROXY_BASE_URL is required for photoshoot planner",
      false,
    );
  }
  let useProxy = true;
  const { data, error } = await supabase
    .from("photo_app_config")
    .select("value")
    .eq("key", "gemini_use_proxy")
    .maybeSingle();
  if (!error && data?.value != null) {
    useProxy = !["false", "0", "no", "off"].includes(String(data.value).trim().toLowerCase());
  }
  if (!useProxy) {
    return { url: DIRECT_GEMINI_BASE_URL, proxy: false };
  }
  return { url: proxyBase, proxy: true };
}

async function shrinkPlannerImage(image: PlannerImage): Promise<PlannerImage> {
  try {
    const input = Buffer.from(image.data, "base64");
    const resized = await sharp(input)
      .rotate()
      .resize({ width: MAX_IMAGE_PX, height: MAX_IMAGE_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { mimeType: "image/jpeg", data: resized.toString("base64") };
  } catch {
    return image;
  }
}

async function requestPlan(
  image: PlannerImage,
  baseUrl: string,
  signal: AbortSignal,
  temperature: number,
): Promise<{ text: string; payload: Record<string, unknown> }> {
  if (!config.geminiApiKey) {
    throw new ProcessingError("config_error", "GEMINI_API_KEY is required for photoshoot planner", false);
  }
  const url = `${baseUrl.replace(/\/+$/, "")}/v1beta/models/${PHOTOSHOOT_PLANNER_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: PHOTOSHOOT_PLANNER_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: image.mimeType, data: image.data } },
            { text: buildPhotoshootPlannerUserText(temperature) },
          ],
        },
      ],
      generationConfig: photoshootPlannerGenerationConfig(temperature),
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(PLANNER_TIMEOUT_MS)]),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const text = extractGeminiText(payload);
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ProcessingError(
      `photoshoot_planner_http_${response.status}`,
      text || `Planner HTTP ${response.status}`,
      retryable,
    );
  }
  return { text, payload };
}

export async function planPhotoshootShots(input: {
  supabase: SupabaseClient;
  image: PlannerImage;
  signal: AbortSignal;
  generationId: string;
  temperature?: unknown;
}): Promise<PhotoshootPlan> {
  const temperature = photoshootPlannerGenerationConfig(input.temperature).temperature;
  const { url, proxy } = await plannerBaseUrl(input.supabase);
  const image = await shrinkPlannerImage(input.image);
  let lastError: ProcessingError | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { text, payload } = await requestPlan(image, url, input.signal, temperature);
      const plan = parsePhotoshootPlan(extractJsonObject(text));
      if (!plan) {
        lastError = new ProcessingError(
          "photoshoot_planner_parse",
          "Photoshoot planner returned invalid JSON",
          false,
        );
        log("warn", "photoshoot_planner_parse_failed", {
          generationId: input.generationId,
          attempt,
          viaProxy: proxy,
          version: PHOTOSHOOT_PLANNER_PROMPT_VERSION,
          ...plannerDiagnostics(payload, text),
        });
        continue;
      }
      log("info", "photoshoot_planner_ok", {
        generationId: input.generationId,
        attempt,
        viaProxy: proxy,
        version: PHOTOSHOOT_PLANNER_PROMPT_VERSION,
        temperature,
        theme: plan.theme,
      });
      return plan;
    } catch (error) {
      if (error instanceof ProcessingError && error.retryable && attempt < 2) {
        lastError = error;
        continue;
      }
      if (error instanceof ProcessingError) throw error;
      throw new ProcessingError(
        "photoshoot_planner_error",
        error instanceof Error ? error.message : String(error),
        false,
      );
    }
  }
  throw lastError || new ProcessingError("photoshoot_planner_parse", "Planner failed", false);
}
