import Image from "next/image";
import Link from "next/link";
import type { GenerationExampleCard } from "@/lib/generation/example-card";
import { CARD_IMAGE_LISTING_NEXT_QUALITY, SIZES_CARD_GRID } from "@/lib/card-image-presets";
import {
  GENERACIYA_FOTO_CAPABILITIES,
  GENERACIYA_FOTO_HOW_TO_STEPS,
  GENERACIYA_FOTO_MORE_TITLE,
  GENERACIYA_FOTO_PACKS,
  GENERACIYA_FOTO_REVIEWS,
  GENERACIYA_FOTO_SEO,
  GENERACIYA_FOTO_THEMES,
  GENERACIYA_FOTO_TOOLS,
  GENERACIYA_FOTO_TOPICS,
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
      <h2
        id={id}
        className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
      >
        {title}
      </h2>
      {lead ? (
        <p className="mt-3 text-base leading-relaxed text-zinc-600">{lead}</p>
      ) : null}
    </div>
  );
}

function TextLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-700 hover:text-indigo-800"
    >
      {children}
      <span aria-hidden className="ml-1">
        →
      </span>
    </Link>
  );
}

export function GeneraciyaFotoThemes() {
  return (
    <section className={sectionClass} aria-labelledby="themes-heading">
      <SectionHeading
        id="themes-heading"
        title={GENERACIYA_FOTO_THEMES.title}
        lead={GENERACIYA_FOTO_THEMES.lead}
      />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {GENERACIYA_FOTO_THEMES.items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                {item.count}
              </span>
              <span className="mt-2 text-lg font-semibold text-zinc-900">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <TextLink href={GENERACIYA_FOTO_THEMES.allHref}>
          {GENERACIYA_FOTO_THEMES.allLabel}
        </TextLink>
      </div>
    </section>
  );
}

export function GeneraciyaFotoTools() {
  return (
    <section className={sectionClass} aria-labelledby="tools-heading">
      <SectionHeading
        id="tools-heading"
        title={GENERACIYA_FOTO_TOOLS.title}
        lead={GENERACIYA_FOTO_TOOLS.lead}
      />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GENERACIYA_FOTO_TOOLS.items.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-200 hover:bg-indigo-50/30"
            >
              <span className="font-semibold text-zinc-900">{item.title}</span>
              <span className="mt-2 text-sm leading-relaxed text-zinc-600">
                {item.text}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <TextLink href={GENERACIYA_FOTO_TOOLS.allHref}>
          {GENERACIYA_FOTO_TOOLS.allLabel}
        </TextLink>
      </div>
    </section>
  );
}

export function GeneraciyaFotoPacks({
  cards,
}: {
  cards: GenerationExampleCard[];
}) {
  const preview = cards.filter((card) => card.photoUrl).slice(0, 6);

  return (
    <section className={sectionClass} aria-labelledby="packs-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="packs-heading"
          title={GENERACIYA_FOTO_PACKS.title}
          lead={GENERACIYA_FOTO_PACKS.lead}
        />
        <Link
          href={GENERACIYA_FOTO_PACKS.href}
          className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {GENERACIYA_FOTO_PACKS.cta}
        </Link>
      </div>
      {preview.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {preview.map((card) => (
            <li key={card.id}>
              <Link
                href={card.slug ? `/p/${card.slug}` : "#primery"}
                className="group relative block overflow-hidden rounded-2xl bg-zinc-100"
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={card.photoUrl!}
                    alt={card.title}
                    fill
                    sizes={SIZES_CARD_GRID}
                    quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
                    className="object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function GeneraciyaFotoTopics() {
  return (
    <section className={sectionClass} aria-labelledby="topics-heading">
      <SectionHeading id="topics-heading" title={GENERACIYA_FOTO_TOPICS.title} />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {GENERACIYA_FOTO_TOPICS.items.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href}
              className="flex items-baseline justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-indigo-200"
            >
              <span className="font-semibold text-zinc-900">{item.title}</span>
              <span className="shrink-0 text-sm text-zinc-500">{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <TextLink href={GENERACIYA_FOTO_TOPICS.allHref}>
          {GENERACIYA_FOTO_TOPICS.allLabel}
        </TextLink>
      </div>
    </section>
  );
}

export function GeneraciyaFotoHowTo() {
  return (
    <section className={sectionClass} aria-labelledby="howto-heading">
      <div className="overflow-hidden rounded-[1.75rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 py-6 sm:px-5 sm:py-8">
        <SectionHeading
          id="howto-heading"
          title={GENERACIYA_FOTO_SEO.howToTitle}
          lead={GENERACIYA_FOTO_SEO.howToLead}
        />
        <ol className="mt-8 grid gap-6 lg:grid-cols-3">
          {GENERACIYA_FOTO_HOW_TO_STEPS.map((step) => (
            <li key={step.n}>
              <p className="text-xs font-semibold tracking-[0.16em] text-indigo-600">
                {step.n}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
        <Link
          href="#generator"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {GENERACIYA_FOTO_SEO.howToCta}
        </Link>
      </div>
    </section>
  );
}

export function GeneraciyaFotoReviews() {
  return (
    <section id="otzyvy" className={sectionClass} aria-labelledby="reviews-heading">
      <blockquote className="max-w-3xl">
        <p className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          «{GENERACIYA_FOTO_REVIEWS.quote}»
        </p>
        <footer className="mt-3 text-sm text-zinc-500">
          (с) {GENERACIYA_FOTO_REVIEWS.quoteAuthor}
        </footer>
      </blockquote>
      <h2 id="reviews-heading" className="mt-8 text-xl font-bold text-zinc-900">
        {GENERACIYA_FOTO_REVIEWS.title}
      </h2>
      <ul className="mt-5 grid gap-3 md:grid-cols-3">
        {GENERACIYA_FOTO_REVIEWS.items.map((item) => (
          <li
            key={item.name}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <p className="font-semibold text-zinc-900">{item.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {item.text}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <TextLink href="#otzyvy">{GENERACIYA_FOTO_REVIEWS.allLabel}</TextLink>
      </div>
    </section>
  );
}

export function GeneraciyaFotoMore() {
  return (
    <section className={sectionClass} aria-labelledby="more-heading">
      <SectionHeading id="more-heading" title={GENERACIYA_FOTO_MORE_TITLE} />
      <ul className="mt-6 grid gap-3 lg:grid-cols-2">
        {GENERACIYA_FOTO_CAPABILITIES.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-200"
            >
              <span className="font-semibold text-zinc-900">{item.title}</span>
              <span className="mt-2 text-sm leading-relaxed text-zinc-600">
                {item.text}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GeneraciyaFotoBottomCta() {
  return (
    <section className="rounded-[1.75rem] border border-indigo-100 bg-indigo-50/60 px-5 py-8 text-center">
      <Link
        href="#generator"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        {GENERACIYA_FOTO_SEO.howToCta}
      </Link>
    </section>
  );
}
