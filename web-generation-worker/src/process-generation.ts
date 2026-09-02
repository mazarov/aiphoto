import type { SupabaseClient } from "@supabase/supabase-js";
import { publicObjectUploadOptions } from "../../landing/src/lib/storage-cache-control";
import { config } from "./config";
import {
  assembleCameraOrbitEditPrompt,
  assembleLandingCardEditPrompt,
  assembleLandingCardFinalPrompt,
  assemblePhotoshootSheetPrompt,
  assembleTextToImageFinalPrompt,
  assembleVibeFinalPrompt,
  GEMINI_CAMERA_ORBIT_SYSTEM_INSTRUCTION,
  GEMINI_PHOTOSHOOT_SYSTEM_INSTRUCTION,
  VIBE_IMAGE_PART_LABEL_REFERENCE,
  VIBE_IMAGE_PART_LABEL_SUBJECT,
} from "../../landing/src/lib/image-generation-prompt";
import {
  assembleGrokCameraOrbitPrompt,
  assembleGrokImageEditPrompt,
  assembleGrokImageToImagePrompt,
  assembleGrokPhotoshootSheetPrompt,
  assembleGrokTextToImagePrompt,
  assembleGrokVibePrompt,
} from "../../landing/src/lib/grok-image-prompt";
import {
  assembleSeedreamCameraOrbitPrompt,
  assembleSeedreamImageEditPrompt,
  assembleSeedreamImageToImagePrompt,
  assembleSeedreamPhotoshootSheetPrompt,
  assembleSeedreamTextToImagePrompt,
  assembleSeedreamVibePrompt,
} from "../../landing/src/lib/seedream-image-prompt";
import {
  resolveCameraOrbitScenePrompt,
  resolveImageEditMode,
} from "../../landing/src/lib/camera-orbit";
import {
  PHOTOSHOOT_EDIT_KIND,
  PHOTOSHOOT_FLUX_SAFETY_TOLERANCE,
  PHOTOSHOOT_TILE_INDEXES,
  photoshootTileStoragePath,
  serializePhotoshootSheetInstruction,
} from "../../landing/src/lib/photoshoot";
import { resolveJobWardrobePolicy } from "../../landing/src/lib/wardrobe-policy";
import { planPhotoshootShots } from "./photoshoot-planner";
import { splitContactSheet } from "./photoshoot-split";
import {
  elapsedMs,
  queueWaitMs,
  snapshotPhotoshootTiming,
  type PhotoshootTimingMarks,
} from "./photoshoot-timing";
import { getVibeAttachReferenceImage } from "./lib/vibe-config";
import { errorFields, log } from "./lib/logger";
import {
  ProcessingError,
  assertPhotoshootInputSource,
  resolveGenerationInputSource,
  RESULTS_BUCKET,
  type GenerationInputJob,
  type GenerationInputSource,
  type ParentGenerationInput,
} from "./input-source";
import { encodeGenerationResult } from "./result-encode";
import { grokImageCircuit, seedreamImageCircuit } from "./grok-image-circuit";
import {
  shouldAttemptGrokFallback,
  shouldAttemptPhotoshootFluxFallback,
  shouldAttemptSeedreamFallback,
} from "./image-fallback";
import {
  GROK_IMAGINE_IMAGE_MODEL,
  buildXaiImageEditBody,
  buildXaiImageGenerateBody,
  clampGrokImageParts,
  extractXaiCostUsd,
  extractXaiImageBase64,
  extractXaiImageUrl,
  isGrokImageModel,
  isXaiImageSafetyBlock,
  mapGrokImageResolution,
  rewriteXaiImageDownloadUrl,
  xaiImageEditUrl,
  xaiImageGenerateUrl,
  xaiImageErrorMessage,
  xaiProxyHost,
  type GrokImagePart,
} from "./xai-image";
import {
  FLUX_2_FLEX_IMAGE_MODEL,
  SEEDREAM_50_PRO_IMAGE_MODEL,
  SEEDREAM_SIGNED_TTL_SEC,
  buildSeedreamImageBody,
  clampSeedreamImageUrls,
  isFluxImageModel,
  isOpenRouterImageModel,
  isProxiedReferenceUrl,
  isSeedreamImageModel,
  mapOpenRouterImageSize,
  openRouterMaxImageInputs,
  openRouterVendorModel,
  openrouterProxyHost,
  requireOpenRouterBaseUrl,
  runSeedreamImage,
} from "./openrouter-seedream";

export { ProcessingError, RESULTS_BUCKET } from "./input-source";
const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

export type GenerationJob = GenerationInputJob & {
  id: string;
  user_id: string;
  prompt_text: string | null;
  model: string;
  requested_model?: string | null;
  executed_model?: string | null;
  fallback_used?: boolean | null;
  aspect_ratio: string;
  image_size: string;
  vibe_id: string | null;
  pipeline_trace_id: string | null;
  attempts: number;
  max_attempts: number;
  lease_token: string;
  create_ugc: boolean;
  created_at?: string | null;
  generation_started_at?: string | null;
  edit_instruction: string | null;
  edit_kind?: string | null;
  camera_pose?: { azimuthDeg?: number; elevationDeg?: number; distanceRel?: number } | null;
  modality?: string | null;
  duration_seconds?: number | null;
  provider_operation_id?: string | null;
  card_id?: string | null;
  pipeline_spec?: unknown;
  wardrobe_policy?: string | null;
};

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

async function resolveInputSource(
  supabase: SupabaseClient,
  job: GenerationJob,
): Promise<GenerationInputSource> {
  if (!job.parent_generation_id) return resolveGenerationInputSource(job);
  const { data: parent, error } = await supabase
    .from("landing_generations")
    .select("requester_auth_user_id,status,result_storage_bucket,result_storage_path,edit_kind,photoshoot_tile_paths")
    .eq("id", job.parent_generation_id)
    .maybeSingle();
  if (error) {
    throw new ProcessingError("parent_generation_lookup_error", error.message, true);
  }
  return resolveGenerationInputSource(job, parent as ParentGenerationInput | null);
}

