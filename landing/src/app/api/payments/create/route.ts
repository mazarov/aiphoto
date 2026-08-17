import { type NextRequest, NextResponse } from "next/server";
import { getPaymentProviderForEmail } from "@/lib/payment-provider";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function POST(request: NextRequest) {
  const { user } = await getSupabaseUserForApiRoute(request);
  const provider = getPaymentProviderForEmail(user?.email);
  return NextResponse.redirect(
    new URL(`/api/payments/${provider}/create`, request.url),
    307,
  );
}
