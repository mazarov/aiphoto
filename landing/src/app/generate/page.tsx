import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { GeneratePageClient } from "@/components/generate/GeneratePageClient";
import {
  FEATURE_VISITOR_COOKIE,
  resolvePromptCardGenerationAccess,
} from "@/lib/feature-rollout";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const metadata: Metadata = {
  title: "Генерация фото — PromptShot",
  description: "Создайте фото по текстовому промпту в PromptShot.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/generate` },
};

export default async function GeneratePage() {
  const viewer = await getSupabaseUserFromServerCookies();
  const cookieStore = await cookies();
  const rollout = await resolvePromptCardGenerationAccess({
    user: viewer,
    visitorId: cookieStore.get(FEATURE_VISITOR_COOKIE)?.value,
  });
  if (!rollout.enabled) redirect("/");

  return (
    <PageLayout>
      <GeneratePageClient />
    </PageLayout>
  );
}