async function downloadInputs(
  supabase: SupabaseClient,
  source: GenerationInputSource,
): Promise<ImagePart[]> {
  const parts: ImagePart[] = [];
  for (const path of source.paths) {
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

type ProviderContext = {
  generationId: string;
  userId: string;
  attempt: number;
  pipelineTrace: string | null;
};

async function uploadPhotoshootTiles(input: {
  supabase: SupabaseClient;
  sheetBuffer: Buffer;
  resultPath: string;
  enabled: boolean;
  context: ProviderContext;
  marks?: PhotoshootTimingMarks;
}): Promise<string[] | undefined> {
  if (!input.enabled) return undefined;
  const splitStarted = Date.now();
  try {
    const split = await splitContactSheet(input.sheetBuffer);
    const splitMs = elapsedMs(splitStarted);
    if (input.marks) input.marks.splitMs = splitMs;
    const uploadStarted = Date.now();
    const paths: string[] = [];
    for (const tile of split.tiles) {
      const path = photoshootTileStoragePath(input.resultPath, tile.i);
      if (!path) throw new Error("photoshoot_tile_path_empty");
      const { error } = await input.supabase.storage
        .from(RESULTS_BUCKET)
        .upload(
          path,
          tile.buffer,
          publicObjectUploadOptions({ contentType: "image/jpeg", upsert: true }),
        );
      if (error) {
        throw new Error(error.message);
      }
      paths.push(path);
    }
    const tileUploadMs = elapsedMs(uploadStarted);
    if (input.marks) input.marks.tileUploadMs = tileUploadMs;
    if (paths.length !== PHOTOSHOOT_TILE_INDEXES.length) {
      throw new Error("photoshoot_tile_upload_incomplete");
    }
    log("info", "photoshoot_split_ok", {
      ...input.context,
      sheetWidth: split.sheetWidth,
      sheetHeight: split.sheetHeight,
      cellWidth: split.cellWidth,
      cellHeight: split.cellHeight,
      splitMs,
      tileUploadMs,
    });
    return paths;
  } catch (error) {
    log("warn", "photoshoot_split_failed", {
      ...input.context,
      splitMs: elapsedMs(splitStarted),
      ...errorFields(error),
    });
    return undefined;
  }
}

export async function processGeneration(
  supabase: SupabaseClient,
  job: GenerationJob,
  signal: AbortSignal,
  ensureLease: () => Promise<void>,
): Promise<{
  resultPath: string;
  rawPrompt: string;
  executedModel: string;
  fallbackUsed: boolean;
  photoshootTilePaths?: string[];
  providerCostUsd?: number | null;
}> {
  const workerStartedAt = Date.now();
  const queueWait = queueWaitMs(job.created_at, workerStartedAt);
  const context = {
    generationId: job.id,
    userId: job.user_id,
    attempt: job.attempts,
    pipelineTrace: job.pipeline_trace_id,
  };
  log("info", "generation_started", {
    ...context,
    editKind: job.edit_kind ?? null,
    wardrobePolicy: job.wardrobe_policy ?? "replace",
    model: job.model,
    imageSize: job.image_size,
    createdAt: job.created_at ?? null,
    queueWaitMs: queueWait,
  });
  const inputResolveStarted = Date.now();
  const resolvedInput = await resolveInputSource(supabase, job);
  const inputSource =
    job.edit_kind === PHOTOSHOOT_EDIT_KIND
      ? assertPhotoshootInputSource(resolvedInput)
      : resolvedInput;
  log("info", "generation_input_resolved", {
    ...context,
    sourceType: inputSource.sourceType,
    sourceCount: inputSource.paths.length,
    parentGenerationId: job.parent_generation_id,
    durationMs: elapsedMs(inputResolveStarted),
  });
  const rawPrompt = String(job.prompt_text || "");
  if (!rawPrompt.trim()) throw new ProcessingError("input_missing", "Prompt text is empty", false);
  if (!job.model || !job.aspect_ratio || !job.image_size) {
    throw new ProcessingError("config_error", "Generation model, aspect ratio, or image size is missing", false);
  }
  const requestedModel = job.requested_model || job.model;
  const isVibe = Boolean(job.vibe_id);
  const editInstruction = String(job.edit_instruction || "").trim();
  const generationMode = resolveImageEditMode({
    vibeId: job.vibe_id,
    parentGenerationId: job.parent_generation_id,
    editKind: job.edit_kind,
    editInstruction,
  });
  const isPhotoshoot = generationMode === "photoshoot";
  const isCameraOrbit = generationMode === "camera_orbit";
  const isLocalEdit = generationMode === "local_edit";
  const photoshootMarks: PhotoshootTimingMarks | undefined = isPhotoshoot
    ? { createdAt: job.created_at, startedAt: workerStartedAt }
    : undefined;
  let photoshootSheet = "";
  let cachedInputParts: ImagePart[] | null = null;
  let vibeSourceUrl: string | null = null;
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
      vibeSourceUrl = String(vibe.source_image_url);
    }
    if (attachReference && !vibeSourceUrl) {
      throw new ProcessingError(
        "vibe_reference_missing",
        "Steal This Vibe reference image is required but unavailable",
        false,
      );
    }
  }

  if (isPhotoshoot && photoshootMarks) {
    const downloadStarted = Date.now();
    cachedInputParts = await downloadInputs(supabase, inputSource);
    photoshootMarks.inputDownloadMs = elapsedMs(downloadStarted);
    if (!cachedInputParts[0]) {
      throw new ProcessingError("input_missing", "Photoshoot source image is missing", false);
    }
    const plannerStarted = Date.now();
    const plan = await planPhotoshootShots({
      supabase,
      image: cachedInputParts[0].inlineData,
      signal,
      generationId: job.id,
    });
    photoshootMarks.plannerMs = elapsedMs(plannerStarted);
    const persistStarted = Date.now();
    const { error: planError } = await supabase
      .from("landing_generations")
      .update({ photoshoot_plan: plan })
      .eq("id", job.id);
    photoshootMarks.planPersistMs = elapsedMs(persistStarted);
    if (planError) {
      throw new ProcessingError("photoshoot_plan_persist", planError.message, true);
    }
    photoshootSheet = serializePhotoshootSheetInstruction(plan, job.aspect_ratio);
  }

  if (isOpenRouterImageModel(requestedModel) || isOpenRouterImageModel(job.executed_model)) {
    const executedOpenRouter = resolveOpenRouterProductModel(job, requestedModel);
    const providerStarted = Date.now();
    let imageBuffer: Buffer;
    let executedModel = executedOpenRouter;
    let fallbackUsed = Boolean(job.fallback_used) || !isOpenRouterImageModel(requestedModel);
    try {
      imageBuffer = await generateSeedreamFromJob({
        job,
        productModel: executedOpenRouter,
        rawPrompt,
        editInstruction,
        isVibe,
        isPhotoshoot,
        photoshootSheet,
        isCameraOrbit,
        isLocalEdit,
        vibeSourceUrl,
        inputSource,
        generationMode,
        signal,
        context,
        ensureLease,
        supabase,
      });
    } catch (error) {
      const processing = toProcessingError(error);
      const flux = await tryPhotoshootFluxFallback({
        job,
        requestedModel,
        error: processing,
        rawPrompt,
        editInstruction,
        isVibe,
        isPhotoshoot,
        photoshootSheet,
        isCameraOrbit,
        isLocalEdit,
        vibeSourceUrl,
        inputSource,
        generationMode,
        signal,
        context,
        ensureLease,
        supabase,
        fromModel: executedOpenRouter,
      });
      if (!flux) throw processing;
      imageBuffer = flux.buffer;
      executedModel = flux.model;
      fallbackUsed = true;
    }
    if (photoshootMarks) {
      photoshootMarks.provider = executedModel;
      photoshootMarks.providerMs = elapsedMs(providerStarted);
    }
    const encodedSeedream = await encodeGenerationResult(imageBuffer);
    if (photoshootMarks) photoshootMarks.encodeMs = encodedSeedream.encodeMs;
    await ensureLease();
    const seedreamResultPath = `${job.user_id}/${job.id}/${job.lease_token}.${encodedSeedream.extension}`;
    const uploadStarted = Date.now();
    const { error: seedreamUploadError } = await supabase.storage
      .from(RESULTS_BUCKET)
      .upload(
        seedreamResultPath,
        encodedSeedream.buffer,
        publicObjectUploadOptions({
          contentType: encodedSeedream.contentType,
          upsert: true,
        }),
      );
    if (photoshootMarks) photoshootMarks.sheetUploadMs = elapsedMs(uploadStarted);
    if (seedreamUploadError) {
      throw new ProcessingError(
        "result_upload_error",
        seedreamUploadError.message,
        isTemporary(seedreamUploadError),
      );
    }
    log("info", "result_uploaded", {
      ...context,
      resultPath: seedreamResultPath,
      bytes: encodedSeedream.bytesOut,
      bytesIn: encodedSeedream.bytesIn,
      bytesOut: encodedSeedream.bytesOut,
      outputFormat: encodedSeedream.outputFormat,
      encodeMs: encodedSeedream.encodeMs,
      skippedReason: encodedSeedream.skippedReason,
      executedModel,
      fallbackUsed,
      sheetUploadMs: photoshootMarks?.sheetUploadMs ?? null,
    });
    const photoshootTilePaths = requirePhotoshootTiles(
      isPhotoshoot,
      await uploadPhotoshootTiles({
        supabase,
        sheetBuffer: encodedSeedream.buffer,
        resultPath: seedreamResultPath,
        enabled: isPhotoshoot,
        context,
        marks: photoshootMarks,
      }),
    );
    logPhotoshootTiming(context, photoshootMarks, {
      executedModel,
      fallbackUsed,
    });
    return {
      resultPath: seedreamResultPath,
      rawPrompt,
      executedModel,
      fallbackUsed,
      photoshootTilePaths,
    };
  }

  const inputParts = cachedInputParts ?? (await downloadInputs(supabase, inputSource));
  await ensureLease();
  let reference: ImagePart | null = null;
  if (vibeSourceUrl) {
    reference = await downloadReference(vibeSourceUrl, signal);
    if (attachReference && !reference) {
      throw new ProcessingError(
        "vibe_reference_missing",
        "Steal This Vibe reference image is required but unavailable",
        false,
      );
    }
  }

  const hasReference = isVibe && Boolean(reference);
  const wardrobePolicy = resolveJobWardrobePolicy({
    stored: job.wardrobe_policy,
    hasInputPhotos: inputParts.length > 0,
    isVibe,
    isPhotoshoot,
    isCameraOrbit,
    isLocalEdit,
  });
  const geminiPrompt = isVibe
    ? assembleVibeFinalPrompt(rawPrompt, hasReference)
    : isPhotoshoot
      ? assemblePhotoshootSheetPrompt(photoshootSheet)
    : isCameraOrbit
      ? assembleCameraOrbitEditPrompt(
          resolveCameraOrbitScenePrompt({
            promptText: rawPrompt,
            editInstruction,
            cameraPose: job.camera_pose,
          }),
        )
      : isLocalEdit
        ? assembleLandingCardEditPrompt(editInstruction)
        : inputParts.length
          ? assembleLandingCardFinalPrompt(rawPrompt, wardrobePolicy)
          : assembleTextToImageFinalPrompt(rawPrompt);
  const grokPrompt = isVibe
    ? assembleGrokVibePrompt(rawPrompt, hasReference)
    : isPhotoshoot
      ? assembleGrokPhotoshootSheetPrompt(photoshootSheet)
    : isCameraOrbit
      ? assembleGrokCameraOrbitPrompt(
          resolveCameraOrbitScenePrompt({
            promptText: rawPrompt,
            editInstruction,
            cameraPose: job.camera_pose,
          }),
        )
      : isLocalEdit
        ? assembleGrokImageEditPrompt(editInstruction)
        : inputParts.length
          ? assembleGrokImageToImagePrompt(rawPrompt, wardrobePolicy)
          : assembleGrokTextToImagePrompt(rawPrompt);
  log("info", "generation_prompt_resolved", {
    ...context,
    generationMode,
    wardrobePolicy,
    editKind: job.edit_kind ?? null,
    cameraPose: job.camera_pose ?? null,
    editInstructionLength: editInstruction.length,
    scenePromptLength: rawPrompt.length,
    promptLength: geminiPrompt.length,
    photoshootAspect: isPhotoshoot ? job.aspect_ratio : null,
  });

  const startOnGrok = isGrokImageModel(requestedModel) || Boolean(job.fallback_used);
  const grokParts: GrokImagePart[] = [
    ...(hasReference && reference ? [{ mimeType: reference.inlineData.mimeType, data: reference.inlineData.data }] : []),
    ...inputParts.map((part) => ({ mimeType: part.inlineData.mimeType, data: part.inlineData.data })),
  ];

  let imageBuffer: Buffer;
  let executedModel = startOnGrok ? GROK_IMAGINE_IMAGE_MODEL : requestedModel;
  let fallbackUsed = Boolean(job.fallback_used);
  let providerCostUsd: number | null = null;
  const providerStarted = Date.now();

  if (startOnGrok) {
    try {
      const grok = await generateGrokImage({
        job,
        prompt: grokPrompt,
        images: grokParts,
        signal,
        context,
        ensureLease,
      });
      imageBuffer = grok.buffer;
      providerCostUsd = grok.costUsd;
    } catch (error) {
      const processing = toProcessingError(error);
      if (isPhotoshoot) {
        const flux = await tryPhotoshootFluxFallback({
          job,
          requestedModel,
          error: processing,
          rawPrompt,
          editInstruction,
          isVibe,
          isPhotoshoot,
          photoshootSheet,
          isCameraOrbit,
          isLocalEdit,
          vibeSourceUrl,
          inputSource,
          generationMode,
          signal,
          context,
          ensureLease,
          supabase,
          fromModel: executedModel,
        });
        if (!flux) throw processing;
        imageBuffer = flux.buffer;
        executedModel = flux.model;
        fallbackUsed = true;
      } else {
        const seedream = await trySeedreamImageFallback({
          job,
          requestedModel,
          error: processing,
          rawPrompt,
          editInstruction,
          isVibe,
          isPhotoshoot,
          photoshootSheet,
          isCameraOrbit,
          isLocalEdit,
          vibeSourceUrl,
          inputSource,
          generationMode,
          signal,
          context,
          ensureLease,
          supabase,
          fromModel: executedModel,
        });
        if (!seedream) throw processing;
        imageBuffer = seedream.buffer;
        executedModel = seedream.model;
        fallbackUsed = true;
      }
    }
  } else {
    try {
      imageBuffer = await generateGeminiImage({
        job,
        prompt: geminiPrompt,
        inputParts,
        reference: hasReference ? reference : null,
        promptFirst: isCameraOrbit || isPhotoshoot,
        systemInstruction: isPhotoshoot
          ? GEMINI_PHOTOSHOOT_SYSTEM_INSTRUCTION
          : isCameraOrbit
            ? GEMINI_CAMERA_ORBIT_SYSTEM_INSTRUCTION
            : null,
        signal,
        context,
        ensureLease,
        supabase,
      });
    } catch (error) {
      if (!(error instanceof ProcessingError)) throw error;
      if (isPhotoshoot) {
        const flux = await tryPhotoshootFluxFallback({
          job,
          requestedModel,
          error,
          rawPrompt,
          editInstruction,
          isVibe,
          isPhotoshoot,
          photoshootSheet,
          isCameraOrbit,
          isLocalEdit,
          vibeSourceUrl,
          inputSource,
          generationMode,
          signal,
          context,
          ensureLease,
          supabase,
          fromModel: requestedModel,
        });
        if (!flux) throw error;
        imageBuffer = flux.buffer;
        executedModel = flux.model;
        fallbackUsed = true;
      } else {
        const targets = await resolveImageFallbackTargets(supabase);
        const grokDecision = shouldAttemptGrokFallback({
        requestedModel,
        fallbackUsed,
        error,
        xaiConfigured: Boolean(config.xaiApiKey && config.xaiBaseUrl),
        fallbackModel: targets.grok,
        circuitOpen: grokImageCircuit.isOpen(),
      });
      if (grokDecision.ok) {
        fallbackUsed = true;
        job.fallback_used = true;
        job.executed_model = grokDecision.model;
        executedModel = grokDecision.model;
        await persistImageFallback(supabase, job.id, requestedModel, grokDecision.model);
        log("warn", "generation_fallback_used", {
          ...context,
          from: requestedModel,
          to: grokDecision.model,
          errorType: error.errorType,
        });
        try {
          const grok = await generateGrokImage({
            job,
            model: grokDecision.model,
            prompt: grokPrompt,
            images: grokParts,
            signal,
            context,
            ensureLease,
          });
          imageBuffer = grok.buffer;
          providerCostUsd = grok.costUsd;
        } catch (grokError) {
          const processing = toProcessingError(grokError);
          const seedream = await trySeedreamImageFallback({
            job,
            requestedModel,
            error: processing,
            rawPrompt,
            editInstruction,
            isVibe,
            isPhotoshoot,
            photoshootSheet,
            isCameraOrbit,
            isLocalEdit,
            vibeSourceUrl,
            inputSource,
            generationMode,
            signal,
            context,
            ensureLease,
            supabase,
            fromModel: grokDecision.model,
          });
          if (!seedream) throw processing;
          imageBuffer = seedream.buffer;
          executedModel = seedream.model;
          fallbackUsed = true;
        }
      } else {
        log("info", "generation_fallback_skipped", {
          ...context,
          reason: grokDecision.reason,
          errorType: error.errorType,
        });
        const seedream = await trySeedreamImageFallback({
          job,
          requestedModel,
          error,
          rawPrompt,
          editInstruction,
          isVibe,
          isPhotoshoot,
          photoshootSheet,
          isCameraOrbit,
          isLocalEdit,
          vibeSourceUrl,
          inputSource,
          generationMode,
          signal,
          context,
          ensureLease,
          supabase,
          fromModel: requestedModel,
        });
        if (!seedream) throw error;
        imageBuffer = seedream.buffer;
        executedModel = seedream.model;
        fallbackUsed = true;
      }
      }
    }
  }

  if (photoshootMarks) {
    photoshootMarks.provider = executedModel;
    photoshootMarks.providerMs = elapsedMs(providerStarted);
  }

  const encoded = await encodeGenerationResult(imageBuffer);
  if (photoshootMarks) photoshootMarks.encodeMs = encoded.encodeMs;
  await ensureLease();
  const resultPath = `${job.user_id}/${job.id}/${job.lease_token}.${encoded.extension}`;
  const uploadStarted = Date.now();
  const { error: uploadError } = await supabase.storage
    .from(RESULTS_BUCKET)
    .upload(
      resultPath,
      encoded.buffer,
      publicObjectUploadOptions({ contentType: encoded.contentType, upsert: true }),
    );
  if (photoshootMarks) photoshootMarks.sheetUploadMs = elapsedMs(uploadStarted);
  if (uploadError) {
    throw new ProcessingError(
      "result_upload_error",
      uploadError.message,
      isTemporary(uploadError),
    );
  }
  log("info", "result_uploaded", {
    ...context,
    resultPath,
    bytes: encoded.bytesOut,
    bytesIn: encoded.bytesIn,
    bytesOut: encoded.bytesOut,
    outputFormat: encoded.outputFormat,
    encodeMs: encoded.encodeMs,
    skippedReason: encoded.skippedReason,
    sheetUploadMs: photoshootMarks?.sheetUploadMs ?? null,
    executedModel,
    fallbackUsed,
  });
  const photoshootTilePaths = requirePhotoshootTiles(
    isPhotoshoot,
    await uploadPhotoshootTiles({
      supabase,
      sheetBuffer: encoded.buffer,
      resultPath,
      enabled: isPhotoshoot,
      context,
      marks: photoshootMarks,
    }),
  );
  logPhotoshootTiming(context, photoshootMarks, { executedModel, fallbackUsed });
  return {
    resultPath,
    rawPrompt,
    executedModel,
    fallbackUsed,
    photoshootTilePaths,
    providerCostUsd: isGrokImageModel(executedModel) ? providerCostUsd : null,
  };
}

