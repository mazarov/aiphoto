import { PageLayout } from "@/components/PageLayout";
import { GenerationsContent } from "./GenerationsContent";
import { loadGenerationsFirstPageForUser } from "@/lib/list-user-generations";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Мои генерации — PromptShot",
  robots: { index: false, follow: false },
};

export default async function GenerationsPage() {
  const user = await getSupabaseUserFromServerCookies();
  const initialPage = user
    ? ((await loadGenerationsFirstPageForUser(user)) ?? undefined)
    : undefined;

  return (
    <PageLayout>
      <main className="w-full px-5 py-8">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900">Мои генерации</h1>
        <GenerationsContent initialPage={initialPage} />
      </main>
    </PageLayout>
  );
}
