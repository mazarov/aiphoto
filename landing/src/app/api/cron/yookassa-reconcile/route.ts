import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { flushUnsentYandexPurchaseConversions } from "@/lib/yandex-metrika-measurement";
import { reconcileStaleYooKassaPayments } from "@/lib/yookassa-payments";

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
    const summary = await reconcileStaleYooKassaPayments(supabase);
    let conversions = { scanned: 0, reported: 0, skipped: 0 };
    try {
      conversions = await flushUnsentYandexPurchaseConversions(supabase);
    } catch (flushError) {
      console.error("[metrika] unsent flush failed", {
        message:
          flushError instanceof Error ? flushError.message : String(flushError),
      });
    }
    return NextResponse.json(
      { ...summary, conversions },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[yookassa] cron stale_reconcile failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "reconcile_failed" },
      { status: 502 },
    );
  }
}