function logPhotoshootTiming(
  context: ProviderContext,
  marks: PhotoshootTimingMarks | undefined,
  extra: { executedModel: string; fallbackUsed: boolean },
): void {
  if (!marks) return;
  const timing = snapshotPhotoshootTiming(marks);
  log("info", "photoshoot_timing", {
    ...context,
    ...timing,
    executedModel: extra.executedModel,
    fallbackUsed: extra.fallbackUsed,
  });
}

function requirePhotoshootTiles(
  enabled: boolean,
  paths: string[] | undefined,
): string[] | undefined {
  if (!enabled) return paths;
  if (!paths || paths.length !== PHOTOSHOOT_TILE_INDEXES.length) {
    throw new ProcessingError(
      "photoshoot_split_failed",
      "photoshoot tiles missing",
      true,
    );
  }
  return paths;
}

function toProcessingError(error: unknown): ProcessingError {
  if (error instanceof ProcessingError) return error;
  const typed = error as { errorType?: string; retryable?: boolean; message?: string };
  return new ProcessingError(
    typed.errorType || "provider_error",
    error instanceof Error ? error.message : String(error),
    Boolean(typed.retryable),
  );
}

function resolveOpenRouterProductModel(job: GenerationJob, requestedModel: string): string {
  if (isOpenRouterImageModel(job.executed_model)) return String(job.executed_model);
  if (isOpenRouterImageModel(requestedModel)) return requestedModel;
  if (isOpenRouterImageModel(job.model)) return String(job.model);
  return SEEDREAM_50_PRO_IMAGE_MODEL;
}

