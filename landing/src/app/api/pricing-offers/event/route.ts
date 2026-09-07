import { type NextRequest, NextResponse } from "next/server";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

const UI_EVENTS = new Set(["seen", "clicked", "dismissed"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getSupabaseUserForApiRoute(request);
  if (authError || !user || user.is_anonymous === true) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { offerId?: unknown; event?: unknown }
    | null;
  const offerId =
    typeof body?.offerId === "string" ? body.offerId.trim() : "";
  const event = typeof body?.event === "string" ? body.event.trim() : "";
  if (!UUID_PATTERN.test(offerId) || !UI_EVENTS.has(event)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const resolved = await resolveSharedDbUserId(supabase, user);
  if (!resolved?.dbUserId) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase.rpc(
    "landing_record_pricing_offer_event",
    {
      p_offer_id: offerId,
      p_shared_user_id: resolved.dbUserId,
      p_event: event,
    },
  );
  if (error) {
    console.warn("[pricing-offer] event failed", {
      event,
      message: error.message,
    });
    return NextResponse.json({ error: "event_store_failed" }, { status: 503 });
  }
  if (data !== true) {
    return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
