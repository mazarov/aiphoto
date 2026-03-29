import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { createUgcCardForCompletedGeneration } from "@/lib/web-ugc-card";
import {
  assembleLandingCardFinalPrompt,
  assembleVibeFinalPrompt,
  getVibeAttachReferenceImageToGeneration,
  VIBE_IMAGE_PART_LABEL_REFERENCE,
  VIBE_IMAGE_PART_LABEL_SUBJECT,
} from "@/lib/vibe-gemini-instructions";
import { VIBE_PROMPT_CHAIN_LEGACY_2C23 } from "@/lib/vibe-legacy-config";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";
import { redactGenerateContentBody } from "@/lib/gemini-vibe-debug-log";

const BUCKET_UPLOADS = "web-generation-uploads";
const BUCKET_RESULTS = "web-generation-results";
const DIRECT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

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

/** Full prompt body in logs; disable with LANDING_LOG_FULL_GENERATION_PROMPT=0 if too noisy. */
function shouldLogFullGenerationPrompt(): boolean {
  return parseBooleanConfig(process.env.LANDING_LOG_FULL_GENERATION_PROMPT, true);
}

/** Redacted multimodal `generateContent` body (no base64); for debugging STV image requests. */
function shouldLogGeminiGenerateContentBodyRedacted(): boolean {
  return parseBooleanConfig(process.env.LANDING_LOG_GEMINI_GENERATE_CONTENT_BODY_REDACTED, false);
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
    console.warn("[generation.process] failed to read photo_app_config.gemini_use_proxy", {
      ...toErrorMeta(err),
    });
    return true;
  }
}

async function getGeminiBaseUrlRuntime(
  supabase: ReturnType<typeof createSupabaseServer>
): Promise<{ baseUrl: string; viaProxy: boolean }> {
  const useProxy = await shouldUseGeminiProxy(supabase);
  const proxyBase = (process.env.GEMINI_PROXY_BASE_URL || "").replace(/\/+$/, "");
  if (useProxy && proxyBase) {
    return { baseUrl: proxyBase, viaProxy: true };
  }
  if (useProxy && !proxyBase) {
    console.warn("[generation.process] gemini_use_proxy=true but GEMINI_PROXY_BASE_URL is empty, fallback to direct");
  }
  return { baseUrl: DIRECT_GEMINI_BASE_URL, viaProxy: false };
}

