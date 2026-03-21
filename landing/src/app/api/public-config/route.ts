import { NextResponse } from "next/server";

/**
 * Public values for Chrome extension (anon key is already public in the browser on the site).
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  return NextResponse.json({
    supabaseUrl,
    supabaseAnonKey,
  });
}
