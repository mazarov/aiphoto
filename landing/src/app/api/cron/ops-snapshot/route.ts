import { NextRequest, NextResponse } from "next/server";
import { logProductSnapshot } from "@/lib/ops-snapshot";
import { createSupabaseServer } from "@/lib/supabase-server-client";

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
    const snapshot = await logProductSnapshot(createSupabaseServer());
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "snapshot_failed";
    console.error(
      JSON.stringify({
        event: "product_snapshot_failed",
        message: message.slice(0, 300),
      }),
    );
    return NextResponse.json(
      { error: "snapshot_failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
