import { NextRequest, NextResponse } from "next/server";
import { fetchDatasets } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isCatalogAdminEmail } from "@/lib/catalog-admin";

export async function GET(req: NextRequest) {
  let includeUnpublished = req.nextUrl.searchParams.get("includeUnpublished") === "1";
  if (includeUnpublished) {
    const { user } = await getSupabaseUserForApiRoute(req);
    if (!isCatalogAdminEmail(user?.email)) {
      includeUnpublished = false;
    }
  }
  const datasets = await fetchDatasets({ includeUnpublished });
  return NextResponse.json({ datasets });
}