async function processGeneration(
  supabase: ReturnType<typeof createSupabaseServer>,
  id: string,
  pipelineTrace: string | null = null,
) {
  const pt = pipelineTrace || null;
  console.log("[generation.process] start", { generationId: id, pipelineTrace: pt });
  stvLog("generation.process.start", { pipelineTrace: pt, generationId: id });
  const { data: gen, error: fetchErr } = await supabase
    .from("landing_generations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();

  if (fetchErr || !gen) {
    console.warn("[generation.process] generation not found or not pending", {
      generationId: id,
      pipelineTrace: pt,
      fetchError: fetchErr?.message ?? null,
    });
    return;
  }

  const userId = gen.user_id as string;
  const creditsSpent = gen.credits_spent as number;
  const promptText = String(gen.prompt_text || "");
  const promptPreview =
    promptText.length > 800 ? `${promptText.slice(0, 800)}... [truncated]` : promptText;

  await supabase
    .from("landing_generations")
    .update({
      status: "processing",
      generation_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  console.log("[generation.process] marked processing", {
    generationId: id,
    pipelineTrace: pt,
    userId,
    model: gen.model,
    aspectRatio: gen.aspect_ratio,
    imageSize: gen.image_size,
    photos: ((gen.input_photo_paths as string[]) || []).length,
    promptLength: promptText.length,
    promptPreview,
  });
  stvLog("generation.process.marked_processing", {
    pipelineTrace: pt,
    generationId: id,
    userId,
    vibeId: gen.vibe_id ?? null,
    model: gen.model,
    promptLength: promptText.length,
  });

  const refundAndFail = async (errorType: string, errorMessage: string) => {
    console.warn("[generation.process] fail+refund", {
      generationId: id,
      pipelineTrace: pt,
      userId,
      errorType,
      errorMessage,
      creditsSpent,
    });
    await supabase.rpc("landing_deduct_credits", {
      p_user_id: userId,
      p_amount: -creditsSpent,
    });
    await supabase
      .from("landing_generations")
      .update({
        status: "failed",
        error_type: errorType,
        error_message: errorMessage,
        generation_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  };

  const inputPaths = (gen.input_photo_paths as string[]) || [];
  const rawPrompt = (gen.prompt_text as string) || "";
  const isVibeGeneration = !!(gen.vibe_id);

  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
  /** For logs: each user upload sent to Gemini (order matches imageParts). */
  const userImageMetaForLog: { storagePath: string; mime: string; bytes: number }[] = [];

  for (const path of inputPaths) {
    console.log("[generation.process] download input photo", {
      generationId: id,
      pipelineTrace: pt,
      path,
    });
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET_UPLOADS)
      .download(path);

    if (downloadErr || !fileData) {
      console.error("[generation.process] input photo download failed", {
        generationId: id,
        pipelineTrace: pt,
        path,
        downloadError: downloadErr?.message ?? null,
      });
      await refundAndFail("storage_error", "Не удалось загрузить фото");
      return;
    }

    const buf = Buffer.from(await fileData.arrayBuffer());
    const base64 = buf.toString("base64");
    const mime = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
    imageParts.push({ inlineData: { mimeType: mime, data: base64 } });
    userImageMetaForLog.push({ storagePath: path, mime, bytes: buf.length });
    console.log("[generation.process] input photo encoded", {
      generationId: id,
      pipelineTrace: pt,
      path,
      mime,
      bytes: buf.length,
      base64Length: base64.length,
    });
  }

  const attachRefPixel =
    isVibeGeneration && (await getVibeAttachReferenceImageToGeneration(supabase));

  let referenceImagePart: { inlineData: { mimeType: string; data: string } } | null = null;
  let referenceMetaForLog: {
    sourceUrl: string;
    host: string;
    mime: string;
    bytes: number;
  } | null = null;

  let vibePromptChain: string | null = null;
  if (gen.vibe_id) {
    const { data: vibeRow } = await supabase
      .from("vibes")
      .select("source_image_url,prompt_chain")
      .eq("id", gen.vibe_id)
      .single();
    vibePromptChain = typeof vibeRow?.prompt_chain === "string" ? vibeRow.prompt_chain : null;

    if (attachRefPixel) {
      const refUrl = vibeRow?.source_image_url as string | undefined;
      if (refUrl) {
        try {
          console.log("[generation.process] downloading reference image", {
            generationId: id,
            pipelineTrace: pt,
            refHost: new URL(refUrl).hostname,
          });
          const refRes = await fetch(refUrl, {
            headers: {
              "User-Agent": "PromptShotBot/1.0 (+https://promptshot.ru)",
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(15000),
          });
          if (refRes.ok) {
            const ct = String(refRes.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
            const refMime = ct === "image/png" || ct === "image/webp" ? ct : "image/jpeg";
            const refBuf = Buffer.from(await refRes.arrayBuffer());
            if (refBuf.length <= 10 * 1024 * 1024) {
              referenceImagePart = { inlineData: { mimeType: refMime, data: refBuf.toString("base64") } };
              try {
                const ru = new URL(refUrl);
                referenceMetaForLog = {
                  sourceUrl: refUrl,
                  host: ru.hostname,
                  mime: refMime,
                  bytes: refBuf.length,
                };
              } catch {
                referenceMetaForLog = {
                  sourceUrl: refUrl.slice(0, 300),
                  host: "(parse_error)",
                  mime: refMime,
                  bytes: refBuf.length,
                };
              }
              console.log("[generation.process] reference image encoded", {
                generationId: id,
                pipelineTrace: pt,
                mime: refMime,
                bytes: refBuf.length,
              });
            }
          } else {
            console.warn("[generation.process] reference image download non-ok", {
              generationId: id,
              pipelineTrace: pt,
              status: refRes.status,
            });
          }
        } catch (err) {
          console.warn("[generation.process] reference image download failed", {
            generationId: id,
            pipelineTrace: pt,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  const hasTwoImages = isVibeGeneration && referenceImagePart !== null;

  if (isVibeGeneration) {
    console.warn("[generation.process] vibe_generation_layout", {
      generationId: id,
      pipelineTrace: pt,
      attachReferenceIntent: attachRefPixel,
      referenceDownloaded: Boolean(referenceImagePart),
      architecture: hasTwoImages ? "dual_reference_plus_user" : "single_user_image_plus_text_only",
      vibePromptChain: vibePromptChain ?? "unknown",
      legacyPromptChain: vibePromptChain === VIBE_PROMPT_CHAIN_LEGACY_2C23,
    });
  }

  if (isVibeGeneration && attachRefPixel && !referenceImagePart) {
    console.error("[generation.process] vibe_reference_required_but_missing", {
      generationId: id,
      pipelineTrace: pt,
      vibeId: gen.vibe_id ?? null,
    });
    await refundAndFail(
      "vibe_reference_missing",
      "Референс Steal This Vibe не загрузился и не был отправлен в модель. Повторите extract или проверьте доступность URL изображения.",
    );
    return;
  }

  const fullPrompt = isVibeGeneration
    ? assembleVibeFinalPrompt(rawPrompt, hasTwoImages)
    : assembleLandingCardFinalPrompt(rawPrompt);

  if (shouldLogFullGenerationPrompt()) {
    console.warn("[generation.process] full_prompt_text", {
      generationId: id,
      pipelineTrace: pt,
      userId,
      isVibeGeneration,
      hasTwoImages,
      rawPromptChars: rawPrompt.length,
      fullPromptChars: fullPrompt.length,
      text: fullPrompt,
    });
  }

  /*
   * Two-image vibe: interleaved text labels so the model maps A=reference, B=user.
   * [label, IMAGE A, label, IMAGE B(s), long text] — avoids two anonymous consecutive images.
   */
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] =
    hasTwoImages && referenceImagePart
      ? [
          { text: VIBE_IMAGE_PART_LABEL_REFERENCE },
          referenceImagePart,
          { text: VIBE_IMAGE_PART_LABEL_SUBJECT },
          ...imageParts,
          { text: fullPrompt },
        ]
      : [...imageParts, { text: fullPrompt }];

  if (isVibeGeneration) {
    console.warn("[generation.process] parts_outline", {
      generationId: id,
      pipelineTrace: pt,
      hasTwoImages,
      partKinds: parts.map((p) => (p.inlineData ? "inlineData" : "text")),
      textPartCount: parts.filter((p) => p.text).length,
    });
  }

  const imagesSentToGemini: Array<{
    partIndex: number;
    role: string;
    storagePath?: string;
    sourceUrlHost?: string;
    sourceUrlPreview?: string;
    mime: string;
    bytes: number;
    base64Chars: number;
  }> = [];
  let refImageLogged = false;
  let userMetaIdx = 0;
  for (let pi = 0; pi < parts.length; pi++) {
    const p = parts[pi];
    if (!p?.inlineData) continue;
    const idata = p.inlineData;
    if (hasTwoImages && referenceMetaForLog && !refImageLogged) {
      refImageLogged = true;
      imagesSentToGemini.push({
        partIndex: pi,
        role: "IMAGE_A_style_reference",
        sourceUrlHost: referenceMetaForLog.host,
        sourceUrlPreview:
          referenceMetaForLog.sourceUrl.length > 220
            ? `${referenceMetaForLog.sourceUrl.slice(0, 220)}…`
            : referenceMetaForLog.sourceUrl,
        mime: idata.mimeType,
        bytes: referenceMetaForLog.bytes,
        base64Chars: idata.data.length,
      });
      continue;
    }
    const um = userImageMetaForLog[userMetaIdx];
    userMetaIdx += 1;
    imagesSentToGemini.push({
      partIndex: pi,
      role: hasTwoImages ? `IMAGE_B_user_subject_${userMetaIdx}` : `user_subject_${userMetaIdx}`,
      storagePath: um?.storagePath,
      mime: idata.mimeType,
      bytes: um?.bytes ?? 0,
      base64Chars: idata.data.length,
    });
  }

  console.warn("[generation.process] gemini_multimodal_images", {
    generationId: id,
    pipelineTrace: pt,
    userId,
    model: gen.model,
    vibeId: gen.vibe_id ?? null,
    isVibeGeneration,
    attachReferencePixelsEnv: attachRefPixel,
    hasTwoImages,
    imagesSentToGemini,
    partsSequence: parts.map((p, idx) => {
      if (p.inlineData) {
        return {
          partIndex: idx,
          type: "inlineData",
          mime: p.inlineData.mimeType,
          base64Chars: p.inlineData.data.length,
        };
      }
      const t = p.text ?? "";
      return {
        partIndex: idx,
        type: "text",
        chars: t.length,
        head: t.trim().slice(0, 72) + (t.length > 72 ? "…" : ""),
      };
    }),
  });

  const { baseUrl: geminiBaseUrl, viaProxy } = await getGeminiBaseUrlRuntime(supabase);
  const geminiUrl = `${geminiBaseUrl}/v1beta/models/${gen.model}:generateContent`;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[generation.process] missing GEMINI_API_KEY", { generationId: id, pipelineTrace: pt });
    await refundAndFail("config_error", "Gemini API key not configured");
    return;
  }

  const geminiRequestPayload = {
    contents: [{ role: "user" as const, parts }],
    generationConfig: {
      responseModalities: ["IMAGE"] as const,
      imageConfig: {
        aspectRatio: gen.aspect_ratio,
        imageSize: gen.image_size,
      },
    },
  };

  let geminiRes: Response;
  try {
    console.log("[generation.process] gemini request", {
      generationId: id,
      pipelineTrace: pt,
      url: geminiUrl,
      viaProxy,
      partsCount: parts.length,
      model: gen.model,
      aspectRatio: gen.aspect_ratio,
      imageSize: gen.image_size,
      isVibeGeneration,
      hasTwoImages,
      promptLength: fullPrompt.length,
    });
    stvLog("generation.process.gemini_request", {
      pipelineTrace: pt,
      generationId: id,
      userId,
      model: gen.model,
      partsCount: parts.length,
      promptLength: fullPrompt.length,
    });
    if (shouldLogGeminiGenerateContentBodyRedacted()) {
      console.warn("[generation.process] gemini_request_body_redacted", {
        generationId: id,
        pipelineTrace: pt,
        body: redactGenerateContentBody(geminiRequestPayload),
      });
    }
    geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(geminiRequestPayload),
      signal: AbortSignal.timeout(120000),
    });
    console.log("[generation.process] gemini response headers", {
      generationId: id,
      pipelineTrace: pt,
      status: geminiRes.status,
      ok: geminiRes.ok,
      contentType: geminiRes.headers.get("content-type"),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[generation.process] gemini fetch failed", {
      generationId: id,
      pipelineTrace: pt,
      ...toErrorMeta(err),
    });
    await refundAndFail("timeout", msg);
    return;
  }

  let geminiData: Record<string, unknown>;
  try {
    geminiData = (await geminiRes.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("[generation.process] gemini response parse failed", {
      generationId: id,
      pipelineTrace: pt,
      ...toErrorMeta(err),
    });
    await refundAndFail("gemini_error", "Gemini response parse failed");
    return;
  }

  const candidates = geminiData?.candidates as Array<{
    finishReason?: string;
    safetyRatings?: Array<{ category?: string; probability?: string; blocked?: boolean }>;
    content?: { parts?: Array<{ inlineData?: { data: string }; text?: string }> };
  }> | undefined;
  const firstCandidate = candidates?.[0];
  const firstCandidateParts = firstCandidate?.content?.parts ?? [];
  const firstTextPart = firstCandidateParts.find((p) => typeof p.text === "string");
  const firstCandidatePartTypes = firstCandidateParts.map((p) =>
    p.inlineData ? "inlineData" : typeof p.text === "string" ? "text" : "unknown"
  );
  console.log("[generation.process] gemini payload summary", {
    generationId: id,
    pipelineTrace: pt,
    hasPromptFeedback: !!geminiData?.promptFeedback,
    candidateCount: Array.isArray(candidates) ? candidates.length : 0,
    firstCandidateFinishReason: firstCandidate?.finishReason ?? null,
    firstCandidateSafetyRatings: firstCandidate?.safetyRatings ?? null,
    firstCandidatePartTypes,
    hasFirstText: !!firstTextPart,
    firstTextPreview:
      typeof firstTextPart?.text === "string" ? firstTextPart.text.slice(0, 200) : null,
  });

  const blockReason = (geminiData?.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
  if (blockReason) {
    console.warn("[generation.process] gemini blocked", {
      generationId: id,
      pipelineTrace: pt,
      blockReason,
    });
    await refundAndFail("gemini_blocked", "Контент заблокирован модерацией");
    return;
  }

  const imagePart = firstCandidateParts.find((p: { inlineData?: { data: string } }) => p.inlineData);
  const imageBase64 = imagePart?.inlineData?.data;

  if (!imageBase64) {
    const errMsg = (geminiData?.error as { message?: string } | undefined)?.message || "Gemini не вернул изображение";
    console.error("[generation.process] no image in gemini response", {
      generationId: id,
      pipelineTrace: pt,
      errMsg,
      status: geminiRes.status,
    });
    await refundAndFail("no_image", errMsg);
    return;
  }

  console.log("[generation.process] gemini image received", {
    generationId: id,
    pipelineTrace: pt,
    base64Length: imageBase64.length,
  });

  const resultPath = `${userId}/${id}.png`;
  const imageBuffer = Buffer.from(imageBase64, "base64");

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_RESULTS)
    .upload(resultPath, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[generation.process] upload result failed", {
      generationId: id,
      pipelineTrace: pt,
      path: resultPath,
      uploadError: uploadErr.message,
    });
    await refundAndFail("storage_error", "Не удалось сохранить результат");
    return;
  }

  const resultUrl = getStoragePublicUrl(BUCKET_RESULTS, resultPath);

  await supabase
    .from("landing_generations")
    .update({
      status: "completed",
      result_storage_bucket: BUCKET_RESULTS,
      result_storage_path: resultPath,
      generation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  try {
    const ugc = await createUgcCardForCompletedGeneration(supabase, {
      generationId: id,
      userId,
      promptText: rawPrompt,
      resultBucket: BUCKET_RESULTS,
      resultPath,
    });
    if (ugc?.slug) {
      console.log("[generation.process] ugc prompt_card created", {
        generationId: id,
        pipelineTrace: pt,
        cardId: ugc.cardId,
        slug: ugc.slug,
      });
    }
  } catch (ugcErr) {
    console.error("[generation.process] ugc card creation failed", {
      generationId: id,
      pipelineTrace: pt,
      ...toErrorMeta(ugcErr),
    });
  }

  console.log("[generation.process] completed", {
    generationId: id,
    pipelineTrace: pt,
    resultPath,
    resultUrl,
  });
  stvLog("generation.process.completed", {
    pipelineTrace: pt,
    generationId: id,
    userId,
    resultPath,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body as { id?: string; pipelineTraceId?: string };
    const traceResolved = getStvPipelineTrace(req, body);
    if (!id) {
      console.warn("[generation.process] bad request: missing id");
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    console.log("[generation.process] POST received", {
      generationId: id,
      pipelineTrace: traceResolved,
    });
    const supabase = createSupabaseServer();
    await processGeneration(supabase, id, traceResolved);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[generation.process] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "Process failed" }, { status: 500 });
  }
}
