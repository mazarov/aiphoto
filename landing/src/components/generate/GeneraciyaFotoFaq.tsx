"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { GeneraciyaFotoFaqBlock } from "@/components/generate/GeneraciyaFotoFaqBlock";
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
    <GeneraciyaFotoFaqBlock
      title={GENERACIYA_FOTO_SEO.faqTitle}
      items={GENERACIYA_FOTO_FAQ.map((item) => ({
        q: item.q,
        a: item.a.map((part, index) => {
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
        }),
      }))}
    />
  );
}
