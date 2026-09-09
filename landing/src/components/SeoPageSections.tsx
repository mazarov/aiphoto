import Link from "next/link";
import type { ReactNode } from "react";
import { GeneraciyaFotoFaqBlock } from "@/components/generate/GeneraciyaFotoFaqBlock";
import {
  GF_BLOCK,
  GF_BRAND_CTA,
  GF_H2,
  GF_LEAD,
  GF_SECONDARY_CTA,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";
import {
  ListingClusterChipGroup,
  type ListingClusterChipItem,
} from "@/components/ListingClusterChipGroup";

/** Same vertical rhythm as homepage GF sections. */
export const SEO_PAGE_STACK =
  "mt-10 flex flex-col gap-10 sm:mt-12 sm:gap-12 lg:mt-16 lg:gap-16";

export function SeoHowToSection({
  title,
  steps,
  headingId = "howto-heading",
}: {
  title: string;
  steps: readonly string[];
  headingId?: string;
}) {
  if (steps.length === 0) return null;
  return (
    <section className="scroll-mt-20" aria-labelledby={headingId}>
      <div className={GF_BLOCK}>
        <h2 id={headingId} className={GF_H2}>
          {title}
        </h2>
        <ol className={`${GF_STACK} grid gap-5 sm:grid-cols-2`}>
          {steps.map((step, index) => (
            <li key={step}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SeoFaqSection({
  title,
  items,
  lead,
}: {
  title: string;
  items: readonly { q: string; a: ReactNode }[];
  lead?: string;
}) {
  return <GeneraciyaFotoFaqBlock title={title} items={items} lead={lead} />;
}

export function SeoTextSection({
  title,
  paragraphs,
  headingId,
}: {
  title: string;
  paragraphs: readonly string[];
  headingId?: string;
}) {
  const id = headingId ?? "seo-text-heading";
  return (
    <section className="scroll-mt-20" aria-labelledby={id}>
      <div className={GF_BLOCK}>
        <h2 id={id} className={GF_H2}>
          {title}
        </h2>
        <div className={`${GF_STACK} max-w-3xl space-y-4`}>
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="text-sm leading-relaxed text-zinc-600 sm:text-base"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SeoRelatedChipsSection({
  title,
  items,
  headingId = "related-heading",
}: {
  title: string;
  items: ListingClusterChipItem[];
  headingId?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="scroll-mt-20" aria-labelledby={headingId}>
      <div className={GF_BLOCK}>
        <h2 id={headingId} className={GF_H2}>
          {title}
        </h2>
        <div className={GF_STACK}>
          <ListingClusterChipGroup
            label=""
            showLabel={false}
            variant="nav"
            items={items}
          />
        </div>
      </div>
    </section>
  );
}

export function SeoGenerateCtaSection({
  title,
  lead,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  headingId = "generate-cta-heading",
}: {
  title: string;
  lead: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  headingId?: string;
}) {
  return (
    <section className="scroll-mt-20" aria-labelledby={headingId}>
      <div className={GF_BLOCK}>
        <h2 id={headingId} className={GF_H2}>
          {title}
        </h2>
        <p className={GF_LEAD}>{lead}</p>
        <div className={`${GF_STACK} flex flex-wrap gap-3`}>
          <Link href={primaryHref} className={GF_BRAND_CTA}>
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className={GF_SECONDARY_CTA}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
