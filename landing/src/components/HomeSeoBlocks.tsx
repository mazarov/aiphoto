import Link from "next/link";
import { HOMEPAGE_SEO, HOMEPAGE_FAQ } from "@/lib/homepage-seo-copy";

const linkClass =
  "font-medium text-indigo-600 hover:text-indigo-700 hover:underline";

function FaqAnswer({ index }: { index: number }) {
  switch (index) {
    case 1:
      return (
        <>
          В каталоге PromptShot — разделы{" "}
          <Link href="/#audience_tag" className={linkClass}>
            «Люди и отношения»
          </Link>
          ,{" "}
          <Link href="/#style_tag" className={linkClass}>
            «Стили»
          </Link>
          ,{" "}
          <Link href="/#occasion_tag" className={linkClass}>
            «События»
          </Link>{" "}
          с промтами для портретов, парных и студийных фотосессий в нейросетях.
        </>
      );
    case 2:
      return (
        <>
          Скопируйте промт{" "}
          <Link href="/#audience_tag" className={linkClass}>
            с карточки в каталоге
          </Link>
          , откройте Nano Banana или другую нейросеть, вставьте текст и при
          необходимости загрузите своё фото.
        </>
      );
    case 5:
      return (
        <>
          Загрузите изображение на странице{" "}
          <Link href="/foto-v-promt" className={linkClass}>
            Фото в промт
          </Link>{" "}
          — сервис вернёт текстовый промт для нейросети. Для разбора картинок на
          других сайтах — расширение AI Image Describer для Chrome.
        </>
      );
    default:
      return HOMEPAGE_FAQ[index].aPlain;
  }
}

export function HomeSeoBlocks() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-4 pb-16">
      <p className="text-base leading-relaxed text-zinc-600">{HOMEPAGE_SEO.intro}</p>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold text-zinc-900">{HOMEPAGE_SEO.howToTitle}</h2>
        <ol className="mt-4 space-y-3 text-zinc-600">
          {HOMEPAGE_SEO.howToSteps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-zinc-900">{HOMEPAGE_SEO.faqTitle}</h2>
        <dl className="mt-4 space-y-6">
          {HOMEPAGE_FAQ.map((item, i) => (
            <div
              key={item.q}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4"
            >
              <dt className="font-semibold text-zinc-900">{item.q}</dt>
              <dd className="mt-2 text-zinc-600">
                <FaqAnswer index={i} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
