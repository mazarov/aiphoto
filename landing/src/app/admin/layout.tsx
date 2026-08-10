import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = {
  title: "Админ-панель — PromptShot",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PageLayout>
      <main className="min-w-0 flex-1 bg-zinc-50 px-4 py-6 sm:px-6 lg:px-8">
        <AdminNav />
        {children}
      </main>
    </PageLayout>
  );
}
