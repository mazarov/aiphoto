import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";

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
  try {
    console.log("[generation.create] incoming request");
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      console.warn("[generation.create] unauthorized", {
        authError: authError?.message ?? null,
      });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const pipelineTrace = getStvPipelineTrace(req, body);
    const {
      prompt,
      model,
      aspectRatio,
      imageSize,
      cardId,
      photoStoragePaths,
      vibeId,
    } = body as {
      prompt?: string;
      model?: string;
      aspectRatio?: string;
      imageSize?: string;
      cardId?: string | null;
      photoStoragePaths?: string[];
      vibeId?: string | null;
      pipelineTraceId?: string;
    };

    const minPromptLength = 8;
    const validAspectRatios = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];
    const validImageSizes = ["1K", "2K", "4K"];

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < minPromptLength) {
      console.warn("[generation.create] validation error: prompt too short", {
        userId: user.id,
        promptLength: typeof prompt === "string" ? prompt.trim().length : null,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Промпт должен быть минимум 8 символов" },
        { status: 400 }
      );
    }

    if (!photoStoragePaths || !Array.isArray(photoStoragePaths) || photoStoragePaths.length < 1) {
      console.warn("[generation.create] validation error: no photos", { userId: user.id });
      return NextResponse.json(
        { error: "validation_error", message: "Нужно минимум 1 фото" },
        { status: 400 }
      );
    }

    if (photoStoragePaths.length > 4) {
      console.warn("[generation.create] validation error: too many photos", {
        userId: user.id,
        photos: photoStoragePaths.length,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Максимум 4 фото" },
        { status: 400 }
      );
    }

    const ar = aspectRatio || "1:1";
    const sz = imageSize || "1K";
    if (!validAspectRatios.includes(ar)) {
      console.warn("[generation.create] validation error: invalid aspect ratio", {
        userId: user.id,
        aspectRatio: ar,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Недопустимый формат" },
        { status: 400 }
      );
    }
    if (!validImageSizes.includes(sz)) {
      console.warn("[generation.create] validation error: invalid image size", {
        userId: user.id,
        imageSize: sz,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Недопустимое качество" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    let resolvedVibeId: string | null = null;

    if (vibeId) {
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
      .in("key", ["models", "default_model"]);

    const config: Record<string, string> = {};
    for (const row of configRows || []) {
      config[row.key] = row.value;
    }

    let models: { id: string; cost: number }[] = [];
    try {
      const parsed = JSON.parse(config.models || "[]");
      models = parsed
        .filter((m: { enabled?: boolean }) => m.enabled !== false)
        .map((m: { id: string; cost: number }) => ({ id: m.id, cost: m.cost }));
    } catch {
      models = [
        { id: "gemini-2.5-flash-image", cost: 1 },
        { id: "gemini-3-pro-image-preview", cost: 2 },
        { id: "gemini-3.1-flash-image-preview", cost: 3 },
      ];
    }

    const modelConfig = models.find((m) => m.id === model) || models[0];
    const creditsNeeded = modelConfig.cost;
    const promptText = prompt.trim();
    const promptPreview =
      promptText.length > 800 ? `${promptText.slice(0, 800)}... [truncated]` : promptText;
    console.log("[generation.create] resolved config", {
      userId: user.id,
      pipelineTrace,
      userEmail: user.email ?? null,
      userName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      modelRequested: model ?? null,
      modelResolved: modelConfig.id,
      creditsNeeded,
      aspectRatio: ar,
      imageSize: sz,
      photos: photoStoragePaths.length,
      promptLength: promptText.length,
      promptPreview,
    });
    stvLog("generation.create", {
      pipelineTrace,
      userId: user.id,
      vibeId: resolvedVibeId,
      cardId: cardId || null,
      modelResolved: modelConfig.id,
      creditsNeeded,
      aspectRatio: ar,
      imageSize: sz,
      photos: photoStoragePaths.length,
      promptLength: promptText.length,
      promptPreview,
    });

    const { data: userRow } = await supabase
      .from("landing_users")
      .select("credits")
      .eq("id", user.id)
      .single();

    const availableCredits = (userRow as { credits?: number } | null)?.credits ?? 0;
    if (availableCredits < creditsNeeded) {
      console.warn("[generation.create] insufficient credits", {
        userId: user.id,
        availableCredits,
        creditsNeeded,
      });
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "Недостаточно кредитов",
          required: creditsNeeded,
          available: availableCredits,
        },
        { status: 400 }
      );
    }

    const { data: deductResult, error: deductError } = await supabase.rpc(
      "landing_deduct_credits",
      { p_user_id: user.id, p_amount: creditsNeeded }
    );

    if (deductError || deductResult === -1) {
      console.warn("[generation.create] credit deduction failed", {
        userId: user.id,
        availableCredits,
        creditsNeeded,
        deductError: deductError?.message ?? null,
        deductResult,
      });
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message: "Недостаточно кредитов",
          required: creditsNeeded,
          available: availableCredits,
        },
        { status: 400 }
      );
    }

    const { data: gen, error: insertError } = await supabase
      .from("landing_generations")
      .insert({
        user_id: user.id,
        status: "pending",
        card_id: cardId || null,
        prompt_text: promptText,
        model: modelConfig.id,
        aspect_ratio: ar,
        image_size: sz,
        credits_spent: creditsNeeded,
        input_photo_paths: photoStoragePaths,
        vibe_id: resolvedVibeId,
      })
      .select("id")
      .single();

    if (insertError || !gen) {
      await supabase.rpc("landing_deduct_credits", {
        p_user_id: user.id,
        p_amount: -creditsNeeded,
      });
      console.error("[generation.create] insert error", {
        userId: user.id,
        insertError: insertError?.message ?? null,
      });
      return NextResponse.json({ error: "Failed to create generation" }, { status: 500 });
    }

    console.log("[generation.create] generation row created", {
      generationId: gen.id,
      userId: user.id,
      pipelineTrace,
      status: "pending",
    });
    stvLog("generation.row_created", {
      pipelineTrace,
      userId: user.id,
      generationId: gen.id,
      vibeId: resolvedVibeId,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      req.headers.get("origin") ||
      req.nextUrl.origin;
    console.log("[generation.create] kickoff generate-process", {
      generationId: gen.id,
      baseUrl,
    });

    fetch(`${baseUrl}/api/generate-process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: gen.id,
        ...(pipelineTrace ? { pipelineTraceId: pipelineTrace } : {}),
      }),
    })
      .then((res) => {
        console.log("[generation.create] generate-process kickoff response", {
          generationId: gen.id,
          status: res.status,
          ok: res.ok,
        });
      })
      .catch((err) =>
        console.error("[generation.create] generate-process kickoff error", {
          generationId: gen.id,
          ...toErrorMeta(err),
        })
      );

    return NextResponse.json({ id: gen.id });
  } catch (err) {
    console.error("[generation.create] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
