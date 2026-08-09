import type { NextRequest } from "next/server";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import {
  isAnalyticsAdminEmail,
  parseAnalyticsAdminEmails,
} from "@/lib/analytics-admin-core";

export function getAnalyticsAdminEmails(): string[] {
  return parseAnalyticsAdminEmails(process.env.ANALYTICS_ADMIN_EMAILS);
}

export async function requireAnalyticsAdmin(request: NextRequest): Promise<
  | { ok: true; email: string; userId: string; user: NonNullable<Awaited<ReturnType<typeof getSupabaseUserForApiRoute>>["user"]> }
  | { ok: false; status: 401 | 403; error: string }
> {
  const { user, error } = await getSupabaseUserForApiRoute(request);
  if (error || !user) return { ok: false, status: 401, error: "unauthorized" };

  const allowlist = getAnalyticsAdminEmails();
  if (allowlist.length === 0) {
    return { ok: false, status: 403, error: "analytics_admin_not_configured" };
  }
  const email = (user.email || "").trim().toLowerCase();
  if (!isAnalyticsAdminEmail(email, allowlist)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, email, userId: user.id, user };
}
