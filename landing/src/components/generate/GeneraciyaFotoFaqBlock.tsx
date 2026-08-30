import type { ReactNode } from "react";
import {
  GF_BLOCK,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";

export type GeneraciyaFotoFaqBlockItem = {
  q: string;
  a: ReactNode;
};

type GeneraciyaFotoFaqBlockProps = {
  title: string;
  items: readonly GeneraciyaFotoFaqBlockItem[];
  lead?: string;
  id?: string;
  headingId?: string;
  className?: string;
};

export function GeneraciyaFotoFaqBlock({
  title,
  items,
  lead,
  id = "faq",
  headingId = "faq-heading",
  className = "scroll-mt-20",
}: GeneraciyaFotoFaqBlockProps) {
  return (
    <section id={id} className={className} aria-labelledby={headingId}>
      <div className={GF_BLOCK}>
        <h2 id={headingId} className={GF_H2}>
          {title}
        </h2>
        {lead ? <p className={GF_LEAD}>{lead}</p> : null}
        <dl className={`${GF_STACK} space-y-3`}>
          {items.map((item) => (
            <div key={item.q} className={`p-5 ${GF_SURFACE}`}>
              <dt className="text-base font-semibold text-zinc-900">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
