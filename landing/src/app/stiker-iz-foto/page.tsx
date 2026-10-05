import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import {
  GeneraciyaFotoHowTo,
  GeneraciyaFotoMore,
  GeneraciyaFotoPricing,
} from "@/components/generate/GeneraciyaFotoLandingSections";
import { GeneraciyaFotoFaq } from "@/components/generate/GeneraciyaFotoFaq";
import {
  GF_BLOCK,
  GF_BRAND_CTA,
  GF_EYEBROW,
  GF_H2,
  GF_HERO_GRADIENT,
  GF_HERO_H1,
  GF_HERO_INNER,
  GF_HERO_LEAD,
  GF_HERO_SECTION,
  GF_LEAD,
  GF_PAGE_MAIN,
  GF_PAGE_STACK,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import { StickerHeroCta } from "@/components/sticker/StickerHeroCta";
import { buildGeneraciyaHubJsonLd, SITE_URL } from "@/lib/generaciya-hub-data";
import { STICKER_PATH, STICKER_STYLES } from "@/lib/sticker";
import { readStickerGenerationEnabled } from "@/lib/sticker-config";
import {
  STIKER_IZ_FOTO_FAQ,
  STIKER_IZ_FOTO_HOW_TO_STEPS,
  STIKER_IZ_FOTO_MORE_LINKS,
  STIKER_IZ_FOTO_SEO,
} from "@/lib/stiker-iz-foto-seo-copy";

export const revalidate = 3600;

const PAGE_URL = `${SITE_URL}${STICKER_PATH}`;

export async function generateMetadata(): Promise<Metadata> {
  const enabled = await readStickerGenerationEnabled();
  const title = STIKER_IZ_FOTO_SEO.metaTitle;
  return {
    title,
    description: STIKER_IZ_FOTO_SEO.metaDescription,
    // Flag off → page exists for testers but stays out of the index until the generator is live.
    robots: enabled
      ? {
          index: true,
          follow: true,
          "max-image-preview": "large" as const,
          "max-snippet": -1,
          "max-video-preview": -1,
        }
      : { index: false, follow: true },
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title,
      description: STIKER_IZ_FOTO_SEO.metaDescription,
      url: PAGE_URL,
      type: "website",
      siteName: "PromptShot",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary",
      title,
      description: STIKER_IZ_FOTO_SEO.metaDescription,
    },
  };
}

function StickerStylesSection() {
  return (
    <section id="stili" className="scroll-mt-20" aria-labelledby="styles-heading">
      <div className={GF_BLOCK}>
        <h2 id="styles-heading" className={GF_H2}>
          {STIKER_IZ_FOTO_SEO.stylesTitle}
        </h2>
        <p className={GF_LEAD}>{STIKER_IZ_FOTO_SEO.stylesLead}</p>
        <ul className={`${GF_STACK} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
          {STICKER_STYLES.map((style) => (
            <li key={style.id} className={`p-4 ${GF_SURFACE}`}>
              <p className={GF_EYEBROW}>{style.hint}</p>
              <h3 className="mt-1 text-base font-semibold text-zinc-900">{style.label}</h3>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-zinc-500">
          Нужно не наклейку, а полноценное фото в сцене?{" "}
          <Link href="/generaciya/po-foto" className="font-medium text-indigo-700 underline-offset-4 hover:underline">
            Генерация по своему фото
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

export default async function StikerIzFotoPage() {
  const enabled = await readStickerGenerationEnabled();
  const schemas = buildGeneraciyaHubJsonLd({
    pageUrl: PAGE_URL,
    name: `${STIKER_IZ_FOTO_SEO.h1} — PromptShot`,
    description: STIKER_IZ_FOTO_SEO.metaDescription,
    ogImage: null,
    breadcrumbs: [
      { name: "Главная", item: SITE_URL },
      { name: STIKER_IZ_FOTO_SEO.breadcrumb, item: PAGE_URL },
    ],
    howTo: {
      name: STIKER_IZ_FOTO_SEO.howToTitle,
      steps: STIKER_IZ_FOTO_HOW_TO_STEPS,
    },
    faq: STIKER_IZ_FOTO_FAQ,
  });

  return (
    <PageLayout showFooterWithGenerateDock>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ))}

      <main className={GF_PAGE_MAIN}>
        <section className={GF_HERO_SECTION}>
          <div className={GF_HERO_GRADIENT} aria-hidden />
          <div className={GF_HERO_INNER}>
            <nav
              aria-label="Хлебные крошки"
              className="mb-5 flex flex-wrap items-center justify-center gap-1.5 text-sm text-zinc-400"
            >
              <Link href="/" className="transition-colors hover:text-zinc-700">
                Главная
              </Link>
              <span aria-hidden>›</span>
              <span className="font-medium text-zinc-700">{STIKER_IZ_FOTO_SEO.breadcrumb}</span>
            </nav>
            <h1 className={GF_HERO_H1}>{STIKER_IZ_FOTO_SEO.h1}</h1>
            <p className={GF_HERO_LEAD}>{STIKER_IZ_FOTO_SEO.intro}</p>
          </div>
        </section>

        <div className={GF_PAGE_STACK}>
          <section id="generator" className={`scroll-mt-20 ${GF_BLOCK}`} aria-labelledby="studio-heading">
            {enabled ? (
              <>
                <h2 id="studio-heading" className={GF_H2}>
                  {STIKER_IZ_FOTO_SEO.studioTitle}
                </h2>
                <StickerHeroCta />
              </>
            ) : (
              <>
                <p className={GF_EYEBROW}>Скоро</p>
                <h2 id="studio-heading" className={`mt-2 ${GF_H2}`}>
                  {STIKER_IZ_FOTO_SEO.lockedTitle}
                </h2>
                <p className={GF_LEAD}>{STIKER_IZ_FOTO_SEO.lockedLead}</p>
                <a
                  href={STIKER_IZ_FOTO_SEO.botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-5 ${GF_BRAND_CTA}`}
                >
                  {STIKER_IZ_FOTO_SEO.lockedCta}
                </a>
              </>
            )}
          </section>

          <StickerStylesSection />

          <GeneraciyaFotoHowTo
            title={STIKER_IZ_FOTO_SEO.howToTitle}
            lead={STIKER_IZ_FOTO_SEO.howToLead}
            cta={STIKER_IZ_FOTO_SEO.howToCta}
            steps={STIKER_IZ_FOTO_HOW_TO_STEPS}
          />

          <GeneraciyaFotoMore
            items={STIKER_IZ_FOTO_MORE_LINKS}
            title="Что ещё умеет нейросеть"
            lead="Тот же аккаунт и те же кредиты — для фото, а не только для стикеров."
          />

          <GeneraciyaFotoPricing
            returnPath={STICKER_PATH}
            lead="Один стикер стоит столько же, сколько одно фото выбранной модели."
          />

          <GeneraciyaFotoFaq title={STIKER_IZ_FOTO_SEO.faqTitle} items={STIKER_IZ_FOTO_FAQ} />
        </div>
      </main>
    </PageLayout>
  );
}
