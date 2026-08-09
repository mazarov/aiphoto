import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  createFeatureVisitorId,
  FEATURE_VISITOR_COOKIE,
  FEATURE_VISITOR_COOKIE_MAX_AGE,
  isValidFeatureVisitorId,
  PROMPT_CARD_GENERATION_FEATURE,
  resolvePromptCardGenerationAccess,
} from "@/lib/feature-rollout";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { user } = await getSupabaseUserForApiRoute(request);
  const cookieVisitorId = request.cookies.get(FEATURE_VISITOR_COOKIE)?.value;
  const visitorId = isValidFeatureVisitorId(cookieVisitorId)
    ? cookieVisitorId
    : createFeatureVisitorId();

  const decision = await resolvePromptCardGenerationAccess({
    user,
    visitorId,
  });
  const response = NextResponse.json({
    featureKey: PROMPT_CARD_GENERATION_FEATURE,
    enabled: decision.enabled,
    variant: decision.variant,
    bucketBand: decision.bucketBand,
  });
  response.headers.set("Cache-Control", "private, no-store");

  if (visitorId !== cookieVisitorId) {
    response.cookies.set(FEATURE_VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FEATURE_VISITOR_COOKIE_MAX_AGE,
    });
  }

  return response;
}
