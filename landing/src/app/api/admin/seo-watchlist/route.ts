import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics-admin";
import type { SeoWatchlistSnapshot } from "@/lib/seo-watchlist";
import { emptySnapshot } from "@/lib/seo-watchlist";

export const dynamic = "force-dynamic";

function loadSnapshot(): SeoWatchlistSnapshot {
  const path = join(process.cwd(), "src/data/seo-watchlist-snapshot.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SeoWatchlistSnapshot;
  } catch {
    return emptySnapshot();
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAnalyticsAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  return NextResponse.json(loadSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
