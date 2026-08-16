import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleVideoMotionPrompt } from "../../landing/src/lib/video-motion-prompt";
import { config } from "./config";
import { errorFields, log } from "./lib/logger";
import {
  ProcessingError,
  assertVideoInputSource,
  resolveGenerationInputSource,
  RESULTS_BUCKET,
  type GenerationInputSource,
  type ParentGenerationInput,
} from "./input-source";
import type { GenerationJob } from "./process-generation";
import {
  buildVideoInteractionRequest,
  extractInteractionId,
  extractInteractionVideo,
  interactionErrorMessage,
  interactionStatus,
  isInteractionCompleted,
  isInteractionFailed,
  isSafetyBlock,
  type InteractionVideoRef,
} from "./video-interaction";

const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const VIDEO_MIME = "video/mp4";

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

async function resolveVideoInput(
  supabase: SupabaseClient,
  job: GenerationJob,
): Promise<GenerationInputSource> {
  let parent: ParentGenerationInput | null = null;
  if (job.parent_generation_id) {
    const { data, error } = await supabase
      .from("landing_generations")
      .select("requester_auth_user_id,status,result_storage_bucket,result_storage_path,modality")
      .eq("id", job.parent_generation_id)
      .maybeSingle();
    if (error) {
      throw new ProcessingError("parent_generation_lookup_error", error.message, true);
    }
    if (data && (data.modality || "image") !== "image") {
      throw new ProcessingError(
        "parent_generation_not_image",
        "Parent generation is not an image",
        false,
      );
    }
    parent = data as ParentGenerationInput | null;
  }
  return assertVideoInputSource(resolveGenerationInputSource(job, parent));
}

async function downloadSourceImage(
  supabase: SupabaseClient,
  source: GenerationInputSource,
): Promise<{ mimeType: string; data: string }> {
  const path = source.paths[0];
  const { data, error } = await supabase.storage.from(source.bucket).download(path);
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
  return { mimeType: mimeForPath(path), data: buffer.toString("base64") };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new ProcessingError(
      "gemini_response_parse",
      `Gemini returned non-JSON response (HTTP ${response.status})`,
      response.status === 429 || response.status >= 500,
    );
  }
}

function failureFromPayload(payload: Record<string, unknown>, status: number): ProcessingError {
  const message = interactionErrorMessage(payload);
  if (isSafetyBlock(payload, message)) {
    return new ProcessingError("safety_block", message, false);
  }
  if (status === 429 || status >= 500) {
    return new ProcessingError(`gemini_http_${status}`, message, true);
  }
  return new ProcessingError("gemini_error", message, false);
}

