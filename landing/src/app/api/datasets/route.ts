import { NextResponse } from "next/server";
import { fetchDatasets } from "@/lib/supabase";

export async function GET() {
  const datasets = await fetchDatasets();
  return NextResponse.json({ datasets });
}
