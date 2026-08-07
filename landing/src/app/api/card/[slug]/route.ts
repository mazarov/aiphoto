import { type NextRequest, NextResponse } from "next/server";
import { fetchCardPageDataCore, createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { DEBUG_TOOLS_COOKIE } from "@/lib/debug-tools-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const { user } = await getSupabaseUserForApiRoute(request);
    const allowDebugUnpublished = request.cookies.get(DEBUG_TOOLS_COOKIE)?.value === "1";

    const supabase = createSupabaseServer();
    const viewerUserId = user?.id ?? null;
    const data = await fetchCardPageDataCore(
      supabase,
      slug,
      viewerUserId,
      allowDebugUnpublished,
    );

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[/api/card/[slug]] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
