import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function GET(request: NextRequest) {
  try {
    const {
      user,
      error: authError,
    } = await getSupabaseUserForApiRoute(request);

    if (authError || !user) {
      return NextResponse.json({ user: null, credits: 0 });
    }

    const supabase = createSupabaseServer();
    const { data: profile } = await supabase
      .from("landing_users")
      .select("credits")
      .eq("id", user.id)
      .single();

    const credits = (profile as { credits?: number } | null)?.credits ?? 0;

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      credits,
    });
  } catch (err) {
    console.error("me error:", err);
    return NextResponse.json({ user: null, credits: 0 });
  }
}
