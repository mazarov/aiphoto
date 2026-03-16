import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get("cardId");
  if (!cardId) {
    return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from("prompt_variants")
      .select("prompt_text_en,prompt_text_ru")
      .eq("card_id", cardId)
      .order("variant_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    const row = data as {
      prompt_text_en: string | null;
      prompt_text_ru: string | null;
    } | null;
    const promptEn = row?.prompt_text_en?.trim() || row?.prompt_text_ru?.trim() || null;

    return NextResponse.json({ promptEn });
  } catch (err) {
    console.error("generation-prompt error:", err);
    return NextResponse.json({ error: "prompt fetch failed" }, { status: 500 });
  }
}
