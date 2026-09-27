import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = await params;
  if (!USER_ID.test(id)) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
  if (!body || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("landing_users")
    .update({
      publish_hidden: body.hidden,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, publish_hidden")
    .maybeSingle();

  if (error) {
    console.error("[admin.publish-hidden] update_failed", {
      adminEmail: gate.email,
      userId: id,
      message: error.message,
    });
    return NextResponse.json({ error: "publish_hidden_update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  console.info("[admin.publish-hidden] updated", {
    adminEmail: gate.email,
    userId: id,
    publishHidden: data.publish_hidden === true,
  });

  return NextResponse.json({
    ok: true,
    userId: data.id,
    publishHidden: data.publish_hidden === true,
  });
}
