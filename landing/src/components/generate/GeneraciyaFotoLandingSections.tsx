import Link from "next/link";
import { GeneraciyaFotoReviewsCarousel } from "@/components/generate/GeneraciyaFotoReviewsCarousel";
import { GeneraciyaFotoThemesCarousel } from "@/components/generate/GeneraciyaFotoThemesCarousel";
import { GeneraciyaFotoToolsGrid } from "@/components/generate/GeneraciyaFotoToolsGrid";
import {
  GF_BLOCK,
  GF_BRAND_CTA,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import { PricingScreen } from "@/components/pricing/PricingScreen";
import {
  GENERACIYA_FOTO_CAPABILITIES,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_MORE_TITLE,
  GENERACIYA_FOTO_PRICING,
  GENERACIYA_FOTO_REVIEWS,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_FOTO_TOOLS,
} from "@/lib/generaciya-foto-seo-copy";

const sectionClass = "scroll-mt-20";

function SectionHeading({
  id,
  title,
  lead,
}: {
  id?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl">
      <h2 id={id} className={GF_H2}>
        {title}
      </h2>
      {lead ? <p className={GF_LEAD}>{lead}</p> : null}
    </div>
  );
}

export function GeneraciyaFotoThemes({
  photosByHref,
  countByHref,
}: {
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
}) {
  return (
    <section id="temy" className={sectionClass} aria-labelledby="themes-heading">
      <div className={GF_BLOCK}>
        <h2 id="themes-heading" className={GF_H2}>
          {GENERACIYA_FOTO_THEMES.title}
        </h2>
        <p className={GF_LEAD}>{GENERACIYA_FOTO_THEMES.lead}</p>
        <GeneraciyaFotoThemesCarousel
          photosByHref={photosByHref}
          countByHref={countByHref}
        />
      </div>
    </section>
  );
}

export function GeneraciyaFotoTools() {
  return (
    <section className={sectionClass} aria-labelledby="tools-heading">
      <div className={GF_BLOCK}>
        <SectionHeading
          id="tools-heading"
          title={GENERACIYA_FOTO_TOOLS.title}
          lead={GENERACIYA_FOTO_TOOLS.lead}
        />
        <GeneraciyaFotoToolsGrid />
      </div>
    </section>
  );
}

export function GeneraciyaFotoHowTo() {
  return (
    <section className={sectionClass} aria-labelledby="howto-heading">
      <div className={GF_BLOCK}>
        <SectionHeading
          id="howto-heading"
          title={GENERACIYA_FOTO_SEO.howToTitle}
          lead={GENERACIYA_FOTO_SEO.howToLead}
        />
        <ol className={`${GF_STACK} grid gap-5 lg:grid-cols-3`}>
          {GENERACIYA_FOTO_HOW_TO_STEPS.map((step) => (
            <li key={step.n}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                {step.n}
              </p>
              <h3 className="mt-2 text-base font-semibold text-zinc-900">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <Link href="#generator" className={`${GF_STACK} ${GF_BRAND_CTA}`}>
          {GENERACIYA_FOTO_SEO.howToCta}
        </Link>
      </div>
    </section>
  );
}

export function GeneraciyaFotoReviews() {
  return (
    <section id="otzyvy" className={sectionClass} aria-labelledby="reviews-heading">
      <div className={GF_BLOCK}>
        <blockquote className="max-w-3xl">
          <p className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            «{GENERACIYA_FOTO_REVIEWS.quote}»
          </p>
          <footer className="mt-2 text-sm text-zinc-500">
            (с) {GENERACIYA_FOTO_REVIEWS.quoteAuthor}
          </footer>
        </blockquote>
        <h2 id="reviews-heading" className={`${GF_STACK} ${GF_H2}`}>
          {GENERACIYA_FOTO_REVIEWS.title}
        </h2>
        <GeneraciyaFotoReviewsCarousel />
      </div>
    </section>
  );
}

export function GeneraciyaFotoMore() {
  return (
    <section className={sectionClass} aria-labelledby="more-heading">
      <div className={GF_BLOCK}>
        <SectionHeading id="more-heading" title={GENERACIYA_FOTO_MORE_TITLE} />
        <ul className={`${GF_STACK} grid gap-3 lg:grid-cols-2`}>
          {GENERACIYA_FOTO_CAPABILITIES.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href}
                className={`flex h-full flex-col p-5 ${GF_SURFACE}`}
              >
                <span className="text-base font-semibold text-zinc-900">
                  {item.title}
                </span>
                <span className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                  {item.text}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function GeneraciyaFotoPricing() {
  return (
    <section id="tarify" className={sectionClass} aria-labelledby="tarify-heading">
      <PricingScreen
        variant="embed"
        paywallVariant={GENERACIYA_FOTO_PRICING.variant}
        returnPath={GENERACIYA_FOTO_PRICING.returnPath}
      />
    </section>
  );
}
