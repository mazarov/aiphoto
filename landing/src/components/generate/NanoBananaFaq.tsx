"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { GeneraciyaFotoFaqBlock } from "@/components/generate/GeneraciyaFotoFaqBlock";
import { isGeneraciyaFotoFaqLink } from "@/lib/generaciya-foto-seo-copy";
import { NANO_BANANA_FAQ, NANO_BANANA_SEO } from "@/lib/nano-banana-seo-copy";

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

export function NanoBananaFaq() {
  return (
    <GeneraciyaFotoFaqBlock
      title={NANO_BANANA_SEO.faqTitle}
      items={NANO_BANANA_FAQ.map((item) => ({
        q: item.q,
        a: item.a.map((part, index) => {
          if (!isGeneraciyaFotoFaqLink(part)) return part;
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
