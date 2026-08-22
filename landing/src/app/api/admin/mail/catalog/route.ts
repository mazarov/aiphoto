import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import { listMailCatalogPreviews } from "@/lib/mail-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireAnalyticsAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  return NextResponse.json(
    { templates: listMailCatalogPreviews() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
