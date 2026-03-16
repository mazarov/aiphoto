import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { createSupabaseServerAuth } from "@/lib/supabase-server-auth";

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseServerAuth();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      prompt,
      model,
      aspectRatio,
      imageSize,
      cardId,
      photoStoragePaths,
    } = body as {
      prompt?: string;
      model?: string;
      aspectRatio?: string;
      imageSize?: string;
      cardId?: string | null;
      photoStoragePaths?: string[];
    };

    const minPromptLength = 8;
    const validAspectRatios = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];
    const validImageSizes = ["1K", "2K", "4K"];

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < minPromptLength) {
      return NextResponse.json(
        { error: "validation_error", message: "Промпт должен быть минимум 8 символов" },
        { status: 400 }
      );
    }

    if (!photoStoragePaths || !Array.isArray(photoStoragePaths) || photoStoragePaths.length < 1) {
      return NextResponse.json(
        { error: "validation_error", message: "Нужно минимум 1 фото" },
        { status: 400 }
      );
    }

    if (photoStoragePaths.length > 4) {
      return NextResponse.json(
        { error: "validation_error", message: "Максимум 4 фото" },
        { status: 400 }
      );
    }

    const ar = aspectRatio || "1:1";
    const sz = imageSize || "1K";
    if (!validAspectRatios.includes(ar)) {
      return NextResponse.json(
        { error: "validation_error", message: "Недопустимый формат" },
        { status: 400 }
      );
    }
    if (!validImageSizes.includes(sz)) {
      return NextResponse.json(
        { error: "validation_error", message: "Недопустимое качество" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();

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

    const { data: userRow } = await supabase
      .from("landing_users")
      .select("credits")
      .eq("id", user.id)
      .single();

    const availableCredits = (userRow as { credits?: number } | null)?.credits ?? 0;
    if (availableCredits < creditsNeeded) {
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
        prompt_text: prompt.trim(),
        model: modelConfig.id,
        aspect_ratio: ar,
        image_size: sz,
        credits_spent: creditsNeeded,
        input_photo_paths: photoStoragePaths,
      })
      .select("id")
      .single();

    if (insertError || !gen) {
      await supabase.rpc("landing_deduct_credits", {
        p_user_id: user.id,
        p_amount: -creditsNeeded,
      });
      console.error("generate insert error:", insertError);
      return NextResponse.json({ error: "Failed to create generation" }, { status: 500 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      req.headers.get("origin") ||
      req.nextUrl.origin;
    fetch(`${baseUrl}/api/generate-process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: gen.id }),
    }).catch((err) => console.error("generate-process kickoff error:", err));

    return NextResponse.json({ id: gen.id });
  } catch (err) {
    console.error("generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
