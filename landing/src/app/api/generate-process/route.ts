import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";

const BUCKET_UPLOADS = "web-generation-uploads";
const BUCKET_RESULTS = "web-generation-results";

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

function getGeminiBaseUrl(): string {
  const url = process.env.GEMINI_PROXY_BASE_URL || "https://generativelanguage.googleapis.com";
  return url.replace(/\/+$/, "");
}

async function processGeneration(supabase: ReturnType<typeof createSupabaseServer>, id: string) {
  console.log("[generation.process] start", { generationId: id });
  const { data: gen, error: fetchErr } = await supabase
    .from("landing_generations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();

  if (fetchErr || !gen) {
    console.warn("[generation.process] generation not found or not pending", {
      generationId: id,
      fetchError: fetchErr?.message ?? null,
    });
    return;
  }

  const userId = gen.user_id as string;
  const creditsSpent = gen.credits_spent as number;

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
    userId,
    model: gen.model,
    aspectRatio: gen.aspect_ratio,
    imageSize: gen.image_size,
    photos: ((gen.input_photo_paths as string[]) || []).length,
    promptLength: String(gen.prompt_text || "").length,
  });

  const refundAndFail = async (errorType: string, errorMessage: string) => {
    console.warn("[generation.process] fail+refund", {
      generationId: id,
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
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: (gen.prompt_text as string) || "" },
  ];

  for (const path of inputPaths) {
    console.log("[generation.process] download input photo", {
      generationId: id,
      path,
    });
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET_UPLOADS)
      .download(path);

    if (downloadErr || !fileData) {
      console.error("[generation.process] input photo download failed", {
        generationId: id,
        path,
        downloadError: downloadErr?.message ?? null,
      });
      await refundAndFail("storage_error", "Не удалось загрузить фото");
      return;
    }

    const buf = Buffer.from(await fileData.arrayBuffer());
    const base64 = buf.toString("base64");
    const mime = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
    parts.push({ inlineData: { mimeType: mime, data: base64 } });
    console.log("[generation.process] input photo encoded", {
      generationId: id,
      path,
      mime,
      bytes: buf.length,
      base64Length: base64.length,
    });
  }

  const geminiUrl = `${getGeminiBaseUrl()}/v1beta/models/${gen.model}:generateContent`;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[generation.process] missing GEMINI_API_KEY", { generationId: id });
    await refundAndFail("config_error", "Gemini API key not configured");
    return;
  }

  let geminiRes: Response;
  try {
    console.log("[generation.process] gemini request", {
      generationId: id,
      url: geminiUrl,
      viaProxy: getGeminiBaseUrl() !== "https://generativelanguage.googleapis.com",
      partsCount: parts.length,
      model: gen.model,
      aspectRatio: gen.aspect_ratio,
      imageSize: gen.image_size,
    });
    geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: {
            aspectRatio: gen.aspect_ratio,
            imageSize: gen.image_size,
          },
        },
      }),
      signal: AbortSignal.timeout(120000),
    });
    console.log("[generation.process] gemini response headers", {
      generationId: id,
      status: geminiRes.status,
      ok: geminiRes.ok,
      contentType: geminiRes.headers.get("content-type"),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[generation.process] gemini fetch failed", {
      generationId: id,
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
      ...toErrorMeta(err),
    });
    await refundAndFail("gemini_error", "Gemini response parse failed");
    return;
  }

  const candidates = geminiData?.candidates as Array<{ content?: { parts?: Array<{ inlineData?: { data: string }; text?: string }> } }> | undefined;
  const firstTextPart = candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string");
  console.log("[generation.process] gemini payload summary", {
    generationId: id,
    hasPromptFeedback: !!geminiData?.promptFeedback,
    candidateCount: Array.isArray(candidates) ? candidates.length : 0,
    hasFirstText: !!firstTextPart,
    firstTextPreview:
      typeof firstTextPart?.text === "string" ? firstTextPart.text.slice(0, 200) : null,
  });

  const blockReason = (geminiData?.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
  if (blockReason) {
    console.warn("[generation.process] gemini blocked", {
      generationId: id,
      blockReason,
    });
    await refundAndFail("gemini_blocked", "Контент заблокирован модерацией");
    return;
  }

  const imagePart = candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData);
  const imageBase64 = imagePart?.inlineData?.data;

  if (!imageBase64) {
    const errMsg = (geminiData?.error as { message?: string } | undefined)?.message || "Gemini не вернул изображение";
    console.error("[generation.process] no image in gemini response", {
      generationId: id,
      errMsg,
      status: geminiRes.status,
    });
    await refundAndFail("no_image", errMsg);
    return;
  }

  console.log("[generation.process] gemini image received", {
    generationId: id,
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

  console.log("[generation.process] completed", {
    generationId: id,
    resultPath,
    resultUrl,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body as { id?: string };
    if (!id) {
      console.warn("[generation.process] bad request: missing id");
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    console.log("[generation.process] POST received", { generationId: id });
    const supabase = createSupabaseServer();
    await processGeneration(supabase, id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[generation.process] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "Process failed" }, { status: 500 });
  }
}
