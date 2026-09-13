import Link from "next/link";
import { GeneraciyaFotoFaqBlock } from "@/components/generate/GeneraciyaFotoFaqBlock";
import { SeoHowToSection } from "@/components/SeoPageSections";
import { HOMEPAGE_SEO, HOMEPAGE_FAQ } from "@/lib/homepage-seo-copy";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-700 hover:underline";

function FaqAnswer({ item }: { item: (typeof HOMEPAGE_FAQ)[number] }) {
  switch (item.id) {
    case "example":
      return (
        <>
          Пример промта для фото есть у каждой карточки в блоке{" "}
          <Link href="/#primery" className={linkClass}>
            «Идеи промтов для фото»
          </Link>{" "}
          на этой странице: рядом с кадром лежит полный текст, по которому этот
          кадр и сделан. Видно, как описаны свет, фон, поза и стиль. Открой
          карточку, чтобы скопировать текст или сразу запустить генерацию.
        </>
      );
    case "photoshoot":
      return (
        <>
          <Link href="/ii-fotosessiya" className={linkClass}>
            Промты для ИИ фотосессии
          </Link>{" "}
          на русском собраны вместе с примерами результата. Открой карточку,
          скопируй текст или собери серию кадров со своим фото.
        </>
      );
    case "nano-banana":
      return (
        <>
          Промты для нано банана собраны на странице{" "}
          <Link href="/nano-banana" className={linkClass}>
            Nano Banana
          </Link>
          . Скопируй промт или загрузи своё фото и запусти кадр там.
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
    <SeoHowToSection
      title={HOMEPAGE_SEO.howToTitle}
      steps={HOMEPAGE_SEO.howToSteps}
    />
  );
}

export function HomeFaq() {
  return (
    <GeneraciyaFotoFaqBlock
      title={HOMEPAGE_SEO.faqTitle}
      items={HOMEPAGE_FAQ.map((item) => ({
        q: item.q,
        a: <FaqAnswer item={item} />,
      }))}
    />
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
