import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";
import { isStvGuestUser } from "@/lib/stv-guest-mode";
import {
  ensureLandingUserForGeneration,
  resolveGuestOwnerDbUserId,
} from "@/lib/ensure-landing-user";
import { isStvOpenGenerateDebugEnabled } from "@/lib/stv-open-generate-debug";

/** PromptShot paid generate is site-only for now (inline compose / same-origin). */
const GENERATION_CLIENT_SOURCE = "site" as const;

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
    const openDebug = isStvOpenGenerateDebugEnabled(user?.email);

    if ((authError || !user) && !openDebug) {
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
    const callerId = user?.id ?? "open-debug";

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < minPromptLength) {
      console.warn("[generation.create] validation error: prompt too short", {
        userId: callerId,
        promptLength: typeof prompt === "string" ? prompt.trim().length : null,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Промпт должен быть минимум 8 символов" },
        { status: 400 }
      );
    }

    if (!photoStoragePaths || !Array.isArray(photoStoragePaths) || photoStoragePaths.length < 1) {
      console.warn("[generation.create] validation error: no photos", { userId: callerId });
      return NextResponse.json(
        { error: "validation_error", message: "Нужно минимум 1 фото" },
        { status: 400 }
      );
    }

    if (photoStoragePaths.length > 4) {
      console.warn("[generation.create] validation error: too many photos", {
        userId: callerId,
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
        userId: callerId,
        aspectRatio: ar,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Недопустимый формат" },
        { status: 400 }
      );
    }
    if (!validImageSizes.includes(sz)) {
      console.warn("[generation.create] validation error: invalid image size", {
        userId: callerId,
        imageSize: sz,
      });
      return NextResponse.json(
        { error: "validation_error", message: "Недопустимое качество" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
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
    const guestMode = Boolean(user && isStvGuestUser(user));
    /** Open-debug and guest: never charge. */
    const creditsCharged = openDebug || guestMode ? 0 : creditsNeeded;
    const promptText = prompt.trim();
    const promptPreview =
      promptText.length > 800 ? `${promptText.slice(0, 800)}... [truncated]` : promptText;

    let dbUserId: string;
    let usedGuestOwner = false;
    if (openDebug || !user) {
      const owner = await resolveGuestOwnerDbUserId(supabase);
      if ("error" in owner) {
        console.error("[generation.create] open-debug owner failed", { error: owner.error });
        return NextResponse.json(
          {
            error: "guest_owner_unavailable",
            message:
              "Нет FK-валидного профиля для open-debug. Войдите один раз через Google/Yandex.",
          },
          { status: 500 }
        );
      }
      dbUserId = owner.userId;
      usedGuestOwner = true;
    } else {
      const ensuredUser = await ensureLandingUserForGeneration(supabase, user);
      if (!ensuredUser.ok) {
        return NextResponse.json(
          { error: ensuredUser.error, message: ensuredUser.message },
          { status: ensuredUser.status }
        );
      }
      dbUserId = ensuredUser.dbUserId;
      usedGuestOwner = ensuredUser.usedGuestOwner;
    }

    console.log("[generation.create] resolved config", {
      userId: callerId,
      dbUserId,
      pipelineTrace,
      userEmail: user?.email ?? null,
      openDebug,
      modelRequested: model ?? null,
      modelResolved: modelConfig.id,
      creditsNeeded,
      creditsCharged,
      guestMode,
      usedGuestOwner,
      aspectRatio: ar,
      imageSize: sz,
      photos: photoStoragePaths.length,
      promptLength: promptText.length,
      promptPreview,
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
      photos: photoStoragePaths.length,
      promptLength: promptText.length,
      promptPreview,
    });

    if (!openDebug && !guestMode && creditsCharged > 0) {
      const { data: userRow } = await supabase
        .from("landing_users")
        .select("credits")
        .eq("id", dbUserId)
        .maybeSingle();
      const availableCredits = Number(userRow?.credits || 0);
      if (availableCredits < creditsCharged) {
        console.warn("[generation.create] insufficient credits", {
          userId: callerId,
          dbUserId,
          availableCredits,
          creditsNeeded: creditsCharged,
        });
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

      const { data: deductResult, error: deductError } = await supabase.rpc(
        "landing_deduct_credits",
        { p_user_id: dbUserId, p_amount: creditsCharged }
      );

      if (deductError || deductResult === -1) {
        console.warn("[generation.create] credit deduction failed", {
          userId: callerId,
          dbUserId,
          availableCredits,
          creditsNeeded: creditsCharged,
          deductError: deductError?.message ?? null,
          deductResult,
        });
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
    }

    const { data: gen, error: insertError } = await supabase
      .from("landing_generations")
      .insert({
        user_id: dbUserId,
        status: "pending",
        card_id: cardId || null,
        prompt_text: promptText,
        model: modelConfig.id,
        aspect_ratio: ar,
        image_size: sz,
        credits_spent: creditsCharged,
        input_photo_paths: photoStoragePaths,
        vibe_id: resolvedVibeId,
        client_source: GENERATION_CLIENT_SOURCE,
      })
      .select("id")
      .single();

    if (insertError || !gen) {
      if (!openDebug && !guestMode && creditsCharged > 0) {
        await supabase.rpc("landing_deduct_credits", {
          p_user_id: dbUserId,
          p_amount: -creditsCharged,
        });
      }
      console.error("[generation.create] insert error", {
        userId: callerId,
        dbUserId,
        usedGuestOwner,
        insertError: insertError?.message ?? null,
      });
      return NextResponse.json({ error: "Failed to create generation" }, { status: 500 });
    }

    console.log("[generation.create] generation row created", {
      generationId: gen.id,
      userId: callerId,
      dbUserId,
      usedGuestOwner,
      openDebug,
      pipelineTrace,
      clientSource: GENERATION_CLIENT_SOURCE,
      status: "pending",
    });
    stvLog("generation.row_created", {
      pipelineTrace,
      userId: callerId,
      dbUserId,
      usedGuestOwner,
      openDebug,
      generationId: gen.id,
      vibeId: resolvedVibeId,
      clientSource: GENERATION_CLIENT_SOURCE,
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
