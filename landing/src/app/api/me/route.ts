import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isStvGuestUser, STV_GUEST_VIRTUAL_CREDITS } from "@/lib/stv-guest-mode";

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

    const guestMode = isStvGuestUser(user);
    const credits = guestMode
      ? STV_GUEST_VIRTUAL_CREDITS
      : ((profile as { credits?: number } | null)?.credits ?? 0);

    return NextResponse.json({
      user: { id: user.id, email: user.email, isAnonymous: user.is_anonymous === true },
      credits,
      guestMode,
    });
  } catch (err) {
    console.error("me error:", err);
    return NextResponse.json({ user: null, credits: 0 });
  }
}
