import type { ReactNode } from "react";
import Link from "next/link";
import { GeneraciyaFotoHeroCarousel } from "@/components/generate/GeneraciyaFotoHeroCarousel";
import {
  GeneraciyaFotoStarter,
  type GeneraciyaFotoStarterCopy,
} from "@/components/generate/GeneraciyaFotoStarter";
import { GF_H2, GF_HERO_INNER, GF_LEAD } from "@/components/generate/generaciya-foto-ui";
import type { GenerationExampleCard } from "@/lib/generation/example-card";

export type GeneraciyaHubBreadcrumb = { label: string; href?: string };

function BreadcrumbSeparator() {
  return (
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
  );
}

/**
 * Shared first screen of the `/generaciya/*` hubs: crumbs → H1 → intro →
 * carousel → social proof → H2 + starter. The page decides which starter
 * modes exist; the hero never adds a mode by itself.
 */
export function GeneraciyaHubHero({
  breadcrumbs,
  h1,
  heading,
  intro,
  carouselCards,
  carouselAriaLabel,
  socialProof,
  generatorTitle,
  generatorLead,
  generatorNote,
  starterModes,
  starterCopy,
  starterCtaLabel,
  starterInitialPrompt,
  starterSectionId,
}: {
  breadcrumbs: readonly GeneraciyaHubBreadcrumb[];
  h1: string;
  /** Replaces the plain H1. Scenario pages pass the ad-landing heading. */
  heading?: ReactNode;
  intro: string;
  carouselCards: GenerationExampleCard[];
  carouselAriaLabel: string;
  socialProof: string | null;
  generatorTitle?: string;
  generatorLead?: string;
  generatorNote: string;
  starterModes: readonly ("text" | "photo")[];
  starterCopy?: GeneraciyaFotoStarterCopy;
  starterCtaLabel?: string;
  starterInitialPrompt?: string;
  starterSectionId?: string;
}) {
  return (
    <section id="generator" className="relative scroll-mt-20 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_-20%,rgba(99,102,241,0.14),transparent_62%)]"
        aria-hidden
      />
      <div className={GF_HERO_INNER}>
        <nav
          aria-label="Хлебные крошки"
          className="mb-5 flex flex-wrap items-center justify-center gap-1.5 text-sm text-zinc-400"
        >
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                {index > 0 ? <BreadcrumbSeparator /> : null}
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="transition-colors hover:text-zinc-700">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={last ? "font-medium text-zinc-700" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
        {heading ?? (
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {h1}
          </h1>
        )}
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 sm:mt-4 sm:text-lg">
          {intro}
        </p>
        <GeneraciyaFotoHeroCarousel cards={carouselCards} ariaLabel={carouselAriaLabel} />
        {socialProof ? (
          <p className="mx-auto mt-3 text-sm font-medium text-indigo-700 sm:text-base">
            {socialProof}
          </p>
        ) : null}
        {generatorTitle ? (
          <h2 className={`mx-auto mt-8 max-w-3xl text-balance ${GF_H2}`}>{generatorTitle}</h2>
        ) : null}
        {generatorLead ? <p className={`mx-auto text-pretty ${GF_LEAD}`}>{generatorLead}</p> : null}
        <GeneraciyaFotoStarter
          modes={starterModes}
          copy={starterCopy}
          ctaLabel={starterCtaLabel}
          initialPrompt={starterInitialPrompt}
          sectionId={starterSectionId}
        />
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
          {generatorNote}
        </p>
      </div>
    </section>
  );
}
