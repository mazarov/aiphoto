import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isStvGuestUser, STV_GUEST_VIRTUAL_CREDITS } from "@/lib/stv-guest-mode";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { parseLiveMailOffer } from "@/lib/mail-checkout-offer";

export async function GET(request: NextRequest) {
  try {
    const {
      user,
      error: authError,
    } = await getSupabaseUserForApiRoute(request);

    if (authError || !user) {
      return NextResponse.json({ user: null, credits: 0, offer: null });
    }

    const supabase = createSupabaseServer();
    const guestMode = isStvGuestUser(user);

    let credits = 0;
    let offer: { percent: number; expiresAt: string } | null = null;
    if (guestMode) {
      credits = STV_GUEST_VIRTUAL_CREDITS;
    } else {
      const resolved = await resolveSharedDbUserId(supabase, user);
      const profileId = resolved?.dbUserId ?? user.id;
      const { data: profile } = await supabase
        .from("landing_users")
        .select("credits")
        .eq("id", profileId)
        .maybeSingle();
      credits = (profile as { credits?: number } | null)?.credits ?? 0;
      const { data: offerRow } = await supabase.rpc("landing_live_pricing_offer", {
        p_shared_user_id: profileId,
      });
      offer = parseLiveMailOffer(offerRow);
    }

    let publishRewardRemainingToday = 0;
    if (!guestMode) {
      const { data: remaining } = await supabase.rpc(
        "landing_publish_reward_remaining",
        { p_auth_user_id: user.id },
      );
      const parsed = Number(remaining);
      publishRewardRemainingToday = Number.isFinite(parsed)
        ? Math.max(0, parsed)
        : 0;
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, isAnonymous: user.is_anonymous === true },
      credits,
      guestMode,
      offer,
      publishRewardRemainingToday,
    });
  } catch (err) {
    console.error("me error:", err);
    return NextResponse.json({ user: null, credits: 0, offer: null });
  }
}
