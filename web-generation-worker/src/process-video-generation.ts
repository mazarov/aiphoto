import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assembleGrokVideoMotionPrompt,
  assembleVideoMotionPrompt,
} from "../../landing/src/lib/video-motion-prompt";
import { parseLibrarySourceGenerationId } from "../../landing/src/lib/user-generation-photo-paths";
import { config } from "./config";
import { log } from "./lib/logger";
import {
  buildXaiVideoSubmitBody,
  extractXaiRequestId,
  extractXaiVideoUrl,
  isGrokVideoModel,
  isXaiDone,
  isXaiExpired,
  isXaiFailed,
  isXaiSafetyBlock,
  rewriteXaiDownloadUrl,
  xaiErrorMessage,
  xaiPollUrl,
  xaiProxyHost,
  xaiStatus,
  xaiSubmitUrl,
} from "./xai-video";
import {
  ProcessingError,
  assertVideoInputSource,
  resolveGenerationInputSource,
  RESULTS_BUCKET,
  videoInputLogFields,
  type GenerationInputSource,
  type ParentGenerationInput,
} from "./input-source";
import type { GenerationJob } from "./process-generation";
import {
  coverCropVideoFrame,
  videoSourceFrameLogFields,
  type VideoSourceFrame,
} from "./video-source-frame";
import {
  buildVideoInteractionRequest,
  extractInteractionId,
  extractInteractionVideo,
  interactionErrorCode,
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

const PARENT_VIDEO_SELECT =
  "requester_auth_user_id,status,result_storage_bucket,result_storage_path,modality,input_photo_paths,parent_generation_id";

async function loadParentGeneration(
  supabase: SupabaseClient,
  parentId: string,
): Promise<(ParentGenerationInput & { modality?: string | null }) | null> {
  const { data, error } = await supabase
    .from("landing_generations")
    .select(PARENT_VIDEO_SELECT)
    .eq("id", parentId)
    .maybeSingle();
  if (error) {
    throw new ProcessingError("parent_generation_lookup_error", error.message, true);
  }
  return (data as (ParentGenerationInput & { modality?: string | null }) | null) || null;
}

async function loadLibraryLinkedGeneration(
  supabase: SupabaseClient,
  job: GenerationJob,
  source: GenerationInputSource,
): Promise<{ id: string; parent: ParentGenerationInput } | null> {
  if (source.sourceType !== "user_photos" || !job.requester_auth_user_id) return null;
  const path = source.paths[0];
  if (!path) return null;
  const { data, error } = await supabase
    .from("landing_user_photos")
    .select("original_filename,auth_user_id")
    .eq("storage_path", path)
    .eq("auth_user_id", job.requester_auth_user_id)
    .maybeSingle();
  if (error) {
    log("warn", "library_photo_lookup_failed", {
      generationId: job.id,
      path,
      error: error.message,
    });
    return null;
  }
  const linkedId = parseLibrarySourceGenerationId(data?.original_filename);
  if (!linkedId) return null;
  const parent = await loadParentGeneration(supabase, linkedId);
  if (!parent) return null;
  if (
    parent.requester_auth_user_id &&
    parent.requester_auth_user_id !== job.requester_auth_user_id
  ) {
    throw new ProcessingError(
      "parent_generation_forbidden",
      "Parent generation belongs to another requester",
      false,
    );
  }
  if ((parent as { modality?: string | null }).modality && (parent as { modality?: string | null }).modality !== "image") {
    return null;
  }
  return { id: linkedId, parent };
}

async function resolveVideoInputs(
  supabase: SupabaseClient,
  job: GenerationJob,
): Promise<{
  source: GenerationInputSource;
  linkedGenerationId: string | null;
}> {
  let parent: ParentGenerationInput | null = null;
  if (job.parent_generation_id) {
    const data = await loadParentGeneration(supabase, job.parent_generation_id);
    if (!data) {
      throw new ProcessingError("parent_generation_missing", "Parent generation not found", false);
    }
    if ((data.modality || "image") !== "image") {
      throw new ProcessingError(
        "parent_generation_not_image",
        "Parent generation is not an image",
        false,
      );
    }
    parent = data;
  }
  let source = assertVideoInputSource(resolveGenerationInputSource(job, parent));
  let linkedGenerationId: string | null = job.parent_generation_id;
  if (source.sourceType === "user_photos") {
    const linked = await loadLibraryLinkedGeneration(supabase, job, source);
    if (linked) {
      try {
        const promoted = resolveGenerationInputSource(
          {
            requester_auth_user_id: job.requester_auth_user_id,
            input_photo_paths: [],
            parent_generation_id: linked.id,
          },
          linked.parent,
        );
        if (promoted.sourceType === "generation_result") {
          source = assertVideoInputSource(promoted);
          linkedGenerationId = linked.id;
        }
      } catch (error) {
        if (error instanceof ProcessingError && error.retryable) throw error;
        log("warn", "library_generation_promote_skipped", {
          generationId: job.id,
          linkedGenerationId: linked.id,
          error: error instanceof Error ? error.message : String(error),
        });
        linkedGenerationId = linked.id;
      }
    }
  }
  return { source, linkedGenerationId };
}

async function downloadStorageImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<{ mimeType: string; data: string }> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
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

async function downloadSourceBuffer(
  supabase: SupabaseClient,
  source: GenerationInputSource,
): Promise<Buffer> {
  const downloaded = await downloadStorageImage(supabase, source.bucket, source.paths[0]);
  return Buffer.from(downloaded.data, "base64");
}

async function cropVideoSourceFrame(
  supabase: SupabaseClient,
  source: GenerationInputSource,
  aspectRatio: string,
): Promise<VideoSourceFrame> {
  try {
    return await coverCropVideoFrame(await downloadSourceBuffer(supabase, source), aspectRatio);
  } catch (error) {
    throw new ProcessingError(
      "input_invalid",
      `Video source crop failed: ${error instanceof Error ? error.message : String(error)}`,
      false,
    );
  }
}

async function prepareInlineVideoFrame(
  supabase: SupabaseClient,
  source: GenerationInputSource,
  aspectRatio: string,
): Promise<{ image: { mimeType: string; data: string }; crop: Record<string, unknown> }> {
  const frame = await cropVideoSourceFrame(supabase, source, aspectRatio);
  return {
    image: { mimeType: frame.mimeType, data: frame.buffer.toString("base64") },
    crop: videoSourceFrameLogFields(frame),
  };
}

async function prepareSignedVideoFrameUrl(
  supabase: SupabaseClient,
  job: GenerationJob,
  source: GenerationInputSource,
  aspectRatio: string,
): Promise<{ imageUrl: string; crop: Record<string, unknown> }> {
  const frame = await cropVideoSourceFrame(supabase, source, aspectRatio);
  const crop = videoSourceFrameLogFields(frame);
  if (!frame.cropped) {
    return { imageUrl: await createSourceSignedUrl(supabase, source), crop };
  }
  const path = `${job.user_id}/${job.id}/video-source-frame.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(RESULTS_BUCKET)
    .upload(path, frame.buffer, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    throw new ProcessingError(
      "result_upload_error",
      `Cropped video frame upload failed: ${uploadError.message}`,
      isTemporary(uploadError),
    );
  }
  const { data, error } = await supabase.storage
    .from(RESULTS_BUCKET)
    .createSignedUrl(path, SOURCE_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new ProcessingError(
      "storage_signed_url_error",
      `Cropped video frame signed URL failed: ${error?.message || "empty response"}`,
      isTemporary(error),
    );
  }
  return { imageUrl: data.signedUrl, crop };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new ProcessingError(
      "gemini_response_parse",
      `Video API returned non-JSON response (HTTP ${response.status})`,
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

type SubmittedInteraction = {
  id: string;
  payload: Record<string, unknown>;
};

async function submitInteraction(input: {
  baseUrl: string;
  model: string;
  prompt: string;
  image: { mimeType: string; data: string };
  aspectRatio: string;
  durationSeconds?: number | null;
  signal: AbortSignal;
  context: Record<string, unknown>;
}): Promise<SubmittedInteraction> {
  const body = buildVideoInteractionRequest({
    model: input.model,
    prompt: input.prompt,
    image: input.image,
    aspectRatio: input.aspectRatio,
    durationSeconds: input.durationSeconds,
  });
  const response = await fetch(`${input.baseUrl}/v1beta/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(config.videoTimeoutMs)]),
  });
  const payload = await readJson(response);
  const id = extractInteractionId(payload);
  log(response.ok && id ? "info" : "warn", "video_submit_response", {
    ...input.context,
    httpStatus: response.status,
    errorCode: interactionErrorCode(payload) || null,
    interactionStatus: interactionStatus(payload) || null,
    hasId: Boolean(id),
    hasVideo: Boolean(extractInteractionVideo(payload)),
    imageBytes: Buffer.byteLength(input.image.data, "base64"),
    imageMime: input.image.mimeType,
    imageCount: 1,
    aspectRatio: input.aspectRatio,
    durationSeconds: input.durationSeconds ?? null,
    duration: body.response_format.duration,
  });
  if (!response.ok) throw failureFromPayload(payload, response.status);
  if (!id && !extractInteractionVideo(payload)) throw failureFromPayload(payload, response.status);
  return { id, payload };
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

