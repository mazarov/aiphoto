import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readAcquisitionRequestIds } from "@/lib/acquisition-request";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";
import { isStvGuestUser } from "@/lib/stv-guest-mode";
import { ensureLandingUserForGeneration } from "@/lib/ensure-landing-user";
import { scheduleNoCreditsMail } from "@/lib/mail-credit-block";
import { isStvOpenGenerateDebugEnabled } from "@/lib/stv-open-generate-debug";
import { isStoragePathOwnedByAuthUser } from "@/lib/user-generation-photos";
import {
  generationEditFingerprintFields,
  normalizeEditInstruction,
  validateGenerationEditContract,
} from "@/lib/generation-edit-contract";
import {
  CAMERA_ORBIT_EDIT_KIND,
  LOCAL_EDIT_KIND,
  cameraOrbitFingerprintFields,
  isCameraOrbitEditKind,
  parseCameraPose,
  resolveSceneRootId,
  serializeCameraOrbitInstruction,
  validateCameraPoseRange,
  type CameraPose,
} from "@/lib/camera-orbit";
import { isCameraOrbitUnlocked } from "@/lib/camera-orbit-access";
import {
  normalizeGenerationSurface,
  resolveGenerationSourceType,
} from "@/lib/generation-enqueue-core";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_VIDEO_MODEL,
  IMAGE_GENERATION_MODALITY,
  VIDEO_GENERATION_MODALITY,
  clampImageSizeForModel,
  isGenerationModality,
  isImageAspectRatio,
  isImageSize,
} from "@/lib/generation/image-options";
import {
  parseEnabledGenerationModels,
  parseEnabledVideoGenerationModels,
} from "@/lib/generation-model-labels";
import {
  calculateVideoCreditCost,
  normalizeVideoDurationSeconds,
  resolveVideoAspectRatio,
  resolveVideoModelId,
  resolveVideoResolution,
  isVideoAnimateUnlocked,
  validateVideoGenerationSource,
  videoSourceErrorMessage,
} from "@/lib/video-generation-contract";

