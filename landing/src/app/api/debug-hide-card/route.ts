import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";
import { parseDebugHideCardRequest } from "@/lib/debug-hide-card";

/**
 * Catalog-admin only: flip prompt_cards.is_published.
 * Hide removes the card from public listings (RPC, search, sitemap) without deleting the row.
 * Restore sets the flag back and does not run the owner publish service or grant a reward.
 * confirmSlug must match the row’s slug.
 */
export async function POST(req: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(req);
  if (authError || !user || !isCatalogAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Missing cardId or confirmSlug" }, { status: 400 });
  }

  const parsed = parseDebugHideCardRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { cardId, confirmSlug, published } = parsed.value;

  const supabase = createSupabaseServer();
  const { data: row, error: fetchErr } = await supabase
    .from("prompt_cards")
    .select("id,slug,is_published")
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
      { status: 403 },
    );
  }

  const slug = row.slug as string;
  const already = Boolean(row.is_published) === published;
  if (!already) {
    const { error: upErr } = await supabase
      .from("prompt_cards")
      .update({
        is_published: published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId);

    if (upErr) {
      console.error("[debug-hide-card] update failed", {
        cardId,
        slug,
        published,
        message: upErr.message,
      });
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  revalidatePath(`/p/${slug}`);
  revalidatePath("/sitemap.xml");
  // Listings are ISR 3600s and filter is_published in SQL. Layout marks every
  // page stale so the next visit rebuilds without this card, instead of waiting out the hour.
  revalidatePath("/", "layout");

  console.log("[debug-hide-card]", {
    userId: user.id,
    cardId,
    slug,
    isPublished: published,
    already,
  });

  return NextResponse.json({ ok: true, is_published: published });
}
