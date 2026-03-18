import { NextRequest, NextResponse } from "next/server";
import { getFilterCounts } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: Record<string, string | null> = {};
  for (const key of ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"]) {
    params[key] = sp.get(key) || null;
  }
  const siteLang = sp.get("site_lang") || "ru";

  try {
    const rows = await getFilterCounts({ ...params, site_lang: siteLang });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("filter-counts error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
