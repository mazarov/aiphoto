import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import {
  assembleLandingCardFinalPrompt,
  assembleVibeFinalPrompt,
  VIBE_IMAGE_PART_LABEL_REFERENCE,
  VIBE_IMAGE_PART_LABEL_SUBJECT,
} from "../../landing/src/lib/image-generation-prompt";
import { getVibeAttachReferenceImage } from "./lib/vibe-config";
import { errorFields, log } from "./lib/logger";

const UPLOADS_BUCKET = "web-generation-uploads";
export const RESULTS_BUCKET = "web-generation-results";
const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

export type GenerationJob = {
  id: string;
  user_id: string;
  prompt_text: string | null;
  model: string;
  aspect_ratio: string;
  image_size: string;
  input_photo_paths: string[] | null;
  vibe_id: string | null;
  pipeline_trace_id: string | null;
  attempts: number;
  max_attempts: number;
  lease_token: string;
  create_ugc: boolean;
};

export class ProcessingError extends Error {
  constructor(
    readonly errorType: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProcessingError";
  }
}

type ImagePart = { inlineData: { mimeType: string; data: string } };
type RequestPart = { text?: string; inlineData?: { mimeType: string; data: string } };

function mimeForPath(path: string): string {
  const clean = path.toLowerCase().split("?")[0];
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function storageStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const raw = error as { status?: number; statusCode?: number | string };
  const status = Number(raw.status ?? raw.statusCode);
  return Number.isFinite(status) ? status : null;
}

function isTemporary(error: unknown): boolean {
  const status = storageStatus(error);
  if (status === 429 || (status != null && status >= 500 && status <= 599)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|fetch failed|econn|enotfound|socket|429|5\d\d/i.test(message);
}

function geminiFailure(
  payload: Record<string, unknown>,
  status: number,
): ProcessingError {
  const apiError = payload.error as { message?: string; status?: string; code?: number } | undefined;
  const feedback = payload.promptFeedback as {
    blockReason?: string;
    blockReasonMessage?: string;
  } | undefined;
  const candidate = (payload.candidates as Array<{
    finishReason?: string;
    finishMessage?: string;
    content?: { parts?: Array<{ text?: string }> };
  }> | undefined)?.[0];
  const chunks = [
    apiError?.message,
    feedback?.blockReasonMessage,
    feedback?.blockReason && `blockReason=${feedback.blockReason}`,
    candidate?.finishMessage,
    candidate?.finishReason && `finishReason=${candidate.finishReason}`,
    candidate?.content?.parts?.find((part) => part.text)?.text?.slice(0, 500),
  ].filter((value): value is string => Boolean(value));
  const message = (chunks.join(" | ") || `Gemini HTTP ${status}`).slice(0, 2000);
  const safety =
    Boolean(feedback?.blockReason) ||
    /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/i.test(candidate?.finishReason || "") ||
    /safety|policy|blocked|prohibited/i.test(apiError?.status || "");
  if (safety) return new ProcessingError("safety_block", message, false);
  if (status === 429 || (status >= 500 && status <= 599)) {
    return new ProcessingError(`gemini_http_${status}`, message, true);
  }
  return new ProcessingError(
    apiError?.status || feedback?.blockReason || candidate?.finishReason || "gemini_error",
    message,
    false,
  );
}

async function geminiBaseUrl(supabase: SupabaseClient): Promise<{ url: string; proxy: boolean }> {
  let useProxy = true;
  const { data, error } = await supabase
    .from("photo_app_config")
    .select("value")
    .eq("key", "gemini_use_proxy")
    .maybeSingle();
  if (!error && data?.value != null) {
    useProxy = !["false", "0", "no", "off"].includes(String(data.value).trim().toLowerCase());
  }
  if (useProxy && config.geminiProxyBaseUrl) {
    return { url: config.geminiProxyBaseUrl, proxy: true };
  }
  return { url: DIRECT_GEMINI_BASE_URL, proxy: false };
}

async function downloadInputs(
  supabase: SupabaseClient,
  job: GenerationJob,
): Promise<ImagePart[]> {
  const paths = job.input_photo_paths || [];
  if (!paths.length) throw new ProcessingError("input_missing", "No input photos", false);
  const parts: ImagePart[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(UPLOADS_BUCKET).download(path);
    if (error || !data) {
      const status = storageStatus(error);
      const missing = status === 400 || status === 404 || /not found|does not exist/i.test(error?.message || "");
      throw new ProcessingError(
        missing ? "input_missing" : "storage_download_error",
        `Input download failed: ${path}: ${error?.message || "empty response"}`,
        !missing && isTemporary(error),
      );
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    if (!buffer.length) throw new ProcessingError("input_missing", `Input is empty: ${path}`, false);
    parts.push({ inlineData: { mimeType: mimeForPath(path), data: buffer.toString("base64") } });
  }
  return parts;
}

async function downloadReference(
  url: string,
  signal: AbortSignal,
): Promise<ImagePart | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PromptShotBot/1.0 (+https://promptshot.ru)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        throw new ProcessingError(
          "vibe_reference_download_error",
          `Reference download returned HTTP ${response.status}`,
          true,
        );
      }
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) return null;
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim();
    const mimeType = ["image/png", "image/webp"].includes(contentType) ? contentType : "image/jpeg";
    return { inlineData: { mimeType, data: buffer.toString("base64") } };
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    if (signal.aborted) {
      throw new ProcessingError("shutdown", "Worker is shutting down", true);
    }
    log("warn", "reference_download_failed", { ...errorFields(error) });
    throw new ProcessingError(
      "vibe_reference_download_error",
      error instanceof Error ? error.message : String(error),
      true,
    );
  }
}

