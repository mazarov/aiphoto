import type { Metadata } from "next";
import Script from "next/script";
import { PageLayout } from "@/components/PageLayout";
import { FotoVPromtFaq } from "@/components/foto-v-promt/FotoVPromtFaq";
import { FotoVPromtFloatingCta } from "@/components/foto-v-promt/FotoVPromtFloatingCta";
import { FotoVPromtHowItWorks } from "@/components/foto-v-promt/FotoVPromtHowItWorks";
import { PromptSceneLiteWidgetGate } from "@/components/foto-v-promt/PromptSceneLiteWidgetGate";
import { getAiImageDescriberChromeUrl } from "@/lib/foto-v-promt-config";
import {
  FOTO_V_PROMT_FAQ,
  FOTO_V_PROMT_HERO,
  FOTO_V_PROMT_META,
  FOTO_V_PROMT_WIDGET,
} from "@/lib/foto-v-promt-copy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
const PAGE_URL = `${SITE_URL}/foto-v-promt/`;

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
    downloadUrl: getAiImageDescriberChromeUrl(),
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
    <PageLayout hideBottomBar>
      <div className="listing-main-bottom-pad pb-32">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-25%,rgba(99,102,241,0.12),transparent_55%)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-8 text-center sm:px-6 sm:pb-8 sm:pt-10">
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              {FOTO_V_PROMT_HERO.title}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base text-zinc-600 sm:text-lg">
              {FOTO_V_PROMT_HERO.subtitle}
            </p>
          </div>
        </section>

        <section
          id="foto-v-promt-widget"
          className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
          aria-label={FOTO_V_PROMT_WIDGET.ariaLabel}
        >
          <h2 className="mb-6 text-center text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
            {FOTO_V_PROMT_WIDGET.title}
          </h2>
          <PromptSceneLiteWidgetGate />
        </section>

        <FotoVPromtHowItWorks />
        <FotoVPromtFaq />
        <FotoVPromtFloatingCta />
      </div>

      <Script
        id="foto-v-promt-webapp-json-ld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd).replace(/</g, "\\u003c") }}
      />
      <Script
        id="foto-v-promt-faq-json-ld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
    </PageLayout>
  );
}
