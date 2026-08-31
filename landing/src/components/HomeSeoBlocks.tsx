import Link from "next/link";
import {
  GF_BLOCK,
  GF_H2,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import { HOMEPAGE_SEO, HOMEPAGE_FAQ } from "@/lib/homepage-seo-copy";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-700 hover:underline";

function FaqAnswer({ item }: { item: (typeof HOMEPAGE_FAQ)[number] }) {
  switch (item.id) {
    case "example":
      return (
        <>
          В блоке{" "}
          <Link href="/#primery" className={linkClass}>
            «Идеи промтов для фото»
          </Link>{" "}
          на этой странице. У каждой карточки рядом с кадром полный текст промта.
          Открой карточку, чтобы скопировать пример или запустить генерацию.
        </>
      );
    case "photoshoot":
      return (
        <>
          В{" "}
          <Link href="/#katalog" className={linkClass}>
            каталоге на этой странице
          </Link>{" "}
          — готовые промты для ИИ фотосессии на русском. Открой карточку и
          скопируй текст. Серию кадров со своим фото собирайте на странице{" "}
          <Link href="/ii-fotosessiya" className={linkClass}>
            «ИИ фотосессия»
          </Link>
          .
        </>
      );
    case "best":
      return (
        <>
          Те, у которых уже есть удачный кадр. На этой странице смотри примеры в{" "}
          <Link href="/#primery" className={linkClass}>
            ленте
          </Link>
          , в{" "}
          <Link href="/#katalog" className={linkClass}>
            каталоге
          </Link>{" "}
          — по темам. Если результат нравится, скопируй промт или повтори кадр
          со своим фото.
        </>
      );
    default:
      return item.aPlain;
  }
}

export function HomeIntroAndHowTo() {
  return (
    <>
      <section className="scroll-mt-20" aria-labelledby="howto-heading">
        <div className={GF_BLOCK}>
          <h2 id="howto-heading" className={GF_H2}>
            {HOMEPAGE_SEO.howToTitle}
          </h2>
          <ol className={`${GF_STACK} grid gap-5 sm:grid-cols-2`}>
            {HOMEPAGE_SEO.howToSteps.map((step, index) => (
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
    </>
  );
}

export function HomeFaq() {
  return (
    <section className="scroll-mt-20" aria-labelledby="faq-heading">
      <div className={GF_BLOCK}>
        <h2 id="faq-heading" className={GF_H2}>
          {HOMEPAGE_SEO.faqTitle}
        </h2>
        <dl className={`${GF_STACK} space-y-3`}>
          {HOMEPAGE_FAQ.map((item) => (
            <div key={item.id} className={`p-5 ${GF_SURFACE}`}>
              <dt className="text-base font-semibold text-zinc-900">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                <FaqAnswer item={item} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Intro + HowTo + FAQ in page order. Prefer the split exports on `/`. */
export function HomeSeoBlocks() {
  return (
    <>
      <HomeIntroAndHowTo />
      <HomeFaq />
    </>
  );
}
