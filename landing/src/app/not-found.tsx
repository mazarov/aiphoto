import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";

export const metadata: Metadata = {
  title: "Страница не найдена — PromptShot",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <PageLayout>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center">
        <p className="text-6xl font-bold text-zinc-200">404</p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Страница не найдена</h1>
        <p className="mt-3 max-w-sm text-zinc-500">
          Такой страницы не существует. Возможно, ссылка устарела или была удалена.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          На главную
        </Link>
      </main>
    </PageLayout>
  );
}