const SOURCE_SIGNED_TTL_SEC = 900;

function xaiFailureFromPayload(payload: Record<string, unknown>, status: number): ProcessingError {
  const message = xaiErrorMessage(payload);
  if (isXaiSafetyBlock(payload, message) || isXaiExpired(xaiStatus(payload))) {
    return new ProcessingError(
      isXaiExpired(xaiStatus(payload)) ? "provider_expired" : "safety_block",
      message,
      false,
    );
  }
  if (status === 429 || status >= 500) {
    return new ProcessingError(`xai_http_${status}`, message, true);
  }
  return new ProcessingError("xai_error", message, false);
}

async function persistProviderOperation(
  supabase: SupabaseClient,
  job: GenerationJob,
  operationId: string,
  context: Record<string, unknown>,
): Promise<void> {
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
}

async function createSourceSignedUrl(
  supabase: SupabaseClient,
  source: GenerationInputSource,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(source.bucket)
    .createSignedUrl(source.paths[0], SOURCE_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) {
    const status = storageStatus(error);
    const missing = status === 400 || status === 404 || /not found|does not exist/i.test(error?.message || "");
    throw new ProcessingError(
      missing ? "input_missing" : "storage_signed_url_error",
      `Signed URL failed: ${source.paths[0]}: ${error?.message || "empty response"}`,
      !missing && isTemporary(error),
    );
  }
  return data.signedUrl;
}

