import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { PricingCards } from "@/components/pricing/PricingCards";
import { canAccessPricingPreview } from "@/lib/pricing-preview-access";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const metadata: Metadata = {
  title: "Тарифы и токены — PromptShot",
  description: "Выберите пакет токенов PromptShot для генерации фото.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Тарифы и токены — PromptShot",
    description: "Пакеты токенов PromptShot для генерации фото.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

export default async function PricingPage() {
  const viewer = await getSupabaseUserFromServerCookies();
  if (!canAccessPricingPreview(viewer?.email)) notFound();

  return (
    <PageLayout>
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-indigo-50/50 via-white to-white">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(99,102,241,0.14),transparent_70%)]"
          aria-hidden
        />

        <div className="relative mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-3 py-3 sm:px-6 sm:py-10 lg:px-8 lg:py-14 max-lg:h-[calc(100dvh-var(--ps-header-height,57px)-3.5rem-env(safe-area-inset-bottom,0px))] max-lg:max-h-[calc(100dvh-var(--ps-header-height,57px)-3.5rem-env(safe-area-inset-bottom,0px))]">
          <header className="shrink-0 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 sm:text-sm">
              Тарифы
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 sm:mt-2 sm:text-3xl lg:text-4xl">
              Токены для генерации
            </h1>
            <p className="mx-auto mt-1 hidden max-w-xl text-sm text-zinc-500 sm:mt-3 sm:block sm:text-base">
              Выберите пакет. Токены расходуются на готовые генерации.
            </p>
          </header>

          <section
            className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-8 lg:mt-10"
            aria-label="Пакеты токенов"
          >
            <PricingCards />
          </section>

          <footer className="mt-2 shrink-0 space-y-1 text-center sm:mt-8 sm:space-y-2">
            <p className="text-xs leading-snug text-zinc-400">
              Выбирая тариф, вы принимаете{" "}
              <Link href="/terms" className="text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline">
                оферту
              </Link>{" "}
              и{" "}
              <Link href="/policy" className="text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline">
                политику данных
              </Link>
              .
            </p>
            <p className="text-xs leading-snug text-zinc-400">
              СМЗ Азарова Мария Петровна · ИНН 673201018413
            </p>
          </footer>
        </div>
      </main>
    </PageLayout>
  );
}
