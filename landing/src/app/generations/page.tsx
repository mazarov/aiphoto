import { PageLayout } from "@/components/PageLayout";
import { GenerationsContent } from "./GenerationsContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мои генерации — PromptShot",
  robots: { index: false, follow: false },
};

export default function GenerationsPage() {
  return (
    <PageLayout>
      <main className="w-full px-5 py-8">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900">Мои генерации</h1>
        <GenerationsContent />
      </main>
    </PageLayout>
  );
}