async function downloadXaiVideo(
  videoUrl: string,
  signal: AbortSignal,
): Promise<Buffer> {
  const rewritten = rewriteXaiDownloadUrl(videoUrl, config.xaiBaseUrl);
  const headers: Record<string, string> = {};
  try {
    if (new URL(rewritten).host === xaiProxyHost(config.xaiBaseUrl)) {
      headers.Authorization = `Bearer ${config.xaiApiKey}`;
    }
  } catch {
    /* keep unauthenticated CDN download */
  }
  const response = await fetch(rewritten, {
    headers,
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  });
  if (!response.ok) {
    throw new ProcessingError(
      `xai_http_${response.status}`,
      `Video download failed (HTTP ${response.status})`,
      response.status === 429 || response.status >= 500,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new ProcessingError("xai_error", "Downloaded video is empty", false);
  return buffer;
}

async function processGrokVideoGeneration(
  supabase: SupabaseClient,
  job: GenerationJob,
  source: GenerationInputSource,
  sourceFields: Record<string, unknown>,
  context: Record<string, unknown>,
  signal: AbortSignal,
  ensureLease: () => Promise<void>,
): Promise<{ resultPath: string; rawPrompt: string; mimeType: string }> {
  if (!config.xaiApiKey) {
    throw new ProcessingError("config_error", "XAI_API_KEY is not configured", false);
  }
  if (!config.xaiBaseUrl) {
    throw new ProcessingError("config_error", "XAI_BASE_URL is not configured", false);
  }
  const rawPrompt = String(job.prompt_text || "").trim();
  if (!rawPrompt) throw new ProcessingError("input_missing", "Prompt text is empty", false);
  const motionPrompt = assembleGrokVideoMotionPrompt(rawPrompt);
  const providerContext = {
    ...context,
    ...sourceFields,
    provider: "xai",
    proxyHost: xaiProxyHost(config.xaiBaseUrl),
    model: job.model,
    durationSeconds: job.duration_seconds ?? null,
  };
  let operationId = String(job.provider_operation_id || "").trim();
  let payload: Record<string, unknown> | null = null;

  if (!operationId) {
    const { imageUrl, crop } = await prepareSignedVideoFrameUrl(
      supabase,
      job,
      source,
      job.aspect_ratio || "9:16",
    );
    await ensureLease();
    log("info", "video_submit", { ...providerContext, ...crop });
    try {
      const response = await fetch(xaiSubmitUrl(config.xaiBaseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.xaiApiKey}`,
        },
        body: JSON.stringify(
          buildXaiVideoSubmitBody({
            model: job.model,
            prompt: motionPrompt,
            imageUrl,
            durationSeconds: job.duration_seconds || 4,
            aspectRatio: job.aspect_ratio || "9:16",
            resolution: job.image_size || "720p",
          }),
        ),
        signal: AbortSignal.any([signal, AbortSignal.timeout(config.videoTimeoutMs)]),
      });
      payload = await readJson(response);
      operationId = extractXaiRequestId(payload);
      log(response.ok && operationId ? "info" : "warn", "video_submit_response", {
        ...providerContext,
        httpStatus: response.status,
        hasId: Boolean(operationId),
        hasVideo: Boolean(extractXaiVideoUrl(payload)),
        interactionStatus: xaiStatus(payload) || null,
      });
      if (!response.ok) throw xaiFailureFromPayload(payload, response.status);
      if (!operationId && !extractXaiVideoUrl(payload)) {
        throw xaiFailureFromPayload(payload, response.status);
      }
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new ProcessingError(timeout ? "timeout" : "network_error", String((error as Error)?.message || error), true);
    }
    if (operationId) {
      await persistProviderOperation(supabase, job, operationId, providerContext);
    }
  } else {
    log("info", "video_resume", { ...providerContext, operationId });
  }

  const startedAt = Date.now();
  while (
    !extractXaiVideoUrl(payload || {}) &&
    !isXaiDone(xaiStatus(payload || {})) &&
    Date.now() - startedAt < config.videoTimeoutMs
  ) {
    if (!operationId) break;
    if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
    await ensureLease();
    try {
      const response = await fetch(xaiPollUrl(config.xaiBaseUrl, operationId), {
        headers: { Authorization: `Bearer ${config.xaiApiKey}` },
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
      payload = await readJson(response);
      if (!response.ok) throw xaiFailureFromPayload(payload, response.status);
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
      throw new ProcessingError("network_error", String((error as Error)?.message || error), true);
    }
    const status = xaiStatus(payload);
    if (isXaiDone(status) || extractXaiVideoUrl(payload)) break;
    if (isXaiExpired(status)) {
      throw new ProcessingError("provider_expired", xaiErrorMessage(payload), false);
    }
    if (isXaiFailed(status)) {
      const message = xaiErrorMessage(payload);
      throw new ProcessingError(
        isXaiSafetyBlock(payload, message) ? "safety_block" : "xai_error",
        message,
        !isXaiSafetyBlock(payload, message),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, config.videoPollMs));
  }
  if (!payload) throw new ProcessingError("timeout", "Video generation timed out", true);
  const status = xaiStatus(payload);
  if (isXaiExpired(status)) {
    throw new ProcessingError("provider_expired", xaiErrorMessage(payload), false);
  }
  if (!isXaiDone(status) && !extractXaiVideoUrl(payload)) {
    log("warn", "video_poll_lag", { ...providerContext, operationId, elapsedMs: Date.now() - startedAt });
    throw new ProcessingError("timeout", "Video generation timed out", true);
  }
  const videoUrl = extractXaiVideoUrl(payload);
  if (!videoUrl) throw new ProcessingError("xai_error", "Generation completed without video", false);
  const videoBuffer = await downloadXaiVideo(videoUrl, signal);
  await ensureLease();
  const resultPath = `${job.user_id}/${job.id}/${job.lease_token}.mp4`;
  const { error: uploadError } = await supabase.storage
    .from(RESULTS_BUCKET)
    .upload(resultPath, videoBuffer, { contentType: VIDEO_MIME, upsert: true });
  if (uploadError) {
    throw new ProcessingError("result_upload_error", uploadError.message, isTemporary(uploadError));
  }
  log("info", "video_result_uploaded", {
    ...providerContext,
    resultPath,
    bytes: videoBuffer.length,
    operationId,
  });
  return { resultPath, rawPrompt, mimeType: VIDEO_MIME };
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
  log("info", "video_generation_started", {
    ...context,
    provider: isGrokVideoModel(job.model) ? "xai" : "gemini",
    model: job.model,
  });
  const { source, linkedGenerationId } = await resolveVideoInputs(
    supabase,
    job,
  );
  const sourceFields = videoInputLogFields(source, job, linkedGenerationId);
  log("info", "video_input_resolved", {
    ...context,
    ...sourceFields,
  });
  if (isGrokVideoModel(job.model)) {
    return processGrokVideoGeneration(
      supabase,
      job,
      source,
      sourceFields,
      context,
      signal,
      ensureLease,
    );
  }
  if (!config.geminiApiKey) {
    throw new ProcessingError("config_error", "GEMINI_API_KEY is not configured", false);
  }

  const rawPrompt = String(job.prompt_text || "").trim();
  if (!rawPrompt) throw new ProcessingError("input_missing", "Prompt text is empty", false);
  const motionPrompt = assembleVideoMotionPrompt(rawPrompt);
  const base = await geminiBaseUrl(supabase);
  let operationId = String(job.provider_operation_id || "").trim();
  let payload: Record<string, unknown> | null = null;

  if (!operationId) {
    const { image, crop } = await prepareInlineVideoFrame(
      supabase,
      source,
      job.aspect_ratio || "9:16",
    );
    await ensureLease();
    log("info", "video_submit", {
      ...context,
      ...sourceFields,
      ...crop,
      provider: "gemini",
      model: job.model,
      proxy: base.proxy,
      imageBytes: Buffer.byteLength(image.data, "base64"),
      imageMime: image.mimeType,
      imageCount: 1,
    });
    try {
      const submitted = await submitInteraction({
        baseUrl: base.url,
        model: job.model,
        prompt: motionPrompt,
        image,
        aspectRatio: job.aspect_ratio || "9:16",
        durationSeconds: job.duration_seconds,
        signal,
        context: { ...context, ...sourceFields },
      });
      operationId = submitted.id;
      payload = submitted.payload;
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      if (signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new ProcessingError(timeout ? "timeout" : "network_error", String((error as Error)?.message || error), true);
    }
    if (operationId) {
      await persistProviderOperation(supabase, job, operationId, context);
    }
  } else {
    log("info", "video_resume", { ...context, operationId });
  }

  const startedAt = Date.now();
  while (
    !extractInteractionVideo(payload) &&
    !isInteractionCompleted(interactionStatus(payload || {})) &&
    Date.now() - startedAt < config.videoTimeoutMs
  ) {
    if (!operationId) break;
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
