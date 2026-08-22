import { NextResponse } from "next/server";
import { authorizePostboxWebhook, parsePostboxEvents } from "@/lib/mail-events";
import { hashMailEmail } from "@/lib/mail-email";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizePostboxWebhook(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const events = parsePostboxEvents(payload);
  if (events.length === 0) {
    return NextResponse.json({ ok: true, suppressed: 0 });
  }

  const supabase = createSupabaseServer();
  let suppressed = 0;
  for (const event of events) {
    const { data, error } = await supabase.rpc("landing_mail_suppress", {
      p_email: event.email,
      p_reason: event.reason,
      p_source: event.source,
    });
    if (error) {
      console.error("[mail] suppress failed", {
        hash: hashMailEmail(event.email),
        reason: event.reason,
        message: error.message,
      });
      return NextResponse.json({ error: "suppress_failed" }, { status: 502 });
    }
    if (data === true) suppressed += 1;
  }

  return NextResponse.json({ ok: true, suppressed });
}
