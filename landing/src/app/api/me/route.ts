import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isStvGuestUser, STV_GUEST_VIRTUAL_CREDITS } from "@/lib/stv-guest-mode";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import {
  FEATURE_VISITOR_COOKIE,
  resolvePromptCardGenerationAccess,
} from "@/lib/feature-rollout";

export async function GET(request: NextRequest) {
  try {
    const {
      user,
      error: authError,
    } = await getSupabaseUserForApiRoute(request);
    const rollout = await resolvePromptCardGenerationAccess({
      user,
      visitorId: request.cookies.get(FEATURE_VISITOR_COOKIE)?.value,
    });
    const featureAccess = {
      promptCardGeneration: rollout.enabled,
      variant: rollout.variant,
    };

    if (authError || !user) {
      return NextResponse.json({ user: null, credits: 0, featureAccess });
    }

    const supabase = createSupabaseServer();
    const guestMode = isStvGuestUser(user);

    let credits = 0;
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
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, isAnonymous: user.is_anonymous === true },
      credits,
      guestMode,
      featureAccess,
    });
  } catch (err) {
    console.error("me error:", err);
    return NextResponse.json({ user: null, credits: 0 });
  }
}
