import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { loadGenerateBootstrapPayload } from "@/lib/generate-bootstrap-server";

export async function GET(req: NextRequest) {
  try {
    const includeLastResult =
      req.nextUrl.searchParams.get("includeLastResult") === "1";
    const supabase = createSupabaseServer();
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    const payload = await loadGenerateBootstrapPayload({
      supabase,
      user: authError ? null : user,
      includeLastResult,
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("generate-bootstrap error:", err);
    return NextResponse.json({ error: "bootstrap_failed" }, { status: 500 });
  }
}