/** PromptShot paid generate is site-only for now (inline compose / same-origin). */
const GENERATION_CLIENT_SOURCE = "site" as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function POST(req: NextRequest) {
  const acquisition = readAcquisitionRequestIds(req);
  try {
    console.log("[generation.create] incoming request");
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      console.warn("[generation.create] unauthorized", {
        authError: authError?.message ?? null,
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (["0", "false", "off"].includes(
      String(process.env.GENERATION_QUEUE_ENABLED ?? "true").trim().toLowerCase()
    )) {
      return NextResponse.json(
        {
          error: "generation_temporarily_unavailable",
          message: "Генерация временно недоступна",
        },
        { status: 503 }
      );
    }
    /** Allowlisted internal generate: free credits, still attributed to this session user. */
    const openDebug = isStvOpenGenerateDebugEnabled(user.email);

    const body = await req.json();
    const pipelineTrace = getStvPipelineTrace(req, body);
    const {
      generationSurface: rawGenerationSurface,
      modality,
      prompt,
      model,
      aspectRatio,
      imageSize,
      cardId,
      photoStoragePaths,
      vibeId,
      parentGenerationId,
      editInstruction,
      editKind,
      cameraPose: rawCameraPose,
      durationSeconds,
      idempotencyKey: bodyIdempotencyKey,
    } = body as {
      generationSurface?: string;
      modality?: string;
      prompt?: string;
      model?: string;
      aspectRatio?: string;
      imageSize?: string;
      cardId?: string | null;
      photoStoragePaths?: string[];
      vibeId?: string | null;
      parentGenerationId?: string | null;
      editInstruction?: string | null;
      editKind?: string | null;
      cameraPose?: unknown;
      durationSeconds?: number;
      pipelineTraceId?: string;
      idempotencyKey?: string;
    };
    const requestedModality = modality || IMAGE_GENERATION_MODALITY;
    if (!isGenerationModality(requestedModality)) {
      return NextResponse.json(
        {
          error: "unsupported_modality",
          message: "Этот тип генерации пока недоступен",
        },
        { status: 400 }
      );
    }
    const isVideo = requestedModality === VIDEO_GENERATION_MODALITY;

    const minPromptLength = 8;
    const callerId = user.id;
    const requestedEditKind =
      typeof editKind === "string" ? editKind.trim() : "";
    const isCameraOrbit = isCameraOrbitEditKind(requestedEditKind);
    if (requestedEditKind && !isCameraOrbit && requestedEditKind !== LOCAL_EDIT_KIND) {
      return NextResponse.json(
        { error: "validation_error", message: "Некорректный тип изменения" },
        { status: 400 }
      );
    }
    if (isCameraOrbit && isVideo) {
      return NextResponse.json(
        { error: "validation_error", message: "Смена ракурса доступна только для фото" },
        { status: 400 }
      );
    }

    if (
      !isCameraOrbit &&
      (!prompt || typeof prompt !== "string" || prompt.trim().length < minPromptLength)
    ) {
      console.warn("[generation.create] validation error: prompt too short", {
        userId: callerId,
        promptLength: typeof prompt === "string" ? prompt.trim().length : null,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Промпт должен быть минимум 8 символов" },
        { status: 400 }
      );
    }

    let normalizedParentGenerationId =
      typeof parentGenerationId === "string" ? parentGenerationId.trim() : "";
    const normalizedPhotoStoragePaths = Array.isArray(photoStoragePaths)
      ? photoStoragePaths
      : [];
    let normalizedEditInstruction = normalizeEditInstruction(editInstruction);
    const hasParentGeneration = Boolean(normalizedParentGenerationId);
    let cameraOrbitPose: CameraPose | null = null;
    let cameraOrbitSceneRootId: string | null = null;
    let inheritedRootPrompt = "";
    let inheritedRootModel = "";
    let inheritedRootAspect = "";
    let inheritedRootSize = "";

    if (hasParentGeneration && !UUID_RE.test(normalizedParentGenerationId)) {
      return NextResponse.json(
        { error: "validation_error", message: "Некорректный источник генерации" },
        { status: 400 }
      );
    }
    if (hasParentGeneration && normalizedPhotoStoragePaths.length > 0) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Укажите либо исходные фото, либо предыдущую генерацию",
        },
        { status: 400 }
      );
    }
    if (isCameraOrbit && !hasParentGeneration) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Смена ракурса доступна только для готового фото",
        },
        { status: 400 }
      );
    }
    if (isCameraOrbit) {
      cameraOrbitPose = parseCameraPose(rawCameraPose);
      if (!cameraOrbitPose) {
        return NextResponse.json(
          { error: "invalid_camera_pose", message: "Некорректный ракурс камеры" },
          { status: 400 }
        );
      }
      const poseError = validateCameraPoseRange(cameraOrbitPose);
      if (poseError === "pose_unchanged") {
        return NextResponse.json(
          { error: "pose_unchanged", message: "Это исходный ракурс" },
          { status: 400 }
        );
      }
      if (poseError === "invalid_camera_pose") {
        return NextResponse.json(
          { error: "invalid_camera_pose", message: "Ракурс вне допустимого диапазона" },
          { status: 400 }
        );
      }
    }
    const editContractError = isVideo || isCameraOrbit
      ? null
      : validateGenerationEditContract({
          hasParentGeneration,
          editInstruction: normalizedEditInstruction,
        });
    if (editContractError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: editContractError,
        },
        { status: 400 }
      );
    }
    const generationSurface = normalizeGenerationSurface(rawGenerationSurface);
    const sourceType = resolveGenerationSourceType({
      hasParentGeneration,
      photoCount: normalizedPhotoStoragePaths.length,
    });

    if (
      normalizedPhotoStoragePaths.some(
        (path) =>
          typeof path !== "string" || !isStoragePathOwnedByAuthUser(path, user.id)
      )
    ) {
      console.warn("[generation.create] validation error: foreign photo path", {
        userId: callerId,
      });
      return NextResponse.json(
        { error: "forbidden", message: "Недоступное фото" },
        { status: 403 }
      );
    }

    const supabase = createSupabaseServer();
    if (hasParentGeneration) {
      const { data: parent, error: parentError } = await supabase
        .from("landing_generations")
        .select(
          isCameraOrbit
            ? "id,status,requester_auth_user_id,result_storage_bucket,result_storage_path,modality,edit_kind,scene_root_id,model,aspect_ratio,image_size,prompt_text"
            : "id,status,requester_auth_user_id,result_storage_bucket,result_storage_path,modality,model,aspect_ratio,image_size,prompt_text"
        )
        .eq("id", normalizedParentGenerationId)
        .eq("requester_auth_user_id", callerId)
        .maybeSingle();
      if (parentError) {
        console.error("[generation.create] parent lookup failed", {
          userId: callerId,
          parentGenerationId: normalizedParentGenerationId,
          error: parentError.message,
        });
        return NextResponse.json(
          { error: "parent_lookup_failed", message: "Не удалось проверить исходную генерацию" },
          { status: 500 }
        );
      }
      if (!parent) {
        return NextResponse.json(
          { error: "forbidden", message: "Предыдущая генерация недоступна" },
          { status: 403 }
        );
      }
      if (
        parent.status !== "completed" ||
        !parent.result_storage_bucket ||
        !parent.result_storage_path
      ) {
        return NextResponse.json(
          { error: "parent_not_ready", message: "Предыдущая генерация ещё не готова" },
          { status: 409 }
        );
      }
      if (isVideo && (parent.modality || "image") !== IMAGE_GENERATION_MODALITY) {
        return NextResponse.json(
          { error: "validation_error", message: "Оживить можно только готовое фото" },
          { status: 400 }
        );
      }
      if (isCameraOrbit && cameraOrbitPose) {
        if ((parent.modality || "image") !== IMAGE_GENERATION_MODALITY) {
          return NextResponse.json(
            { error: "validation_error", message: "Смена ракурса доступна только для фото" },
            { status: 400 }
          );
        }
        const rootId = resolveSceneRootId(parent);
        let root = parent;
        if (rootId !== parent.id) {
          const { data: rootRow, error: rootError } = await supabase
            .from("landing_generations")
            .select(
              "id,status,requester_auth_user_id,result_storage_bucket,result_storage_path,modality,edit_kind,scene_root_id,model,aspect_ratio,image_size,prompt_text"
            )
            .eq("id", rootId)
            .eq("requester_auth_user_id", callerId)
            .maybeSingle();
          if (rootError || !rootRow) {
            return NextResponse.json(
              { error: "forbidden", message: "Исходный кадр сцены недоступен" },
              { status: 403 }
            );
          }
          root = rootRow;
        }
        if (
          root.status !== "completed" ||
          !root.result_storage_bucket ||
          !root.result_storage_path ||
          (root.modality || "image") !== IMAGE_GENERATION_MODALITY
        ) {
          return NextResponse.json(
            { error: "parent_not_ready", message: "Исходный кадр сцены ещё не готов" },
            { status: 409 }
          );
        }
        const { data: busyRow } = await supabase
          .from("landing_generations")
          .select("id")
          .eq("requester_auth_user_id", callerId)
          .eq("scene_root_id", root.id)
          .eq("edit_kind", CAMERA_ORBIT_EDIT_KIND)
          .in("status", ["pending", "processing"])
          .limit(1)
          .maybeSingle();
        if (busyRow) {
          return NextResponse.json(
            {
              error: "camera_orbit_busy",
              message: "Этот ракурс ещё снимается",
            },
            { status: 409 }
          );
        }
        normalizedParentGenerationId = root.id;
        cameraOrbitSceneRootId = root.id;
        inheritedRootPrompt = String(root.prompt_text || "").trim();
        inheritedRootModel = String(root.model || "").trim();
        inheritedRootAspect = String(root.aspect_ratio || "").trim();
        inheritedRootSize = String(root.image_size || "").trim();
        normalizedEditInstruction = serializeCameraOrbitInstruction(cameraOrbitPose);
      }
    }

    const ar = isVideo
      ? resolveVideoAspectRatio(aspectRatio)
      : (isCameraOrbit && inheritedRootAspect) || aspectRatio || DEFAULT_IMAGE_ASPECT_RATIO;
    let sz = isVideo
      ? resolveVideoResolution(imageSize)
      : (isCameraOrbit && inheritedRootSize) || imageSize || DEFAULT_IMAGE_SIZE;
    if (isVideo) {
      const sourceError = validateVideoGenerationSource({
        hasParentGeneration,
        photoCount: normalizedPhotoStoragePaths.length,
        editInstruction: normalizedEditInstruction,
        parentModality: IMAGE_GENERATION_MODALITY,
      });
      if (sourceError) {
        return NextResponse.json(
          { error: "validation_error", message: videoSourceErrorMessage(sourceError) },
          { status: 400 }
        );
      }
    } else {
      if (!isImageAspectRatio(ar)) {
        console.warn("[generation.create] validation error: invalid aspect ratio", {
          userId: callerId,
          aspectRatio: ar,
        });
        return NextResponse.json(
          { error: "validation_error", message: "Недопустимый формат" },
          { status: 400 }
        );
      }
      if (!isImageSize(sz)) {
        console.warn("[generation.create] validation error: invalid image size", {
          userId: callerId,
          imageSize: sz,
        });
        return NextResponse.json(
          { error: "validation_error", message: "Недопустимое качество" },
          { status: 400 }
        );
      }
    }

    let resolvedVibeId: string | null = null;

    // Open-debug skips vibe ownership; card inline generate always sends vibeId=null.
    if (vibeId && user) {
      const { data: vibeRow, error: vibeError } = await supabase
        .from("vibes")
        .select("id,user_id")
        .eq("id", vibeId)
        .single();
      if (vibeError || !vibeRow || vibeRow.user_id !== user.id) {
        console.warn("[generation.create] validation error: invalid vibeId", {
          userId: user.id,
          vibeId,
          vibeError: vibeError?.message ?? null,
        });
        return NextResponse.json(
          { error: "validation_error", message: "Недопустимый vibeId" },
          { status: 400 }
        );
      }
      resolvedVibeId = vibeRow.id;
    }

    const { data: configRows } = await supabase
      .from("landing_generation_config")
      .select("key, value")
      .in("key", [
        "models",
        "default_model",
        "max_photos",
        "video_models",
        "video_animate_enabled",
        "default_video_model",
        "camera_orbit_enabled",
      ]);

    const config: Record<string, string> = {};
    for (const row of configRows || []) {
      config[row.key] = row.value;
    }

    const configuredMaxPhotos = Number.parseInt(config.max_photos || "10", 10);
    const maxPhotos = Number.isFinite(configuredMaxPhotos)
      ? Math.max(1, Math.min(10, configuredMaxPhotos))
      : 10;
    if (normalizedPhotoStoragePaths.length > maxPhotos) {
      console.warn("[generation.create] validation error: too many photos", {
        userId: callerId,
        photos: normalizedPhotoStoragePaths.length,
        maxPhotos,
      });
      return NextResponse.json(
        { error: "validation_error", message: `Максимум ${maxPhotos} фото` },
        { status: 400 }
      );
    }

    if (isVideo) {
      const enabled = isVideoAnimateUnlocked(
        config.video_animate_enabled,
        user.email
      );
      if (!enabled && !openDebug) {
        return NextResponse.json(
          {
            error: "video_disabled",
            message: "Оживление фото пока недоступно",
          },
          { status: 503 }
        );
      }
    }
    if (isCameraOrbit) {
      const enabled = isCameraOrbitUnlocked(
        config.camera_orbit_enabled,
        user.email
      );
      if (!enabled && !openDebug) {
        return NextResponse.json(
          {
            error: "camera_orbit_disabled",
            message: "Смена ракурса пока недоступна",
          },
          { status: 503 }
        );
      }
    }

    let models: { id: string; cost: number }[] = [];
    if (isVideo) {
      models = parseEnabledVideoGenerationModels(config.video_models).map((item) => ({
        id: item.id,
        cost: item.cost,
      }));
    } else {
      models = parseEnabledGenerationModels(config.models).map((item) => ({
        id: item.id,
        cost: item.cost,
      }));
    }

    const resolvedVideoModelId = isVideo
      ? resolveVideoModelId(
          model || DEFAULT_VIDEO_MODEL,
          models.map((item) => item.id)
        )
      : null;
    const videoDuration = isVideo
      ? normalizeVideoDurationSeconds(durationSeconds, resolvedVideoModelId)
      : null;
    const requestedImageModel = isCameraOrbit && inheritedRootModel
      ? inheritedRootModel
      : typeof model === "string" ? model.trim() : "";
    const modelConfig = isVideo
      ? models.find((item) => item.id === resolvedVideoModelId) || models[0]
      : requestedImageModel
        ? models.find((item) => item.id === requestedImageModel)
          || (isCameraOrbit
            ? models.find((item) => item.id === config.default_model) || models[0]
            : undefined)
        : models.find((item) => item.id === config.default_model) || models[0];
    if (!isVideo && requestedImageModel && !modelConfig) {
      return NextResponse.json(
        { error: "validation_error", message: "Неизвестная модель генерации" },
        { status: 400 }
      );
    }
    if (!isVideo && modelConfig) {
      sz = clampImageSizeForModel(modelConfig.id, sz);
    }
    if (
      !modelConfig ||
      !Number.isInteger(modelConfig.cost) ||
      modelConfig.cost < 0
    ) {
      console.error("[generation.create] invalid generation model config", {
        modelRequested: model ?? null,
        modelConfig: modelConfig ?? null,
      });
      return NextResponse.json(
        { error: "config_error", message: "Модель генерации временно недоступна" },
        { status: 503 }
      );
    }
    const creditsNeeded = isVideo
      ? calculateVideoCreditCost(modelConfig.cost, videoDuration, modelConfig.id)
      : modelConfig.cost;
    const guestMode = Boolean(user && isStvGuestUser(user));
    /** Open-debug and guest: never charge. */
    const creditsCharged = openDebug || guestMode ? 0 : creditsNeeded;
    const promptText = isCameraOrbit
      ? (typeof prompt === "string" && prompt.trim().length >= minPromptLength
          ? prompt.trim()
          : inheritedRootPrompt)
      : prompt.trim();
    if (!promptText || promptText.length < minPromptLength) {
      return NextResponse.json(
        { error: "validation_error", message: "Промпт должен быть минимум 8 символов" },
        { status: 400 }
      );
    }
    const suppliedIdempotencyKey =
      req.headers.get("Idempotency-Key") || bodyIdempotencyKey || "";
    const idempotencyKey = suppliedIdempotencyKey.trim() || crypto.randomUUID();
    if (
      idempotencyKey.length > 128 ||
      !/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)
    ) {
      return NextResponse.json(
        { error: "validation_error", message: "Некорректный Idempotency-Key" },
        { status: 400 }
      );
    }
    const ensuredUser = await ensureLandingUserForGeneration(supabase, user);
    if (!ensuredUser.ok) {
      return NextResponse.json(
        { error: ensuredUser.error, message: ensuredUser.message },
        { status: ensuredUser.status }
      );
    }

    let dbUserId = ensuredUser.dbUserId;
    let usedGuestOwner = ensuredUser.usedGuestOwner;
    /**
     * Open-debug: must bind to the session owner's shared DB id (imageprompt_users),
     * not guest-owner. JWT auth.users.id may differ from that id on the shared DB.
     */
    if (openDebug) {
      if (ensuredUser.usedGuestOwner) {
        console.error("[generation.create] open-debug cannot bind to session user", {
          userId: user.id,
          dbUserId: ensuredUser.dbUserId,
          usedGuestOwner: ensuredUser.usedGuestOwner,
        });
        return NextResponse.json(
          {
            error: "profile_unavailable",
            message:
              "Не удалось привязать генерацию к вашему профилю. Проверьте landing_users для этого аккаунта.",
          },
          { status: 500 }
        );
      }
      dbUserId = ensuredUser.dbUserId;
      usedGuestOwner = false;
    }
    const requestFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          requesterAuthUserId: callerId,
          prompt: promptText,
          model: modelConfig.id,
          aspectRatio: ar,
          imageSize: sz,
          photoStoragePaths: normalizedPhotoStoragePaths,
          ...(isCameraOrbit && cameraOrbitPose && cameraOrbitSceneRootId
            ? cameraOrbitFingerprintFields(cameraOrbitSceneRootId, cameraOrbitPose)
            : generationEditFingerprintFields(
                normalizedParentGenerationId,
                normalizedEditInstruction
              )),
          vibeId: resolvedVibeId,
          cardId: cardId || null,
          clientSource: GENERATION_CLIENT_SOURCE,
          modality: requestedModality,
          durationSeconds: videoDuration,
        })
      )
      .digest("hex");

    console.log("[generation.create] resolved config", {
      userId: callerId,
      dbUserId,
      pipelineTrace,
      userEmail: user.email ?? null,
      openDebug,
      modelRequested: model ?? null,
      modelResolved: modelConfig.id,
      creditsNeeded,
      creditsCharged,
      guestMode,
      usedGuestOwner,
      aspectRatio: ar,
      imageSize: sz,
      photos: normalizedPhotoStoragePaths.length,
      sourceType,
      generationSurface,
      generationMode: isCameraOrbit
        ? "camera_orbit"
        : hasParentGeneration
          ? "local_edit"
          : "initial",
      parentGenerationId: normalizedParentGenerationId || null,
      sceneRootId: cameraOrbitSceneRootId,
      cameraPose: cameraOrbitPose,
      editInstructionLength: normalizedEditInstruction.length,
      promptLength: promptText.length,
    });
    stvLog("generation.create", {
      pipelineTrace,
      userId: callerId,
      dbUserId,
      vibeId: resolvedVibeId,
      cardId: cardId || null,
      modelResolved: modelConfig.id,
      creditsNeeded,
      creditsCharged,
      guestMode,
      openDebug,
      usedGuestOwner,
      aspectRatio: ar,
      imageSize: sz,
      photos: normalizedPhotoStoragePaths.length,
      sourceType,
      generationSurface,
      generationMode: isCameraOrbit
        ? "camera_orbit"
        : hasParentGeneration
          ? "local_edit"
          : "initial",
      parentGenerationId: normalizedParentGenerationId || null,
      sceneRootId: cameraOrbitSceneRootId,
      cameraPose: cameraOrbitPose,
      editInstructionLength: normalizedEditInstruction.length,
      promptLength: promptText.length,
    });

    const { data: enqueueRows, error: enqueueError } = await supabase.rpc(
      "landing_enqueue_generation",
      {
        p_user_id: dbUserId,
        p_requester_auth_user_id: callerId,
        p_idempotency_key: idempotencyKey,
        p_request_fingerprint: requestFingerprint,
        p_card_id: cardId || null,
        p_prompt_text: promptText,
        p_model: modelConfig.id,
        p_aspect_ratio: ar,
        p_image_size: sz,
        p_credits_spent: creditsCharged,
        p_input_photo_paths: normalizedPhotoStoragePaths,
        p_vibe_id: isCameraOrbit ? null : resolvedVibeId,
        p_client_source: GENERATION_CLIENT_SOURCE,
        p_pipeline_trace_id: pipelineTrace,
        p_create_ugc: isVideo ? false : !guestMode,
        p_parent_generation_id: normalizedParentGenerationId || null,
        p_edit_instruction: isVideo ? null : normalizedEditInstruction || null,
        p_modality: requestedModality,
        p_duration_seconds: videoDuration,
        p_visitor_id: acquisition.visitorId,
        p_session_id: acquisition.sessionId,
        ...(isCameraOrbit
          ? {
              p_edit_kind: CAMERA_ORBIT_EDIT_KIND,
              p_scene_root_id: cameraOrbitSceneRootId,
              p_camera_pose: cameraOrbitPose,
            }
          : {}),
      }
    );
    const enqueueRow = Array.isArray(enqueueRows) ? enqueueRows[0] : enqueueRows;
    const generationId =
      enqueueRow && typeof enqueueRow === "object" && "generation_id" in enqueueRow
        ? String(enqueueRow.generation_id)
        : "";
    const generationCreated =
      enqueueRow && typeof enqueueRow === "object" && "created" in enqueueRow
        ? Boolean(enqueueRow.created)
        : true;

    if (enqueueError || !generationId) {
      const insufficient = enqueueError?.message?.includes("insufficient_credits");
      const idempotencyConflict =
        enqueueError?.message?.includes("idempotency_conflict");
      const parentUnavailable =
        enqueueError?.message?.includes("parent_generation_not_found") ||
        enqueueError?.message?.includes("parent_generation_forbidden") ||
        enqueueError?.message?.includes("parent_generation_not_ready") ||
        enqueueError?.message?.includes("parent_generation_not_image");
      const { data: userRow } = insufficient
        ? await supabase
            .from("landing_users")
            .select("credits")
            .eq("id", dbUserId)
            .maybeSingle()
        : { data: null };
      const availableCredits = Number(userRow?.credits || 0);
      console.error("[generation.create] enqueue error", {
        userId: callerId,
        dbUserId,
        usedGuestOwner,
        idempotencyKey,
        enqueueError: enqueueError?.message ?? null,
      });
      if (insufficient) {
        if (!usedGuestOwner) {
          scheduleNoCreditsMail(supabase, dbUserId, "generate");
        }
        return NextResponse.json(
          {
            error: "insufficient_credits",
            message: "Недостаточно кредитов",
            required: creditsCharged,
            available: availableCredits,
          },
          { status: 400 }
        );
      }
      if (idempotencyConflict) {
        return NextResponse.json(
          {
            error: "idempotency_conflict",
            message: "Idempotency-Key уже использован для другого запроса",
          },
          { status: 409 }
        );
      }
      if (parentUnavailable) {
        return NextResponse.json(
          {
            error: "parent_unavailable",
            message: "Предыдущая генерация больше недоступна",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Failed to enqueue generation" }, { status: 500 });
    }

    console.log("[generation.create] generation queued", {
      generationId,
      userId: callerId,
      dbUserId,
      usedGuestOwner,
      openDebug,
      pipelineTrace,
      idempotencyKey,
      generationCreated,
      clientSource: GENERATION_CLIENT_SOURCE,
      status: "pending",
    });
    stvLog("generation.row_created", {
      pipelineTrace,
      userId: callerId,
      dbUserId,
      usedGuestOwner,
      openDebug,
      generationId,
      vibeId: resolvedVibeId,
      clientSource: GENERATION_CLIENT_SOURCE,
    });
    return NextResponse.json(
      { id: generationId, status: "pending", created: generationCreated },
      { status: 202 }
    );
  } catch (err) {
    console.error("[generation.create] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