function photoshootFluxSafetyTolerance(isPhotoshoot: boolean, productModel: string): number | undefined {
  if (!isPhotoshoot || !isFluxImageModel(productModel)) return undefined;
  return PHOTOSHOOT_FLUX_SAFETY_TOLERANCE;
}

async function generateSeedreamFromJob(input: {
  job: GenerationJob;
  productModel?: string;
  rawPrompt: string;
  editInstruction: string;
  isVibe: boolean;
  isPhotoshoot: boolean;
  photoshootSheet: string;
  isCameraOrbit: boolean;
  isLocalEdit: boolean;
  vibeSourceUrl: string | null;
  inputSource: GenerationInputSource;
  generationMode: string;
  signal: AbortSignal;
  context: ProviderContext;
  ensureLease: () => Promise<void>;
  supabase: SupabaseClient;
  bypassCircuit?: boolean;
}): Promise<Buffer> {
  if (input.vibeSourceUrl && isProxiedReferenceUrl(input.vibeSourceUrl)) {
    throw new ProcessingError(
      "config_error",
      "Seedream reference must be a public signed URL, not a /u/ proxy path",
      false,
    );
  }
  const seedreamPrompt = input.isVibe
    ? assembleSeedreamVibePrompt(input.rawPrompt, Boolean(input.vibeSourceUrl))
    : input.isPhotoshoot
      ? assembleSeedreamPhotoshootSheetPrompt(input.photoshootSheet)
    : input.isCameraOrbit
      ? assembleSeedreamCameraOrbitPrompt(
          resolveCameraOrbitScenePrompt({
            promptText: input.rawPrompt,
            editInstruction: input.editInstruction,
            cameraPose: input.job.camera_pose,
          }),
        )
      : input.isLocalEdit
        ? assembleSeedreamImageEditPrompt(input.editInstruction)
        : input.inputSource.paths.length
          ? assembleSeedreamImageToImagePrompt(
              input.rawPrompt,
              resolveJobWardrobePolicy({
                stored: input.job.wardrobe_policy,
                hasInputPhotos: true,
                isVibe: input.isVibe,
                isPhotoshoot: input.isPhotoshoot,
                isCameraOrbit: input.isCameraOrbit,
                isLocalEdit: input.isLocalEdit,
              }),
            )
          : assembleSeedreamTextToImagePrompt(input.rawPrompt);
  const productModel = input.productModel || resolveOpenRouterProductModel(input.job, input.job.model);
  log("info", "generation_prompt_resolved", {
    ...input.context,
    generationMode: input.generationMode,
    wardrobePolicy: resolveJobWardrobePolicy({
      stored: input.job.wardrobe_policy,
      hasInputPhotos: input.inputSource.paths.length > 0,
      isVibe: input.isVibe,
      isPhotoshoot: input.isPhotoshoot,
      isCameraOrbit: input.isCameraOrbit,
      isLocalEdit: input.isLocalEdit,
    }),
    editKind: input.job.edit_kind ?? null,
    cameraPose: input.job.camera_pose ?? null,
    editInstructionLength: input.editInstruction.length,
    scenePromptLength: input.rawPrompt.length,
    promptLength: seedreamPrompt.length,
    provider: "openrouter",
    productModel,
  });
  const signedUrls = await createSeedreamSignedUrls(input.supabase, input.inputSource);
  const imageInput = clampSeedreamImageUrls(
    [
      ...(input.vibeSourceUrl ? [input.vibeSourceUrl] : []),
      ...signedUrls,
    ],
    openRouterMaxImageInputs(productModel),
  );
  return generateSeedreamImage({
    job: input.job,
    productModel,
    prompt: seedreamPrompt,
    imageInput: imageInput.urls,
    imageInputClamped: imageInput.clamped,
    safetyTolerance: photoshootFluxSafetyTolerance(input.isPhotoshoot, productModel),
    bypassCircuit: input.bypassCircuit,
    signal: input.signal,
    context: input.context,
    ensureLease: input.ensureLease,
    supabase: input.supabase,
  });
}

