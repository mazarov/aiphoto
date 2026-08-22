import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEGMENTS = new Set(["all_email", "paid"]);

type CampaignRow = {
  id: string;
  status: string;
  segment: string;
  subject: string;
  body_text: string;
  created_by_email: string;
  recipient_count: number;
  enqueued_count: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
};

function readText(value: unknown, max: number): string {
  return String(value || "").trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  const gate = await requireAnalyticsAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const supabase = createSupabaseServer();
  const [{ data: campaigns, error: campaignError }, { data: stats, error: statsError }] =
    await Promise.all([
      supabase
        .from("landing_mail_campaigns")
        .select(
          "id, status, segment, subject, body_text, created_by_email, recipient_count, enqueued_count, sent_count, skipped_count, failed_count, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.rpc("landing_mail_queue_stats"),
    ]);
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 502 });
  if (statsError) return NextResponse.json({ error: statsError.message }, { status: 502 });

  return NextResponse.json(
    { campaigns: (campaigns || []) as CampaignRow[], stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const gate = await requireAnalyticsAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = readText(body?.action, 16);
  const supabase = createSupabaseServer();

  if (action === "send") {
    const campaignId = readText(body?.campaignId, 64);
    if (!campaignId) return NextResponse.json({ error: "campaign_required" }, { status: 400 });
    const { data: campaign, error: lookupError } = await supabase
      .from("landing_mail_campaigns")
      .select("id, status")
      .eq("id", campaignId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 502 });
    if (!campaign) return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
    if (campaign.status !== "dry_run" && campaign.status !== "draft") {
      return NextResponse.json({ error: "campaign_not_enqueueable" }, { status: 409 });
    }
    const { data: enqueued, error } = await supabase.rpc("landing_mail_campaign_enqueue", {
      p_campaign_id: campaignId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, campaignId, enqueued: enqueued ?? 0 });
  }

  if (action !== "preview") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const segment = readText(body?.segment, 32);
  const subject = readText(body?.subject, 200);
  const bodyText = readText(body?.body_text, 20_000);
  if (!SEGMENTS.has(segment) || !subject || !bodyText) {
    return NextResponse.json({ error: "invalid_campaign" }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("landing_mail_campaigns")
    .insert({
      status: "dry_run",
      segment,
      subject,
      body_text: bodyText,
      created_by_email: gate.email,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || "insert_failed" }, { status: 502 });
  }

  const { data: preview, error: previewError } = await supabase.rpc(
    "landing_mail_campaign_preview",
    { p_segment: segment, p_limit: 5 },
  );
  if (previewError) return NextResponse.json({ error: previewError.message }, { status: 502 });
  const rows = (preview || []) as Array<{
    email: string;
    shared_user_id: string;
    display_name: string | null;
    recipient_count: number;
  }>;

  return NextResponse.json({
    campaignId: inserted.id,
    recipientCount: rows[0]?.recipient_count ?? 0,
    preview: rows.map((row) => ({
      email: row.email,
      displayName: row.display_name,
    })),
  });
}
