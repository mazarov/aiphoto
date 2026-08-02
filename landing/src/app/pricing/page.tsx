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
  description: "Выберите пакет токенов PromptShot для генерации фото и видео.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Тарифы и токены — PromptShot",
    description: "Пакеты токенов PromptShot для генерации фото и видео.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

export default async function PricingPage() {
  const viewer = await getSupabaseUserFromServerCookies();
  if (!canAccessPricingPreview(viewer?.email)) notFound();

  return (
    <PageLayout>
      <main className="relative flex-1 overflow-hidden bg-[#09090b] text-white">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,rgba(99,102,241,0.24),transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <header className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-300">
              Тарифы PromptShot
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Создавайте больше с токенами
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Выберите подходящий пакет токенов для ваших творческих задач.
            </p>
          </header>

          <section className="mt-10 sm:mt-12" aria-label="Пакеты токенов">
            <PricingCards />
          </section>

          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-zinc-600">
            Нажимая «Выбрать тариф», вы соглашаетесь с{" "}
            <Link href="/terms" className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">
              условиями оферты
            </Link>{" "}
            и{" "}
            <Link href="/policy" className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline">
              политикой обработки данных
            </Link>
            .
          </p>
          <p className="mt-5 text-center text-xs leading-relaxed text-zinc-600">
            СМЗ Азарова Мария Петровна
            <br />
            ИНН 673201018413
          </p>
        </div>
      </main>
    </PageLayout>
  );
}
