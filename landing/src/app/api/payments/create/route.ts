import { type NextRequest, NextResponse } from "next/server";
import { resolvePaymentProvider } from "@/lib/payment-provider";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function POST(request: NextRequest) {
  const { user } = await getSupabaseUserForApiRoute(request);
  const provider = await resolvePaymentProvider({
    supabase: createSupabaseServer(),
    authUserId: user?.id,
    email: user?.email,
  });
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `/api/payments/${provider}/create` },
  });
}
