"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import {
  GF_BLOCK,
  GF_BRAND_CTA,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import {
  PROMTY_DLYA_II_FOTOSESSII_FAQ,
  PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS,
  PROMTY_DLYA_II_FOTOSESSII_SEO,
  isFotosessiiFaqLink,
  type FotosessiiFaqPart,
  type FotosessiiHowToStep,
} from "@/lib/promty-dlya-ii-fotosessii-seo-copy";

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
  const howTo = copy ?? {
    howToTitle: PROMTY_DLYA_II_FOTOSESSII_SEO.howToTitle,
    howToEyebrow: PROMTY_DLYA_II_FOTOSESSII_SEO.howToEyebrow,
    howToLead: PROMTY_DLYA_II_FOTOSESSII_SEO.howToLead,
    howToPickExampleLabel: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleLabel,
    howToPickExampleHref: PROMTY_DLYA_II_FOTOSESSII_SEO.howToPickExampleHref,
    howToSteps: PROMTY_DLYA_II_FOTOSESSII_HOW_TO_STEPS,
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
          <a
            href={howTo.howToPickExampleHref}
            className={GF_BRAND_CTA}
            onClick={(event) => onHashLinkClick(event, howTo.howToPickExampleHref)}
          >
            {howTo.howToPickExampleLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEM =
  `group ${GF_SURFACE} open:border-indigo-200 open:bg-white`;
const FAQ_SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const FAQ_ANSWER = "px-5 pb-4 text-sm leading-relaxed text-zinc-600";

function FaqChevron() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FaqAccordionItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <details open className={FAQ_ITEM}>
      <summary className={FAQ_SUMMARY}>
        <span>{question}</span>
        <FaqChevron />
      </summary>
      <div className={FAQ_ANSWER}>{children}</div>
    </details>
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
    <section id="faq" className={sectionClass} aria-labelledby="faq-heading">
      <div className={GF_BLOCK}>
        <h2 id="faq-heading" className={GF_H2}>
          {PROMTY_DLYA_II_FOTOSESSII_SEO.faqTitle}
        </h2>
        <div className={`${GF_STACK} space-y-2`}>
          {PROMTY_DLYA_II_FOTOSESSII_FAQ.map((item) => (
            <FaqAccordionItem key={item.q} question={item.q}>
              <FaqAnswer parts={item.a} />
            </FaqAccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PromtyDlyaIiFotosessiiPlainFaq({
  title,
  items,
}: {
  title: string;
  items: readonly { q: string; a: string }[];
}) {
  return (
    <section id="faq" className={sectionClass} aria-labelledby="faq-heading">
      <div className={GF_BLOCK}>
        <h2 id="faq-heading" className={GF_H2}>
          {title}
        </h2>
        <div className={`${GF_STACK} space-y-2`}>
          {items.map((item) => (
            <FaqAccordionItem key={item.q} question={item.q}>
              {item.a}
            </FaqAccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
}

