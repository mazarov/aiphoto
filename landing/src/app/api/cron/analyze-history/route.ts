import { NextRequest, NextResponse } from "next/server";
import {
  cleanupExpiredAnalyzeHistory,
  parseAnalyzeHistoryCleanupLimit,
} from "@/lib/analyze-history";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServer();
    const limit = parseAnalyzeHistoryCleanupLimit(request.nextUrl.searchParams.get("limit"));
    const result = await cleanupExpiredAnalyzeHistory(supabase, { limit });
    console.info("[analyze.history] cron", result);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[analyze.history] cron failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "analyze_history_cleanup_failed" }, { status: 502 });
  }
}