async function trySeedreamImageFallback(input: {
  job: GenerationJob;
  requestedModel: string;
  error: ProcessingError;
  rawPrompt: string;
  editInstruction: string;
  isVibe: boolean;
  isPhotoshoot: boolean;
  photoshootSheet: string;
  isCameraOrbit: boolean;
  isLocalEdit: boolean;
  vibeSourceUrl: string | null;
  inputSource: GenerationInputSource;
  generationMode: string;
  signal: AbortSignal;
  context: ProviderContext;
  ensureLease: () => Promise<void>;
  supabase: SupabaseClient;
  fromModel: string;
}): Promise<{ buffer: Buffer; model: string } | null> {
  const targets = await resolveImageFallbackTargets(input.supabase);
  const decision = shouldAttemptSeedreamFallback({
    requestedModel: input.requestedModel,
    executedModel: input.job.executed_model,
    error: input.error,
    openrouterConfigured: Boolean(config.openrouterApiKey && config.openrouterBaseUrl),
    secondaryModel: targets.seedream,
    circuitOpen: seedreamImageCircuit.isOpen(),
  });
  if (!decision.ok) {
    log("info", "generation_fallback_skipped", {
      ...input.context,
      reason: decision.reason,
      errorType: input.error.errorType,
      hop: "seedream",
    });
    return null;
  }
  input.job.fallback_used = true;
  input.job.executed_model = decision.model;
  await persistImageFallback(input.supabase, input.job.id, input.requestedModel, decision.model);
  log("warn", "generation_fallback_used", {
    ...input.context,
    from: input.fromModel,
    to: decision.model,
    errorType: input.error.errorType,
    hop: "seedream",
  });
  const buffer = await generateSeedreamFromJob({
    ...input,
    productModel: decision.model,
  });
  return { buffer, model: decision.model };
}

