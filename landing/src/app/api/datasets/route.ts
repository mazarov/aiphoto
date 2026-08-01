import { NextRequest, NextResponse } from "next/server";
import { fetchDatasets } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const includeUnpublished = req.nextUrl.searchParams.get("includeUnpublished") === "1";
  const datasets = await fetchDatasets({ includeUnpublished });
  return NextResponse.json({ datasets });
}
