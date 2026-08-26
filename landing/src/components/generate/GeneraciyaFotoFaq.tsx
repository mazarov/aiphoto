"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import {
  GF_BLOCK,
  GF_H2,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import {
  GENERACIYA_FOTO_FAQ,
  GENERACIYA_FOTO_SEO,
  isGeneraciyaFotoFaqLink,
} from "@/lib/generaciya-foto-seo-copy";

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

export function GeneraciyaFotoFaq() {
  return (
    <section className="scroll-mt-20">
      <div className={GF_BLOCK}>
        <h2 className={GF_H2}>{GENERACIYA_FOTO_SEO.faqTitle}</h2>
        <dl className={`${GF_STACK} space-y-3`}>
        {GENERACIYA_FOTO_FAQ.map((item) => (
          <div key={item.q} className={`p-5 ${GF_SURFACE}`}>
            <dt className="text-base font-semibold text-zinc-900">{item.q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              {item.a.map((part, index) => {
                if (!isGeneraciyaFotoFaqLink(part)) return part;
                if (part.href.startsWith("mailto:")) {
                  return (
                    <a
                      key={`${part.href}-${index}`}
                      href={part.href}
                      className={linkClass}
                    >
                      {part.label}
                    </a>
                  );
                }
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
                  <Link
                    key={`${part.href}-${index}`}
                    href={part.href}
                    className={linkClass}
                  >
                    {part.label}
                  </Link>
                );
              })}
            </dd>
          </div>
        ))}
        </dl>
      </div>
    </section>
  );
}
