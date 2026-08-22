import { NextRequest, NextResponse } from "next/server";
import { processMailDue } from "@/lib/mail-due";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const claimLimit = Math.min(
      20,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 8),
    );
    const processed = await processMailDue({
      supabase,
      limit: claimLimit,
    });
    const { data: stats, error: statsError } = await supabase.rpc("landing_mail_queue_stats");
    if (statsError) throw new Error(statsError.message);
    return NextResponse.json(
      { ...processed, stats },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[mail] due cron failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "mail_due_failed" }, { status: 502 });
  }
}
