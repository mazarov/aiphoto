import { NextRequest, NextResponse } from "next/server";
import {
  ANALYZE_QUOTA_MESSAGES,
  analyzeQuotaGetBody,
  resolveAnalyzeQuotaSnapshot,
} from "@/lib/analyze-quota";
import { createSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createSupabaseServer();
    const snapshot = await resolveAnalyzeQuotaSnapshot(req, supabase);
    return NextResponse.json(analyzeQuotaGetBody(snapshot), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.warn("[analyze.quota] snapshot failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "quota_unavailable",
        message: ANALYZE_QUOTA_MESSAGES.quota_unavailable,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
