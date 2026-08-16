import { PageLayout } from "@/components/PageLayout";
import { AnalysesContent } from "./AnalysesContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мои анализы — PromptShot",
  robots: { index: false, follow: false },
};

export default function AnalysesPage() {
  return (
    <PageLayout>
      <main className="w-full px-5 py-8">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900">Мои анализы</h1>
        <AnalysesContent />
      </main>
    </PageLayout>
  );
}
