import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";

const MAX_SLUG_LEN = 280;

function normalizeViewCount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

/**
 * Records one card page view (client beacon after hydration).
 * Idempotency: browser should dedupe with sessionStorage (see useCardViewBeacon).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const raw = (body as { slug?: unknown }).slug;
  const slug =
    typeof raw === "string" ? raw.trim().slice(0, MAX_SLUG_LEN) : "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "bad_slug" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase.rpc("increment_prompt_card_view", {
      p_slug: slug,
    });

    if (error) {
      console.error("[card-view] rpc error", error.message);
      return NextResponse.json({ ok: false, error: "rpc_failed" }, { status: 503 });
    }

    const viewCount = normalizeViewCount(data);
    if (viewCount == null) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, viewCount });
  } catch (e) {
    console.error("[card-view]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 503 });
  }
}
