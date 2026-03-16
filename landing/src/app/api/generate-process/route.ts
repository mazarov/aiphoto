import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";

const BUCKET_UPLOADS = "web-generation-uploads";
const BUCKET_RESULTS = "web-generation-results";

function getGeminiBaseUrl(): string {
  const url = process.env.GEMINI_PROXY_BASE_URL || "https://generativelanguage.googleapis.com";
  return url.replace(/\/+$/, "");
}

async function processGeneration(supabase: ReturnType<typeof createSupabaseServer>, id: string) {
  const { data: gen, error: fetchErr } = await supabase
    .from("landing_generations")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();

  if (fetchErr || !gen) {
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

  const refundAndFail = async (errorType: string, errorMessage: string) => {
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
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET_UPLOADS)
      .download(path);

    if (downloadErr || !fileData) {
      await refundAndFail("storage_error", "Не удалось загрузить фото");
      return;
    }

    const buf = Buffer.from(await fileData.arrayBuffer());
    const base64 = buf.toString("base64");
    const mime = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
    parts.push({ inlineData: { mimeType: mime, data: base64 } });
  }

  const geminiUrl = `${getGeminiBaseUrl()}/v1beta/models/${gen.model}:generateContent`;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    await refundAndFail("config_error", "Gemini API key not configured");
    return;
  }

  let geminiRes: Response;
  try {
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await refundAndFail("timeout", msg);
    return;
  }

  const geminiData = (await geminiRes.json()) as Record<string, unknown>;

  const blockReason = (geminiData?.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
  if (blockReason) {
    await refundAndFail("gemini_blocked", "Контент заблокирован модерацией");
    return;
  }

  const candidates = geminiData?.candidates as Array<{ content?: { parts?: Array<{ inlineData?: { data: string } }> } }> | undefined;
  const imagePart = candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData);
  const imageBase64 = imagePart?.inlineData?.data;

  if (!imageBase64) {
    const errMsg = (geminiData?.error as { message?: string } | undefined)?.message || "Gemini не вернул изображение";
    await refundAndFail("no_image", errMsg);
    return;
  }

  const resultPath = `${userId}/${id}.png`;
  const imageBuffer = Buffer.from(imageBase64, "base64");

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_RESULTS)
    .upload(resultPath, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadErr) {
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    await processGeneration(supabase, id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("generate-process error:", err);
    return NextResponse.json({ error: "Process failed" }, { status: 500 });
  }
}