async function tryPhotoshootFluxFallback(input: {
  job: GenerationJob;
  requestedModel: string;
  error: ProcessingError;
  rawPrompt: string;
  editInstruction: string;
  isVibe: boolean;
  isPhotoshoot: boolean;
  photoshootSheet: string;
  isCameraOrbit: boolean;
  isLocalEdit: boolean;
  vibeSourceUrl: string | null;
  inputSource: GenerationInputSource;
  generationMode: string;
  signal: AbortSignal;
  context: ProviderContext;
  ensureLease: () => Promise<void>;
  supabase: SupabaseClient;
  fromModel: string;
}): Promise<{ buffer: Buffer; model: string } | null> {
  const targets = await resolveImageFallbackTargets(input.supabase);
  const decision = shouldAttemptPhotoshootFluxFallback({
    isPhotoshoot: input.isPhotoshoot,
    requestedModel: input.requestedModel,
    executedModel: input.job.executed_model,
    error: input.error,
    openrouterConfigured: Boolean(config.openrouterApiKey && config.openrouterBaseUrl),
    fallbackModel: targets.photoshootFlux,
  });
  if (!decision.ok) {
    log("info", "generation_fallback_skipped", {
      ...input.context,
      reason: decision.reason,
      errorType: input.error.errorType,
      hop: "photoshoot_flux",
    });
    return null;
  }
  input.job.fallback_used = true;
  input.job.executed_model = decision.model;
  await persistImageFallback(input.supabase, input.job.id, input.requestedModel, decision.model);
  log("warn", "generation_fallback_used", {
    ...input.context,
    from: input.fromModel,
    to: decision.model,
    errorType: input.error.errorType,
    hop: "photoshoot_flux",
    safetyTolerance: PHOTOSHOOT_FLUX_SAFETY_TOLERANCE,
  });
  const buffer = await generateSeedreamFromJob({
    ...input,
    productModel: decision.model,
    bypassCircuit: true,
  });
  return { buffer, model: decision.model };
}

async function persistSeedreamOperation(
  supabase: SupabaseClient,
  job: GenerationJob,
  operationId: string,
  context: ProviderContext,
): Promise<void> {
  const { data: saved, error: saveError } = await supabase.rpc("landing_save_provider_operation", {
    p_generation_id: job.id,
    p_worker_id: config.workerId,
    p_lease_token: job.lease_token,
    p_provider_operation_id: operationId,
  });
  job.provider_operation_id = operationId;
  if (saveError || saved !== true) {
    log("warn", "seedream_persist_failed", {
      ...context,
      persistFailed: true,
      error: saveError?.message,
    });
  }
}

async function createSeedreamSignedUrls(
  supabase: SupabaseClient,
  source: GenerationInputSource,
): Promise<string[]> {
  const urls: string[] = [];
  for (const path of source.paths) {
    const { data, error } = await supabase.storage
      .from(source.bucket)
      .createSignedUrl(path, SEEDREAM_SIGNED_TTL_SEC);
    if (error || !data?.signedUrl) {
      const status = storageStatus(error);
      const missing = status === 400 || status === 404 || /not found|does not exist/i.test(error?.message || "");
      throw new ProcessingError(
        missing ? "input_missing" : "storage_signed_url_error",
        `Signed URL failed: ${path}: ${error?.message || "empty response"}`,
        !missing && isTemporary(error),
      );
    }
    if (isProxiedReferenceUrl(data.signedUrl)) {
      throw new ProcessingError(
        "config_error",
        "Seedream signed URL must be public Storage, not a /u/ proxy path",
        false,
      );
    }
    urls.push(data.signedUrl);
  }
  return urls;
}

