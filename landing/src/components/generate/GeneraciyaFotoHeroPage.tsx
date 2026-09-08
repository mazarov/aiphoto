import type { ReactNode } from "react";
import {
  GF_HERO_GRADIENT,
  GF_HERO_H1,
  GF_HERO_INNER,
  GF_HERO_LEAD,
  GF_HERO_SECTION,
  GF_PAGE_MAIN,
  GF_PAGE_STACK,
} from "@/components/generate/generaciya-foto-ui";

type Props = {
  title: ReactNode;
  titleId?: string;
  intro?: string;
  breadcrumbs?: ReactNode;
  afterIntro?: ReactNode;
  carousel?: ReactNode;
  afterCarousel?: ReactNode;
  children: ReactNode;
};

/**
 * Homepage page chrome: open hero (H1 + lead + marquee) then the section stack.
 * Hubs reuse this instead of grafting the carousel into CatalogExplorer.
 */
export function GeneraciyaFotoHeroPage({
  title,
  titleId,
  intro,
  breadcrumbs,
  afterIntro,
  carousel,
  afterCarousel,
  children,
}: Props) {
  return (
    <main className={GF_PAGE_MAIN}>
      <section className={GF_HERO_SECTION} aria-labelledby={titleId}>
        <div className={GF_HERO_GRADIENT} aria-hidden />
        <div className={GF_HERO_INNER}>
          {breadcrumbs}
          {typeof title === "string" ? (
            <h1 id={titleId} className={GF_HERO_H1}>
              {title}
            </h1>
          ) : (
            title
          )}
          {intro ? <p className={GF_HERO_LEAD}>{intro}</p> : null}
          {afterIntro}
          {carousel}
          {afterCarousel}
        </div>
      </section>
      <div className={GF_PAGE_STACK}>{children}</div>
    </main>
  );
}

export { GF_HERO_H1 };
