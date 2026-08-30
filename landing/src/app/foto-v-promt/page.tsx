import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { FotoVPromtFaq } from "@/components/foto-v-promt/FotoVPromtFaq";
import { FotoVPromtHowItWorks } from "@/components/foto-v-promt/FotoVPromtHowItWorks";
import { PromptSceneLiteWidgetGate } from "@/components/foto-v-promt/PromptSceneLiteWidgetGate";
import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";
import { getAiImageDescriberChromeUrl } from "@/lib/foto-v-promt-config";
import {
  FOTO_V_PROMT_FAQ,
  FOTO_V_PROMT_HERO,
  FOTO_V_PROMT_META,
  FOTO_V_PROMT_WIDGET,
} from "@/lib/foto-v-promt-copy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
const PAGE_URL = `${SITE_URL}/foto-v-promt`;

export const metadata: Metadata = {
  title: FOTO_V_PROMT_META.title,
  description: FOTO_V_PROMT_META.description,
  robots: { index: true, follow: true },
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: FOTO_V_PROMT_META.title,
    description: FOTO_V_PROMT_META.description,
    url: PAGE_URL,
    type: "website",
    locale: "ru_RU",
  },
};

export default function FotoVPromtPage() {
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: FOTO_V_PROMT_META.jsonLdName,
    description: FOTO_V_PROMT_META.description,
    url: PAGE_URL,
    applicationCategory: "BrowserApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    downloadUrl: getAiImageDescriberChromeUrl("foto_v_promt_json_ld"),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FOTO_V_PROMT_FAQ.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <PageLayout showFooterWithGenerateDock>
      <main className="listing-main-bottom-pad w-full flex-1 pb-16 sm:pb-24">
        <section className="relative scroll-mt-20 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_-20%,rgba(99,102,241,0.14),transparent_62%)]"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-7xl px-3 pb-0 pt-8 text-center sm:px-5 sm:pt-12 xl:px-6">
            <nav
              aria-label="Хлебные крошки"
              className="mb-5 flex items-center justify-center gap-1.5 text-sm text-zinc-400"
            >
              <Link href="/" className="transition-colors hover:text-zinc-700">
                Главная
              </Link>
              <svg
                className="h-3.5 w-3.5 shrink-0 text-zinc-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="font-medium text-zinc-700">
                {FOTO_V_PROMT_HERO.title}
              </span>
            </nav>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {FOTO_V_PROMT_HERO.title}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
              {FOTO_V_PROMT_HERO.subtitle}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-500">
              {FOTO_V_PROMT_HERO.generateLead}{" "}
              <Link
                href={FOTO_V_PROMT_HERO.generateHref}
                className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                {FOTO_V_PROMT_HERO.generateLinkLabel}
              </Link>
            </p>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-3 pt-10 sm:gap-12 sm:px-5 sm:pt-12 lg:gap-16 lg:pt-16 xl:px-6">
          <section
            id="foto-v-promt-widget"
            className="scroll-mt-20"
            aria-label={FOTO_V_PROMT_WIDGET.ariaLabel}
          >
            <div className={GF_BLOCK}>
              <p className={GF_EYEBROW}>онлайн</p>
              <h2 className={`mt-2 ${GF_H2}`}>{FOTO_V_PROMT_WIDGET.title}</h2>
              <p className={GF_LEAD}>{FOTO_V_PROMT_WIDGET.subtitle}</p>
              <div className={`${GF_STACK} mx-auto w-full max-w-3xl`}>
                <PromptSceneLiteWidgetGate />
              </div>
            </div>
          </section>

          <FotoVPromtHowItWorks />
          <FotoVPromtFaq />
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
    </PageLayout>
  );
}
