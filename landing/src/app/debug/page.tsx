import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { DebugPageContent } from "@/components/debug/DebugPageContent";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const metadata: Metadata = {
  title: "Debug — PromptShot",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/debug` },
};

export default function DebugPage() {
  return (
    <PageLayout>
      <main className="listing-main-bottom-pad w-full px-2 py-8 sm:px-5 lg:py-8">
        <DebugPageContent />
      </main>
    </PageLayout>
  );
}
