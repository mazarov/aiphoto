import { NextRequest, NextResponse } from "next/server";
import { verifyMailUnsubscribeToken } from "@/lib/mail-unsubscribe";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function unsubscribeFromRequest(request: NextRequest): Promise<string | null> {
  const fromQuery = request.nextUrl.searchParams.get("t");
  if (fromQuery) return fromQuery;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("text/plain")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    return params.get("t");
  }
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { t?: unknown } | null;
    return typeof body?.t === "string" ? body.t : null;
  }
  return null;
}

async function applyUnsubscribe(token: string | null): Promise<{ ok: true } | { error: string; status: number }> {
  const email = verifyMailUnsubscribeToken(token);
  if (!email) return { error: "invalid_token", status: 400 };
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc("landing_mail_unsubscribe", { p_email: email });
  if (error) return { error: "unsubscribe_failed", status: 502 };
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const result = await applyUnsubscribe(await unsubscribeFromRequest(request));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
