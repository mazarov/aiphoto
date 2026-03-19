import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { createSupabaseServerAuth } from "@/lib/supabase-server-auth";

const ALLOWED_ACCENTS = ["lighting", "mood", "composition"] as const;
type PromptAccent = (typeof ALLOWED_ACCENTS)[number];

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

function toCardUrl(slug: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/p/${slug}`;
}

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

    const body = (await req.json()) as {
      vibeId?: string | null;
      generationId?: string;
      prompt?: string;
      accent?: string;
    };

    const generationId = String(body.generationId || "").trim();
    const prompt = String(body.prompt || "").trim();
    const accent = String(body.accent || "").trim() as PromptAccent;
    const vibeId = body.vibeId ? String(body.vibeId).trim() : null;

    if (!generationId || !prompt || prompt.length < 8 || !ALLOWED_ACCENTS.includes(accent)) {
      return NextResponse.json(
        { error: "validation_error", message: "Некорректные параметры сохранения" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServer();

    const { data: generation, error: generationError } = await supabase
      .from("landing_generations")
      .select("id,user_id,status,card_id,vibe_id")
      .eq("id", generationId)
      .single();

    if (generationError || !generation || generation.user_id !== user.id) {
      return NextResponse.json(
        { error: "not_found", message: "Генерация не найдена" },
        { status: 404 },
      );
    }

    if (generation.status !== "completed") {
      return NextResponse.json(
        { error: "validation_error", message: "Можно сохранить только завершенную генерацию" },
        { status: 400 },
      );
    }

    let resolvedVibeId: string | null = generation.vibe_id || null;
    if (vibeId) {
      const { data: vibeRow, error: vibeError } = await supabase
        .from("vibes")
        .select("id,user_id")
        .eq("id", vibeId)
        .single();

      if (vibeError || !vibeRow || vibeRow.user_id !== user.id) {
        return NextResponse.json(
          { error: "validation_error", message: "Недопустимый vibeId" },
          { status: 400 },
        );
      }
      resolvedVibeId = vibeRow.id;

      if (generation.vibe_id !== resolvedVibeId) {
        await supabase
          .from("landing_generations")
          .update({ vibe_id: resolvedVibeId, updated_at: new Date().toISOString() })
          .eq("id", generation.id);
      }
    }

    const savePayload = {
      user_id: user.id,
      vibe_id: resolvedVibeId,
      generation_id: generation.id,
      prompt_text: prompt,
      accent,
      card_id: generation.card_id || null,
    };

    const { data: saveRow, error: saveError } = await supabase
      .from("landing_vibe_saves")
      .upsert(savePayload, { onConflict: "generation_id" })
      .select("id,card_id")
      .single();

    if (saveError || !saveRow) {
      console.error("[vibe.save] upsert failed", {
        userId: user.id,
        generationId: generation.id,
        error: saveError?.message ?? null,
      });
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }

    let cardId: string | null = saveRow.card_id || null;
    let cardUrl: string | null = null;

    if (cardId) {
      const { data: cardRow } = await supabase
        .from("prompt_cards")
        .select("id,slug")
        .eq("id", cardId)
        .maybeSingle();
      if (cardRow?.slug) {
        cardId = cardRow.id;
        cardUrl = toCardUrl(cardRow.slug);
      }
    }

    return NextResponse.json({
      saveId: saveRow.id,
      generationId: generation.id,
      vibeId: resolvedVibeId,
      cardId,
      cardUrl,
    });
  } catch (err) {
    console.error("[vibe.save] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
