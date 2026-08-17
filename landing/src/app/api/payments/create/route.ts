import { type NextRequest, NextResponse } from "next/server";
import { getPaymentProviderForEmail } from "@/lib/payment-provider";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";

export async function POST(request: NextRequest) {
  const { user } = await getSupabaseUserForApiRoute(request);
  const provider = getPaymentProviderForEmail(user?.email);
  return new NextResponse(null, {
    status: 307,
    headers: { Location: `/api/payments/${provider}/create` },
  });
}
