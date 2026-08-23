import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { reconcileYooKassaPayment } from "@/lib/yookassa-payments";

export const runtime = "nodejs";

type NotificationBody = {
  type?: unknown;
  event?: unknown;
  object?: {
    id?: unknown;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as NotificationBody | null;
    if (
      body?.type !== "notification" ||
      (body.event !== "payment.succeeded" && body.event !== "payment.canceled") ||
      typeof body.object?.id !== "string" ||
      body.object.id.length === 0
    ) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseServer();
    const result = await reconcileYooKassaPayment(supabase, body.object.id);
    console.info("[yookassa] notification reconciled", {
      paymentId: result.paymentId,
      event: body.event,
      status: result.status,
      credited: result.credited,
      source: "webhook",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[yookassa] notification failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    // YooKassa retries non-2xx responses for up to 24 hours.
    return NextResponse.json({ error: "reconciliation_failed" }, { status: 502 });
  }
}