export async function processGeneration(
  supabase: SupabaseClient,
  job: GenerationJob,
  signal: AbortSignal,
  ensureLease: () => Promise<void>,
): Promise<{ resultPath: string; rawPrompt: string }> {
  const context = {
    generationId: job.id,
    userId: job.user_id,
    attempt: job.attempts,
    pipelineTrace: job.pipeline_trace_id,
  };
  log("info", "generation_started", context);
  const inputParts = await downloadInputs(supabase, job);
  await ensureLease();

  const rawPrompt = String(job.prompt_text || "");
  if (!rawPrompt.trim()) throw new ProcessingError("input_missing", "Prompt text is empty", false);
  const isVibe = Boolean(job.vibe_id);
  let reference: ImagePart | null = null;
  let attachReference = false;

  if (job.vibe_id) {
    attachReference = await getVibeAttachReferenceImage(supabase);
    const { data: vibe, error } = await supabase
      .from("vibes")
      .select("source_image_url,prompt_chain")
      .eq("id", job.vibe_id)
      .single();
    if (error || !vibe) throw new ProcessingError("input_missing", "Vibe configuration not found", false);
    if (attachReference && vibe.source_image_url) {
      reference = await downloadReference(String(vibe.source_image_url), signal);
    }
    if (attachReference && !reference) {
      throw new ProcessingError(
        "vibe_reference_missing",
        "Steal This Vibe reference image is required but unavailable",
        false,
      );
    }
  }

  const hasReference = isVibe && Boolean(reference);
  const fullPrompt = isVibe
    ? assembleVibeFinalPrompt(rawPrompt, hasReference)
    : assembleLandingCardFinalPrompt(rawPrompt);
  if (!config.geminiApiKey) {
    throw new ProcessingError("config_error", "GEMINI_API_KEY is not configured", false);
  }
  if (!job.model || !job.aspect_ratio || !job.image_size) {
    throw new ProcessingError("config_error", "Generation model, aspect ratio, or image size is missing", false);
  }
  const parts: RequestPart[] =
    hasReference && reference
      ? [
          { text: VIBE_IMAGE_PART_LABEL_REFERENCE },
          reference,
          { text: VIBE_IMAGE_PART_LABEL_SUBJECT },
          ...inputParts,
          { text: fullPrompt },
        ]
      : [...inputParts, { text: fullPrompt }];
  const base = await geminiBaseUrl(supabase);
  const geminiUrl = `${base.url}/v1beta/models/${job.model}:generateContent`;
  await ensureLease();
  log("info", "gemini_request_started", {
    ...context,
    model: job.model,
    proxy: base.proxy,
    partCount: parts.length,
    hasReference,
  });

  let response: Response;
  try {
    response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: job.aspect_ratio, imageSize: job.image_size },
        },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
    });
  } catch (error) {
    if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new ProcessingError(timeout ? "timeout" : "network_error", String((error as Error)?.message || error), true);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new ProcessingError(
      "gemini_response_parse",
      `Gemini returned non-JSON response (HTTP ${response.status})`,
      response.status === 429 || response.status >= 500,
    );
  }
  const candidate = (payload.candidates as Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string } }> };
  }> | undefined)?.[0];
  const imageBase64 = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!response.ok || !imageBase64) throw geminiFailure(payload, response.status);

  const imageBuffer = Buffer.from(imageBase64, "base64");
  if (!imageBuffer.length) throw new ProcessingError("gemini_error", "Gemini returned an empty image", false);
  await ensureLease();
  const resultPath = `${job.user_id}/${job.id}/${job.lease_token}.png`;
  const { error: uploadError } = await supabase.storage
    .from(RESULTS_BUCKET)
    .upload(resultPath, imageBuffer, { contentType: "image/png", upsert: true });
  if (uploadError) {
    throw new ProcessingError(
      "result_upload_error",
      uploadError.message,
      isTemporary(uploadError),
    );
  }
  log("info", "result_uploaded", { ...context, resultPath, bytes: imageBuffer.length });
  return { resultPath, rawPrompt };
}
