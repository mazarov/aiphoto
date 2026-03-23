import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";

/**
 * Debug-only: hard-delete a prompt_cards row. Child rows CASCADE in DB.
 * Files in Storage are not removed (same as other admin-style routes).
 * confirmSlug must match the row’s slug (weak guard against mistaken id).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cardId, confirmSlug } = body as {
    cardId?: string;
    confirmSlug?: string;
  };

  if (!cardId || !confirmSlug) {
    return NextResponse.json(
      { error: "Missing cardId or confirmSlug" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  const { data: row, error: fetchErr } = await supabase
    .from("prompt_cards")
    .select("id,slug")
    .eq("id", cardId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (row.slug !== confirmSlug) {
    return NextResponse.json(
      { error: "confirmSlug does not match this card" },
      { status: 403 }
    );
  }

  const slug = row.slug as string;

  await supabase.from("slug_redirects").delete().eq("old_slug", slug);
  await supabase.from("slug_redirects").delete().eq("new_slug", slug);

  const { error: delErr } = await supabase
    .from("prompt_cards")
    .delete()
    .eq("id", cardId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // Sitemap and card page use `revalidate = 3600`; drop cached routes immediately.
  revalidatePath("/sitemap.xml");
  revalidatePath(`/p/${slug}`);

  return NextResponse.json({ ok: true });
}
