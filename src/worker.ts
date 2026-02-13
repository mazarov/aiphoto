import axios from "axios";
import os from "os";
import sharp from "sharp";
import { config } from "./config";
import { supabase } from "./lib/supabase";
import { getFilePath, downloadFile, sendMessage, sendPhoto, editMessageText, deleteMessage } from "./lib/telegram";
import { getText } from "./lib/texts";
import { sendAlert, sendNotification } from "./lib/alerts";
import { getAppConfig } from "./lib/app-config";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; name?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 2000, name = "operation" } = options;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND"].includes(err.code) 
        || (err.response?.status && err.response.status >= 500);
      
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      
      const delay = baseDelayMs * attempt;
      console.log(`${name} attempt ${attempt}/${maxAttempts} failed (${err.code || err.response?.status}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error("Unreachable");
}

const WORKER_ID = `${os.hostname()}-${process.pid}-${Date.now()}`;
console.log(`Worker started: ${WORKER_ID}`);

// Quality presets: max dimension in pixels
const QUALITY_MAP: Record<string, number> = {
  fhd: 1920,
  "2k": 2560,
  "4k": 3840,
};

// Parse aspect ratio string (e.g. "16:9") into {w, h}
function parseAspectRatio(ratio: string): { w: number; h: number } {
  const parts = ratio.split(":");
  if (parts.length === 2) {
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: 1, h: 1 }; // default square
}

// Calculate output dimensions from aspect ratio and quality
function getOutputDimensions(aspectRatio: string, quality: string): { width: number; height: number } {
  const maxSide = QUALITY_MAP[quality] || 1920;
  const { w, h } = parseAspectRatio(aspectRatio);
  
  if (w >= h) {
    // Landscape or square: width = maxSide
    return { width: maxSide, height: Math.round(maxSide * h / w) };
  } else {
    // Portrait: height = maxSide
    return { width: Math.round(maxSide * w / h), height: maxSide };
  }
}

async function runJob(job: any) {
  const { data: session } = await supabase
    .from("photo_sessions")
    .select("*")
    .eq("id", job.session_id)
    .maybeSingle();

  if (!session) {
    throw new Error("Session not found");
  }

  const { data: user } = await supabase
    .from("photo_users")
    .select("telegram_id, lang, username, credits, total_generations, onboarding_step")
    .eq("id", session.user_id)
    .maybeSingle();

  const telegramId = user?.telegram_id;
  const lang = user?.lang || "en";
  if (!telegramId) {
    throw new Error("User telegram_id not found");
  }

  async function updateProgress(step: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    if (!session.progress_message_id || !session.progress_chat_id) return;
    try {
      await editMessageText(
        session.progress_chat_id,
        session.progress_message_id,
        await getText(lang, `progress.step${step}`)
      );
    } catch (err) {
      // ignore edit errors
    }
  }

  async function clearProgress() {
    if (!session.progress_message_id || !session.progress_chat_id) return;
    try {
      await deleteMessage(session.progress_chat_id, session.progress_message_id);
    } catch (err) {
      // ignore delete errors
    }
  }

  const photos = Array.isArray(session.photos) ? session.photos : [];
  const generationType = session.generation_type || "style";

  // Source: always original photo (no sticker chain in photo bot)
  const sourceFileId = session.current_photo_file_id || photos[photos.length - 1];

  console.log("[Worker] Source file debug:", {
    generationType,
    sourceFileId: sourceFileId?.substring(0, 30) + "...",
    "session.current_photo_file_id": session.current_photo_file_id?.substring(0, 30) + "...",
    "photos.length": photos.length,
  });

  if (!sourceFileId) {
    throw new Error("No source file for generation");
  }

  await updateProgress(2);
  const filePath = await getFilePath(sourceFileId);
  const fileBuffer = await downloadFile(filePath);

  const base64 = fileBuffer.toString("base64");
  const mimeType = filePath.endsWith(".webp")
    ? "image/webp"
    : filePath.endsWith(".png")
      ? "image/png"
      : "image/jpeg";

  await updateProgress(3);
  console.log("Calling Gemini image generation...");
  console.log("generationType:", generationType);
  console.log("Full prompt:", session.prompt_final);

  // Read generation parameters from session (set during flow in index.ts)
  const selectedModel = session.selected_model || await getAppConfig("gemini_model_style", "gemini-3-pro-image-preview");
  const selectedAspectRatio = session.selected_aspect_ratio || "1:1";
  const selectedQuality = session.selected_quality || "fhd";
  
  console.log("Using model:", selectedModel, "aspectRatio:", selectedAspectRatio, "quality:", selectedQuality);

  let geminiRes;
  try {
    geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: session.prompt_final || "" },
              {
                inlineData: {
                  mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: selectedAspectRatio },
        },
      },
      {
        headers: { "x-goog-api-key": config.geminiApiKey },
      }
    );
  } catch (err: any) {
    const errorData = err.response?.data;
    const errorMessage = errorData?.error?.message || err.message || err.code || "Unknown error";
    const errorStatus = err.response?.status;
    
    console.error("=== Gemini API Error ===");
    console.error("Status:", errorStatus);
    console.error("Message:", errorMessage);
    console.error("Code:", err.code);
    console.error("Full response:", JSON.stringify(errorData || {}, null, 2));
    
    await sendAlert({
      type: "gemini_error",
      message: errorMessage,
      details: { 
        user: `@${user?.username || telegramId}`,
        sessionId: session.id, 
        generationType,
        styleGroup: session.selected_style_group || "-",
        styleId: session.selected_style_id || "-",
        userInput: (session.user_input || "").slice(0, 100),
        status: errorStatus,
        errorCode: err.code,
        errorData: JSON.stringify(errorData || {}).slice(0, 300),
      },
    });
    throw new Error(`Gemini API failed: ${errorMessage}`);
  }

  // Check for content moderation block
  const blockReason = geminiRes.data?.promptFeedback?.blockReason;
  if (blockReason) {
    console.error("Gemini blocked:", blockReason);
    await sendAlert({
      type: "generation_failed",
      message: `Gemini blocked: ${blockReason}`,
      details: { 
        user: `@${user?.username || telegramId}`,
        sessionId: session.id, 
        generationType,
        styleId: session.selected_style_id || "-",
        userInput: (session.user_input || "").slice(0, 100),
        blockReason,
      },
    });

    const lang = user?.lang || "en";
    const blockedMsg = lang === "ru"
      ? "⚠️ Не удалось обработать это фото в выбранном стиле.\n\nПопробуй другое фото или другой стиль.\nКредит возвращён на баланс."
      : "⚠️ Could not process this photo with the chosen style.\n\nTry a different photo or style.\nCredit has been refunded.";
    const retryBtnBlocked = lang === "ru" ? "🔄 Повторить" : "🔄 Retry";
    await sendMessage(telegramId, blockedMsg, {
      inline_keyboard: [[
        { text: retryBtnBlocked, callback_data: `retry_generation:${session.id}` },
      ]],
    });

    // Refund credits
    const creditsToRefund = session.credits_spent || 1;
    await supabase
      .from("photo_users")
      .update({ credits: (user?.credits || 0) + creditsToRefund })
      .eq("id", session.user_id);

    return;
  }

  const imageBase64 =
    geminiRes.data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData
      ?.data || null;

  if (!imageBase64) {
    console.error("Gemini response:", JSON.stringify(geminiRes.data, null, 2));
    const geminiText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No text response";
    await sendAlert({
      type: "generation_failed",
      message: "Gemini returned no image",
      details: { 
        user: `@${user?.username || telegramId}`,
        sessionId: session.id, 
        generationType,
        styleGroup: session.selected_style_group || "-",
        styleId: session.selected_style_id || "-",
        userInput: (session.user_input || "").slice(0, 100),
        geminiResponse: geminiText.slice(0, 200),
      },
    });
    throw new Error("Gemini returned no image");
  }

  console.log("Image generated successfully");

  await updateProgress(5);
  const generatedBuffer = Buffer.from(imageBase64, "base64");

  // ============================================================
  // Photo processing: resize by quality + aspect ratio
  // No background removal needed for AI Photo Bot
  // ============================================================
  const { width: targetWidth, height: targetHeight } = getOutputDimensions(selectedAspectRatio, selectedQuality);
  console.log(`[photo] Resizing to ${targetWidth}x${targetHeight} (${selectedAspectRatio}, ${selectedQuality})`);

  const photoBuffer = await sharp(generatedBuffer)
    .resize(targetWidth, targetHeight, {
      fit: "cover",
      position: "center",
    })
    .png()
    .toBuffer();

  await updateProgress(7);
  const filePathStorage = `photos/${session.user_id}/${session.id}/${Date.now()}.png`;

  // Insert result record
  const { data: resultRecord } = await supabase
    .from("photo_results")
    .insert({
      user_id: session.user_id,
      session_id: session.id,
      source_photo_file_id: sourceFileId,
      user_input: session.user_input || null,
      generated_prompt: session.prompt_final || null,
      result_storage_path: filePathStorage,
      style_preset_id: session.selected_style_id || null,
      env: config.appEnv,
    })
    .select("id")
    .single();

  const resultId = resultRecord?.id;
  console.log("resultId after insert:", resultId);

  // Buttons for result photo
  const newStyleText = lang === "ru" ? "🎨 Другой стиль" : "🎨 Another style";
  const newPhotoText = lang === "ru" ? "📷 Новое фото" : "📷 New photo";

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: newStyleText, callback_data: "new_style" },
        { text: newPhotoText, callback_data: "new_photo" },
      ],
    ],
  };

  // Send result as photo
  console.log("[photo] Sending result photo to user...");
  const photoFileId = await sendPhoto(telegramId, photoBuffer, replyMarkup);

  // Update telegram_file_id
  if (resultId && photoFileId) {
    await supabase
      .from("photo_results")
      .update({ telegram_file_id: photoFileId })
      .eq("id", resultId);
    console.log("result telegram_file_id updated successfully");
  }

  // Send result notification (async, non-blocking)
  sendNotification({
    type: "new_photo",
    message: [
      `👤 @${user.username || telegramId} (${telegramId})`,
      `💰 Кредиты: ${user.credits}`,
      `🎨 Стиль: ${session.selected_style_id || "-"}`,
      `🤖 Модель: ${selectedModel}`,
      `📐 Формат: ${selectedAspectRatio}`,
      `📏 Качество: ${selectedQuality}`,
    ].join("\n"),
    sourceImageBuffer: fileBuffer,
    resultImageBuffer: photoBuffer,
  }).catch(console.error);

  await clearProgress();

  // Upload to storage in background (non-critical)
  supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(filePathStorage, photoBuffer, { contentType: "image/png", upsert: true })
    .then(() => console.log("[storage] Upload completed:", filePathStorage))
    .catch((err) => {
      console.error("Storage upload failed:", err);
    });

  await supabase
    .from("photo_sessions")
    .update({
      state: "confirm_result",
      is_active: true,
      last_result_file_id: photoFileId,
      last_result_storage_path: filePathStorage,
      progress_message_id: null,
      progress_chat_id: null,
    })
    .eq("id", session.id);
}

async function poll() {
  while (true) {
    const { data: jobs, error } = await supabase.rpc("photo_claim_job", {
      p_worker_id: WORKER_ID,
      p_env: config.appEnv,
    });

    if (error) {
      console.error("Error claiming job:", error.message);
      await sleep(config.jobPollIntervalMs);
      continue;
    }

    const job = jobs?.[0];
    if (!job) {
      await sleep(config.jobPollIntervalMs);
      continue;
    }

    console.log(`Job ${job.id} claimed by ${WORKER_ID}`);

    try {
      await runJob(job);
      await supabase
        .from("photo_jobs")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", job.id);
    } catch (err: any) {
      console.error("Job failed:", job.id, err?.message || err);

      await supabase
        .from("photo_jobs")
        .update({
          status: "error",
          error: String(err?.message || err),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      // Refund credits on error
      try {
        const { data: session } = await supabase
          .from("photo_sessions")
          .select("user_id, photos, credits_spent")
          .eq("id", job.session_id)
          .maybeSingle();

        if (session?.user_id) {
          const creditsToRefund = session.credits_spent || 1;

          const { data: refundUser } = await supabase
            .from("photo_users")
            .select("credits, telegram_id, lang")
            .eq("id", session.user_id)
            .maybeSingle();

          if (refundUser) {
            await supabase
              .from("photo_users")
              .update({ credits: (refundUser.credits || 0) + creditsToRefund })
              .eq("id", session.user_id);

            if (refundUser.telegram_id) {
              const rlang = refundUser.lang || "en";
              const errorText = rlang === "ru"
                ? "❌ Произошла ошибка при генерации фото.\n\nКредиты возвращены на баланс."
                : "❌ An error occurred during photo generation.\n\nCredits have been refunded.";
              const retryBtn = rlang === "ru" ? "🔄 Повторить" : "🔄 Retry";
              await sendMessage(refundUser.telegram_id, errorText, {
                inline_keyboard: [[
                  { text: retryBtn, callback_data: `retry_generation:${job.session_id}` },
                ]],
              });
            }
          }
        }
      } catch (refundErr) {
        console.error("Failed to refund credits:", refundErr);
      }
    }
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
  console.error("Uncaught exception:", err);
  await sendAlert({
    type: "worker_error",
    message: err.message,
    stack: err.stack,
    details: { workerId: WORKER_ID },
  });
  process.exit(1);
});

process.on("unhandledRejection", async (reason: any) => {
  console.error("Unhandled rejection:", reason);
  await sendAlert({
    type: "worker_error",
    message: reason?.message || String(reason),
    stack: reason?.stack,
    details: { workerId: WORKER_ID },
  });
});

poll().catch(async (e) => {
  console.error(e);
  await sendAlert({
    type: "worker_error",
    message: e?.message || String(e),
    stack: e?.stack,
    details: { workerId: WORKER_ID },
  });
  process.exit(1);
});
