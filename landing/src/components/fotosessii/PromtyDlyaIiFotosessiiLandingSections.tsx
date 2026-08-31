"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { GeneraciyaFotoFaqBlock } from "@/components/generate/GeneraciyaFotoFaqBlock";
import {
  GF_BLOCK,
  GF_BRAND_CTA,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { usePricingModal } from "@/context/PricingModalContext";
import {
  PROMTY_DLYA_II_FOTOSESSII_FAQ,
  PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS,
  PROMTY_DLYA_II_FOTOSESSII_SEO,
  isFotosessiiFaqLink,
  type FotosessiiFaqPart,
  type FotosessiiHowToStep,
} from "@/lib/promty-dlya-ii-fotosessii-seo-copy";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

export type PromtyDlyaIiFotosessiiHowToCopy = {
  howToTitle: string;
  howToEyebrow: string;
  howToLead: string;
  howToPickExampleLabel: string;
  howToPickExampleHref: string;
  howToSteps: readonly FotosessiiHowToStep[];
};

const sectionClass = "scroll-mt-20";
const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-700 hover:underline";

function scrollToPageHash(href: string) {
  const id = href.slice(1);
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", href);
}

function onHashLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
  event.preventDefault();
  scrollToPageHash(href);
}

export function PromtyDlyaIiFotosessiiHowTo({
  copy,
}: {
  copy?: PromtyDlyaIiFotosessiiHowToCopy;
} = {}) {
  const { seedPhotoshoot, needsCredits } = useGenerateDock();
  const { open: openPricing } = usePricingModal();
  const howTo = copy ?? {
    howToTitle: PROMTY_DLYA_II_FOTOSESSII_SEO.howToTitle,
    howToEyebrow: PROMTY_DLYA_II_FOTOSESSII_SEO.howToEyebrow,
    howToLead: PROMTY_DLYA_II_FOTOSESSII_SEO.howToLead,
    howToPickExampleLabel: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleLabel,
    howToPickExampleHref: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleHref,
    howToSteps: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS,
  };

  const handleUploadPhoto = () => {
    if (needsCredits) {
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
      openPricing();
      return;
    }
    seedPhotoshoot({
      entrySource: "route",
      dockSurface: "photos",
    });
  };

  return (
    <section id="howto" className={sectionClass} aria-labelledby="howto-heading">
      <div className={GF_BLOCK}>
        <p className={GF_EYEBROW}>{howTo.howToEyebrow}</p>
        <h2 id="howto-heading" className={`mt-2 ${GF_H2}`}>
          {howTo.howToTitle}
        </h2>
        <p className={GF_LEAD}>{howTo.howToLead}</p>
        <ol className={`${GF_STACK} grid gap-5 sm:grid-cols-2`}>
          {howTo.howToSteps.map((step) => (
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
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className={GF_BRAND_CTA}
            onClick={handleUploadPhoto}
          >
            {howTo.howToPickExampleLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function FaqAnswer({ parts }: { parts: readonly FotosessiiFaqPart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (!isFotosessiiFaqLink(part)) return part;
        if (part.href.startsWith("#")) {
          return (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              className={linkClass}
              onClick={(event) => onHashLinkClick(event, part.href)}
            >
              {part.label}
            </a>
          );
        }
        return (
          <Link key={`${part.href}-${index}`} href={part.href} className={linkClass}>
            {part.label}
          </Link>
        );
      })}
    </>
  );
}

export function PromtyDlyaIiFotosessiiFaq() {
  return (
    <GeneraciyaFotoFaqBlock
      title={PROMTY_DLYA_II_FOTOSESSII_SEO.faqTitle}
      items={PROMTY_DLYA_II_FOTOSESSII_FAQ.map((item) => ({
        q: item.q,
        a: <FaqAnswer parts={item.a} />,
      }))}
    />
  );
}

export function PromtyDlyaIiFotosessiiPlainFaq({
  title,
  items,
}: {
  title: string;
  items: readonly { q: string; a: string }[];
}) {
  return <GeneraciyaFotoFaqBlock title={title} items={items} />;
}