async function generateSeedreamImage(input: {
  job: GenerationJob;
  productModel: string;
  prompt: string;
  imageInput: string[];
  imageInputClamped: boolean;
  safetyTolerance?: number;
  bypassCircuit?: boolean;
  signal: AbortSignal;
  context: ProviderContext;
  ensureLease: () => Promise<void>;
  supabase: SupabaseClient;
}): Promise<Buffer> {
  if (!config.openrouterApiKey || !config.openrouterBaseUrl) {
    log("error", "seedream_config_error", {
      ...input.context,
      missingToken: !config.openrouterApiKey,
      missingBase: !config.openrouterBaseUrl,
    });
    throw new ProcessingError("config_error", "OPENROUTER_BASE_URL is not configured", false);
  }
  try {
    requireOpenRouterBaseUrl(config.openrouterBaseUrl);
  } catch (error) {
    log("error", "seedream_config_error", {
      ...input.context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ProcessingError("config_error", "OPENROUTER_BASE_URL must use /u/ proxy", false);
  }
  const mapped = mapOpenRouterImageSize(input.productModel, input.job.image_size);
  if (mapped.clamped) {
    log("info", "seedream_size_clamped", {
      ...input.context,
      from: input.job.image_size,
      to: mapped.size,
      productModel: input.productModel,
    });
  }
  if (input.imageInputClamped) {
    log("info", "seedream_input_clamped", {
      ...input.context,
      to: input.imageInput.length,
      productModel: input.productModel,
    });
  }
  const body = buildSeedreamImageBody({
    prompt: input.prompt,
    size: mapped.size,
    aspectRatio: input.job.aspect_ratio,
    imageInput: input.imageInput,
    model: input.productModel,
    safetyTolerance: input.safetyTolerance,
  });
  const startedAt = Date.now();
  log("info", "seedream_request_started", {
    ...input.context,
    model: openRouterVendorModel(input.productModel),
    productModel: input.productModel,
    proxyHost: openrouterProxyHost(config.openrouterBaseUrl),
    size: mapped.size,
    clampedSize: mapped.clamped,
    partCount: input.imageInput.length,
    safetyTolerance: input.safetyTolerance ?? null,
    bypassCircuit: Boolean(input.bypassCircuit),
  });
  try {
    const result = await runSeedreamImage({
      apiKey: config.openrouterApiKey,
      baseUrl: config.openrouterBaseUrl,
      body,
      persistOperationId: (operationId) =>
        persistSeedreamOperation(input.supabase, input.job, operationId, input.context),
      ensureLease: input.ensureLease,
      signal: input.signal,
      circuitOpen: input.bypassCircuit ? false : seedreamImageCircuit.isOpen(),
      onLog: (event, fields) => {
        log(event === "seedream_circuit_open" || event === "seedream_persist_failed" ? "warn" : "info", event, {
          ...input.context,
          ...fields,
        });
      },
    });
    if (!input.bypassCircuit) seedreamImageCircuit.record(true);
    log("info", "seedream_completed", {
      ...input.context,
      durationMs: Date.now() - startedAt,
    });
    return result.buffer;
  } catch (error) {
    const processing = toProcessingError(error);
    if (!input.bypassCircuit && processing.errorType !== "shutdown") seedreamImageCircuit.record(false);
    log("warn", "seedream_failed", {
      ...input.context,
      errorType: processing.errorType,
      durationMs: Date.now() - startedAt,
    });
    throw processing;
  }
}

async function generateGeminiImage(input: {
  job: GenerationJob;
  prompt: string;
  inputParts: ImagePart[];
  reference: ImagePart | null;
  promptFirst?: boolean;
  systemInstruction?: string | null;
  signal: AbortSignal;
  context: ProviderContext;
  ensureLease: () => Promise<void>;
  supabase: SupabaseClient;
}): Promise<Buffer> {
  if (!config.geminiApiKey) {
    throw new ProcessingError("config_error", "GEMINI_API_KEY is not configured", false);
  }
  const sourceLabel = {
    text: "SOURCE PHOTO (identity and set reference only — do not copy this crop):",
  };
  const parts: RequestPart[] =
    input.reference
      ? [
          { text: VIBE_IMAGE_PART_LABEL_REFERENCE },
          input.reference,
          { text: VIBE_IMAGE_PART_LABEL_SUBJECT },
          ...input.inputParts,
          { text: input.prompt },
        ]
      : input.promptFirst
        ? [
            { text: input.prompt },
            sourceLabel,
            ...input.inputParts,
          ]
        : [...input.inputParts, { text: input.prompt }];
  const base = await geminiBaseUrl(input.supabase);
  const geminiUrl = `${base.url}/v1beta/models/${input.job.model}:generateContent`;
  await input.ensureLease();
  const requestStarted = Date.now();
  log("info", "gemini_request_started", {
    ...input.context,
    model: input.job.model,
    imageSize: input.job.image_size,
    aspectRatio: input.job.aspect_ratio,
    editKind: input.job.edit_kind ?? null,
    proxy: base.proxy,
    partCount: parts.length,
    hasReference: Boolean(input.reference),
    promptFirst: Boolean(input.promptFirst),
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
        ...(input.systemInstruction
          ? {
              systemInstruction: {
                role: "system",
                parts: [{ text: input.systemInstruction }],
              },
            }
          : {}),
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: input.job.aspect_ratio, imageSize: input.job.image_size },
        },
      }),
      signal: AbortSignal.any([input.signal, AbortSignal.timeout(120000)]),
    });
  } catch (error) {
    if (input.signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    log("warn", "gemini_request_failed", {
      ...input.context,
      model: input.job.model,
      durationMs: elapsedMs(requestStarted),
      errorType: timeout ? "timeout" : "network_error",
    });
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
  if (!response.ok || !imageBase64) {
    log("warn", "gemini_request_failed", {
      ...input.context,
      model: input.job.model,
      durationMs: elapsedMs(requestStarted),
      httpStatus: response.status,
    });
    throw geminiFailure(payload, response.status);
  }
  const imageBuffer = Buffer.from(imageBase64, "base64");
  if (!imageBuffer.length) throw new ProcessingError("gemini_error", "Gemini returned an empty image", false);
  log("info", "gemini_request_completed", {
    ...input.context,
    model: input.job.model,
    imageSize: input.job.image_size,
    durationMs: elapsedMs(requestStarted),
    bytes: imageBuffer.length,
  });
  return imageBuffer;
}

async function generateGrokImage(input: {
  job: GenerationJob;
  model?: string;
  prompt: string;
  images: GrokImagePart[];
  signal: AbortSignal;
  context: ProviderContext;
  ensureLease: () => Promise<void>;
}): Promise<{ buffer: Buffer; costUsd: number | null }> {
  if (!config.xaiApiKey || !config.xaiBaseUrl) {
    throw new ProcessingError("config_error", "XAI_BASE_URL is not configured", false);
  }
  const model = input.model || GROK_IMAGINE_IMAGE_MODEL;
  const mapped = mapGrokImageResolution(input.job.image_size);
  const clamped = clampGrokImageParts(input.images);
  if (mapped.clamped) {
    log("info", "grok_image_size_clamped", {
      ...input.context,
      from: input.job.image_size,
      to: mapped.resolution,
    });
  }
  if (clamped.clamped) {
    log("info", "grok_input_clamped", {
      ...input.context,
      from: input.images.length,
      to: clamped.parts.length,
    });
  }
  const endpoint = clamped.parts.length ? "edits" : "generations";
  const url = clamped.parts.length
    ? xaiImageEditUrl(config.xaiBaseUrl)
    : xaiImageGenerateUrl(config.xaiBaseUrl);
  const body = clamped.parts.length
    ? buildXaiImageEditBody({
        model,
        prompt: input.prompt,
        aspectRatio: input.job.aspect_ratio,
        resolution: mapped.resolution,
        images: clamped.parts,
      })
    : buildXaiImageGenerateBody({
        model,
        prompt: input.prompt,
        aspectRatio: input.job.aspect_ratio,
        resolution: mapped.resolution,
      });
  await input.ensureLease();
  const requestStarted = Date.now();
  log("info", "grok_image_request_started", {
    ...input.context,
    model,
    endpoint,
    proxyHost: xaiProxyHost(config.xaiBaseUrl),
    partCount: clamped.parts.length,
    clampedPhotos: clamped.clamped,
    clampedSize: mapped.clamped,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.xaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any([input.signal, AbortSignal.timeout(120000)]),
    });
  } catch (error) {
    grokImageCircuit.record(false);
    if (input.signal.aborted) throw new ProcessingError("shutdown", "Worker is shutting down", true);
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    throw new ProcessingError(timeout ? "timeout" : "network_error", String((error as Error)?.message || error), true);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    grokImageCircuit.record(false);
    throw new ProcessingError(
      "grok_image_response_parse",
      `xAI returned non-JSON response (HTTP ${response.status})`,
      response.status === 429 || response.status >= 500,
    );
  }

  const message = xaiImageErrorMessage(payload);
  if (isXaiImageSafetyBlock(payload, message)) {
    grokImageCircuit.record(false);
    throw new ProcessingError("safety_block", message, false);
  }
  if (!response.ok) {
    grokImageCircuit.record(false);
    if (response.status === 429 || response.status >= 500) {
      throw new ProcessingError(`grok_http_${response.status}`, message, true);
    }
    throw new ProcessingError("grok_image_error", message, false);
  }

  let imageBase64 = extractXaiImageBase64(payload);
  if (!imageBase64) {
    const imageUrl = extractXaiImageUrl(payload);
    if (imageUrl) {
      try {
        imageBase64 = await downloadXaiImageBase64(imageUrl, input.signal);
      } catch (error) {
        grokImageCircuit.record(false);
        throw error;
      }
    }
  }
  if (!imageBase64) {
    grokImageCircuit.record(false);
    throw new ProcessingError("grok_image_error", message || "xAI returned an empty image", false);
  }
  const imageBuffer = Buffer.from(imageBase64, "base64");
  if (!imageBuffer.length) {
    grokImageCircuit.record(false);
    throw new ProcessingError("grok_image_error", "xAI returned an empty image", false);
  }
  grokImageCircuit.record(true);
  const costUsd = extractXaiCostUsd(payload);
  log("info", "grok_image_request_completed", {
    ...input.context,
    model,
    durationMs: elapsedMs(requestStarted),
    bytes: imageBuffer.length,
    costUsd,
  });
  return { buffer: imageBuffer, costUsd };
}

