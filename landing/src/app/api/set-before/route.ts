import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cardId, storageBucket, storagePath } = body as {
    cardId: string;
    storageBucket: string;
    storagePath: string;
  };

  if (!cardId || !storageBucket || !storagePath) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  const { error } = await supabase
    .from("prompt_card_before_media")
    .upsert(
      {
        card_id: cardId,
        storage_bucket: storageBucket,
        storage_path: storagePath,
      },
      { onConflict: "card_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
