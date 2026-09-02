import Link from "next/link";
import { GeneraciyaFotoThemesCarousel } from "@/components/generate/GeneraciyaFotoThemesCarousel";
import { GeneraciyaFotoToolsGrid } from "@/components/generate/GeneraciyaFotoToolsGrid";
import {
  GF_BLOCK,
  GF_BRAND_CTA,
  GF_SECONDARY_CTA,
  GF_EYEBROW,
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
  title = GENERACIYA_FOTO_THEMES.title,
  lead = GENERACIYA_FOTO_THEMES.lead,
  leadSecondary,
  eyebrow,
  items,
  countKind,
  ctaHref,
  ctaLabel,
  sectionId = "temy",
  headingId = "themes-heading",
}: {
  photosByHref: Record<string, string[]>;
  countByHref: Record<string, number>;
  title?: string;
  lead?: string;
  leadSecondary?: string;
  eyebrow?: string;
  items?: readonly { title: string; href: string }[];
  countKind?: "templates" | "prompts";
  ctaHref?: string;
  ctaLabel?: string;
  sectionId?: string;
  headingId?: string;
}) {
  return (
    <section id={sectionId} className={sectionClass} aria-labelledby={headingId}>
      <div className={GF_BLOCK}>
        {eyebrow ? <p className={GF_EYEBROW}>{eyebrow}</p> : null}
        <h2 id={headingId} className={`${eyebrow ? "mt-2 " : ""}${GF_H2}`}>
          {title}
        </h2>
        {lead ? <p className={GF_LEAD}>{lead}</p> : null}
        {leadSecondary ? <p className={GF_LEAD}>{leadSecondary}</p> : null}
        <GeneraciyaFotoThemesCarousel
          items={items}
          photosByHref={photosByHref}
          countByHref={countByHref}
          ariaLabel={title}
          countKind={countKind}
        />
        {ctaHref && ctaLabel ? (
          <div className={`${GF_STACK} flex justify-center`}>
            <Link href={ctaHref} className={GF_SECONDARY_CTA}>
              {ctaLabel}
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function GeneraciyaFotoTools({
  title = GENERACIYA_FOTO_TOOLS.title,
  lead = GENERACIYA_FOTO_TOOLS.lead,
}: {
  title?: string;
  lead?: string;
} = {}) {
  return (
    <section className={sectionClass} aria-labelledby="tools-heading">
      <div className={GF_BLOCK}>
        <SectionHeading id="tools-heading" title={title} lead={lead} />
        <GeneraciyaFotoToolsGrid />
      </div>
    </section>
  );
}

export function GeneraciyaFotoHowTo({
  title = GENERACIYA_FOTO_SEO.howToTitle,
  lead = GENERACIYA_FOTO_SEO.howToLead,
  cta = GENERACIYA_FOTO_SEO.howToCta,
  steps = GENERACIYA_FOTO_HOW_TO_STEPS,
}: {
  title?: string;
  lead?: string;
  cta?: string;
  steps?: readonly { n: string; title: string; text: string }[];
} = {}) {
  return (
    <section className={sectionClass} aria-labelledby="howto-heading">
      <div className={GF_BLOCK}>
        <SectionHeading id="howto-heading" title={title} lead={lead} />
        <ol className={`${GF_STACK} grid gap-5 lg:grid-cols-3`}>
          {steps.map((step) => (
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
          {cta}
        </Link>
      </div>
    </section>
  );
}

export function GeneraciyaFotoMore({
  items = GENERACIYA_FOTO_CAPABILITIES,
  title = GENERACIYA_FOTO_MORE_TITLE,
}: {
  items?: readonly { title: string; text: string; href: string }[];
  title?: string;
} = {}) {
  return (
    <section className={sectionClass} aria-labelledby="more-heading">
      <div className={GF_BLOCK}>
        <SectionHeading id="more-heading" title={title} />
        <ul className={`${GF_STACK} grid gap-3 lg:grid-cols-2`}>
          {items.map((item) => (
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

export function GeneraciyaFotoPricing({
  returnPath = GENERACIYA_FOTO_PRICING.returnPath,
  lead,
}: {
  returnPath?: string;
  lead?: string;
}) {
  return (
    <section id="tarify" className={sectionClass} aria-labelledby="tarify-heading">
      <PricingScreen
        variant="embed"
        paywallVariant={GENERACIYA_FOTO_PRICING.variant}
        returnPath={returnPath}
        lead={lead}
      />
    </section>
  );
}