async function submitInteraction(input: {
  baseUrl: string;
  model: string;
  prompt: string;
  image: { mimeType: string; data: string };
  aspectRatio: string;
  signal: AbortSignal;
}): Promise<string> {
  const response = await fetch(`${input.baseUrl}/v1beta/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey,
    },
    body: JSON.stringify(
      buildVideoInteractionRequest({
        model: input.model,
        prompt: input.prompt,
        image: input.image,
        aspectRatio: input.aspectRatio,
      })
    ),
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(60000)]),
  });
  const payload = await readJson(response);
  const id = extractInteractionId(payload);
  if (!response.ok || !id) throw failureFromPayload(payload, response.status);
  return id;
}

async function getInteraction(
  baseUrl: string,
  operationId: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const encoded = encodeURIComponent(operationId);
  const response = await fetch(`${baseUrl}/v1beta/interactions/${encoded}`, {
    headers: { "x-goog-api-key": config.geminiApiKey },
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  const payload = await readJson(response);
  if (!response.ok) throw failureFromPayload(payload, response.status);
  return payload;
}

async function downloadVideoRef(
  baseUrl: string,
  ref: InteractionVideoRef,
  signal: AbortSignal,
): Promise<Buffer> {
  if (ref.kind === "inline" && ref.data) {
    const buffer = Buffer.from(ref.data, "base64");
    if (!buffer.length) throw new ProcessingError("gemini_error", "Empty inline video", false);
    return buffer;
  }
  if (!ref.uri) throw new ProcessingError("gemini_error", "Video URI is missing", false);
  const uri = ref.uri.startsWith("http")
    ? ref.uri
    : `${baseUrl}${ref.uri.startsWith("/") ? "" : "/"}${ref.uri}`;
  const response = await fetch(uri, {
    headers: { "x-goog-api-key": config.geminiApiKey },
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  });
  if (!response.ok) {
    throw new ProcessingError(
      `gemini_http_${response.status}`,
      `Video download failed (HTTP ${response.status})`,
      response.status === 429 || response.status >= 500,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new ProcessingError("gemini_error", "Downloaded video is empty", false);
  return buffer;
}

export async function processVideoGeneration(
  supabase: SupabaseClient,
  job: GenerationJob,
  signal: AbortSignal,
  ensureLease: () => Promise<void>,
): Promise<{ resultPath: string; rawPrompt: string; mimeType: string }> {
  const context = {
    generationId: job.id,
    userId: job.user_id,
    attempt: job.attempts,
    pipelineTrace: job.pipeline_trace_id,
  };
  log("info", "video_generation_started", context);
  if (!config.geminiApiKey) {
    throw new ProcessingError("config_error", "GEMINI_API_KEY is not configured", false);
  }
  const source = await resolveVideoInput(supabase, job);
  const image = await downloadSourceImage(supabase, source);
  await ensureLease();

  const rawPrompt = String(job.prompt_text || "").trim();
  if (!rawPrompt) throw new ProcessingError("input_missing", "Prompt text is empty", false);
  const motionPrompt = assembleVideoMotionPrompt(rawPrompt);
  const base = await geminiBaseUrl(supabase);
  let operationId = String(job.provider_operation_id || "").trim();

  if (!operationId) {
    log("info", "video_submit", { ...context, model: job.model, proxy: base.proxy });
    try {
      operationId = await submitInteraction({
        baseUrl: base.url,
        model: job.model,
        prompt: motionPrompt,
        image,
        aspectRatio: job.aspect_ratio || "9:16",
        signal,
      });
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new ProcessingError(timeout ? "timeout" : "network_error", String((error as Error)?.message || error), true);
    }
    const { data: saved, error: saveError } = await supabase.rpc("landing_save_provider_operation", {
      p_generation_id: job.id,
      p_worker_id: config.workerId,
      p_lease_token: job.lease_token,
      p_provider_operation_id: operationId,
    });
    if (saveError || saved !== true) {
      log("error", "video_operation_persist_failed", {
        ...context,
        operationId,
        error: saveError?.message,
      });
      throw new ProcessingError(
        "provider_operation_persist_failed",
        saveError?.message || "Failed to persist provider operation",
        true,
      );
    }
    job.provider_operation_id = operationId;
  } else {
    log("info", "video_resume", { ...context, operationId });
  }

  const startedAt = Date.now();
  let payload: Record<string, unknown> | null = null;
  while (Date.now() - startedAt < config.videoTimeoutMs) {
    if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
    await ensureLease();
    try {
      payload = await getInteraction(base.url, operationId, signal);
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
      throw new ProcessingError("network_error", String((error as Error)?.message || error), true);
    }
    const status = interactionStatus(payload);
    if (isInteractionCompleted(status) || extractInteractionVideo(payload)) break;
    if (isInteractionFailed(status)) {
      const message = interactionErrorMessage(payload);
      throw new ProcessingError(
        isSafetyBlock(payload, message) ? "safety_block" : "gemini_error",
        message,
        !isSafetyBlock(payload, message),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, config.videoPollMs));
  }
  if (!payload) throw new ProcessingError("timeout", "Video interaction timed out", true);
  const status = interactionStatus(payload);
  if (!isInteractionCompleted(status) && !extractInteractionVideo(payload)) {
    log("warn", "video_poll_lag", { ...context, operationId, elapsedMs: Date.now() - startedAt });
    throw new ProcessingError("timeout", "Video interaction timed out", true);
  }

  const videoRef = extractInteractionVideo(payload);
  if (!videoRef) throw new ProcessingError("gemini_error", "Interaction completed without video", false);
  const videoBuffer = await downloadVideoRef(base.url, videoRef, signal);
  await ensureLease();
  const resultPath = `${job.user_id}/${job.id}/${job.lease_token}.mp4`;
  const { error: uploadError } = await supabase.storage
    .from(RESULTS_BUCKET)
    .upload(resultPath, videoBuffer, { contentType: VIDEO_MIME, upsert: true });
  if (uploadError) {
    throw new ProcessingError("result_upload_error", uploadError.message, isTemporary(uploadError));
  }
  log("info", "video_result_uploaded", {
    ...context,
    resultPath,
    bytes: videoBuffer.length,
    operationId,
  });
  return { resultPath, rawPrompt, mimeType: VIDEO_MIME };
}
