import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { PageLayout } from "@/components/PageLayout";
import { PricingCards } from "@/components/pricing/PricingCards";
import { getSupabaseUserFromServerCookies } from "@/lib/supabase-route-auth";
import {
  FEATURE_VISITOR_COOKIE,
  resolvePromptCardGenerationAccess,
} from "@/lib/feature-rollout";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

type PricingPageProps = {
  searchParams?: Promise<{
    test?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Тарифы и токены — PromptShot",
  description: "Пакеты токенов PromptShot: разовая покупка, токены без срока действия и более выгодная цена за фото в больших пакетах.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Тарифы и токены — PromptShot",
    description: "Покупайте токены один раз и создавайте фото в своём темпе.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const params = await searchParams;
  const testParam = Array.isArray(params?.test) ? params.test[0] : params?.test;
  const hasTestAccess = testParam === "true";
  const viewer = await getSupabaseUserFromServerCookies();
  const cookieStore = await cookies();
  const rollout = await resolvePromptCardGenerationAccess({
    user: viewer,
    visitorId: cookieStore.get(FEATURE_VISITOR_COOKIE)?.value,
  });
  if (!hasTestAccess && !rollout.enabled) notFound();

  return (
    <PageLayout>
      <main className="relative isolate flex min-h-[calc(100vh-57px)] flex-1 flex-col bg-white max-lg:h-[calc(100dvh-var(--ps-header-height,57px)-3.5rem-env(safe-area-inset-bottom,0px))] max-lg:min-h-0 max-lg:overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(ellipse_68%_66%_at_50%_0%,rgba(99,102,241,0.11),rgba(139,92,246,0.035)_44%,transparent_76%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-[6%] top-0 -z-10 h-[340px] opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(99,102,241,0.12)_1px,transparent_0)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-7xl flex-col px-3 py-2 max-lg:h-full max-lg:min-h-0 sm:px-6 sm:py-5 lg:px-8 lg:py-14">
          <div className="max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:justify-center">
            <header className="mx-auto max-w-2xl text-center">
              <h1 className="text-xl font-bold tracking-[-0.035em] text-zinc-950 sm:text-3xl lg:text-[44px] lg:leading-tight">
                Выберите пакет
              </h1>
              <p className="mx-auto mt-3 hidden max-w-xl text-sm leading-relaxed text-zinc-500 lg:block lg:text-base">
                Покупаете один раз. Токены остаются на балансе без срока действия.
              </p>
              <div className="mt-5 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-zinc-600 lg:flex lg:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Разовая покупка
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Токены не сгорают
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Оплата появится скоро
                </span>
              </div>
            </header>

            <section
              className="mx-auto mt-2 flex h-[27rem] max-h-[calc(100%_-_2rem)] min-h-0 w-full max-w-6xl flex-none rounded-[22px] border border-zinc-100/90 bg-white/75 p-1.5 shadow-[0_24px_80px_-40px_rgba(79,70,229,0.22)] backdrop-blur-xl sm:mt-4 sm:p-3 lg:mt-10 lg:block lg:h-auto lg:max-h-none lg:rounded-[28px] xl:p-5"
              aria-label="Пакеты токенов"
            >
              <PricingCards rolloutVariant={rollout.variant} />
            </section>
          </div>

          <footer className="mt-auto shrink-0 space-y-0.5 px-2 pt-2 text-center lg:space-y-2 lg:pt-10">
            <p className="max-w-full break-words text-xs leading-snug text-zinc-400">
              Покупая пакет, вы принимаете условия{" "}
              <Link href="/terms" className="text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline">
                оферты
              </Link>{" "}
              и{" "}
              <Link href="/policy" className="text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline">
                политики обработки данных
              </Link>
              .
            </p>
            <p className="max-w-full break-words text-xs leading-snug text-zinc-400">
              <span className="block sm:inline">СМЗ Азарова Мария Петровна</span>
              <span className="hidden sm:inline"> · </span>
              <span className="block sm:inline">ИНН 673201018413</span>
            </p>
          </footer>
        </div>
      </main>
    </PageLayout>
  );
}
