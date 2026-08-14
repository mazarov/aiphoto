import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { GeneratePageClient } from "@/components/generate/GeneratePageClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const metadata: Metadata = {
  title: "Генерация фото — PromptShot",
  description: "Создайте фото по текстовому промпту в PromptShot.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/generate` },
};

export default function GeneratePage() {
  return (
    <PageLayout>
      <GeneratePageClient />
    </PageLayout>
  );
}