async function downloadXaiImageBase64(imageUrl: string, signal: AbortSignal): Promise<string> {
  const rewritten = rewriteXaiImageDownloadUrl(imageUrl, config.xaiBaseUrl);
  const response = await fetch(rewritten, {
    headers: { Authorization: `Bearer ${config.xaiApiKey}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) {
    throw new ProcessingError(
      response.status === 429 || response.status >= 500 ? `grok_http_${response.status}` : "grok_image_error",
      `xAI image download HTTP ${response.status}`,
      response.status === 429 || response.status >= 500,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

async function resolveImageFallbackTargets(supabase: SupabaseClient): Promise<{
  grok: string | null;
  seedream: string | null;
  photoshootFlux: string | null;
}> {
  const { data, error } = await supabase
    .from("landing_generation_config")
    .select("key,value")
    .in("key", [
      "image_fallback_model",
      "image_fallback_secondary_model",
      "photoshoot_fallback_model",
      "models",
    ]);
  if (error || !data?.length) {
    return { grok: GROK_IMAGINE_IMAGE_MODEL, seedream: null, photoshootFlux: null };
  }
  const configMap = Object.fromEntries(data.map((row) => [row.key, String(row.value || "")]));
  let models: Array<{ id?: string; enabled?: boolean }> = [];
  try {
    models = JSON.parse(configMap.models || "[]") as Array<{ id?: string; enabled?: boolean }>;
  } catch {
    models = [];
  }

  const pick = (
    raw: string | undefined,
    isTarget: (id: string) => boolean,
    fallbackId: string | null,
  ): string | null => {
    const value = raw?.trim() || "";
    if (!value || ["0", "false", "off", "no"].includes(value.toLowerCase())) return null;
    const target = isTarget(value) ? value : fallbackId;
    if (!target || !isTarget(target)) return null;
    if (models.length && !models.find((item) => item.id === target && item.enabled !== false)) {
      return null;
    }
    return target;
  };

  return {
    grok: pick(configMap.image_fallback_model, isGrokImageModel, GROK_IMAGINE_IMAGE_MODEL),
    seedream: pick(
      configMap.image_fallback_secondary_model,
      isSeedreamImageModel,
      SEEDREAM_50_PRO_IMAGE_MODEL,
    ),
    photoshootFlux: pick(
      configMap.photoshoot_fallback_model,
      isFluxImageModel,
      FLUX_2_FLEX_IMAGE_MODEL,
    ),
  };
}

async function persistImageFallback(
  supabase: SupabaseClient,
  generationId: string,
  requestedModel: string,
  executedModel: string,
): Promise<void> {
  const { error } = await supabase
    .from("landing_generations")
    .update({
      fallback_used: true,
      requested_model: requestedModel,
      executed_model: executedModel,
    })
    .eq("id", generationId);
  if (error) {
    log("warn", "generation_fallback_persist_failed", {
      generationId,
      error: error.message,
    });
  }
}
