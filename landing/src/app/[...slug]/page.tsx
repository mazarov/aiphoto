import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchRouteCards, enrichCardsWithDetails } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FilterableGrid } from "@/components/CardFilters";
import {
  findTagByUrlPath,
  getSiblingTags,
  getAllTagPaths,
  DIMENSION_LABELS,
} from "@/lib/tag-registry";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateStaticParams() {
  const paths = getAllTagPaths();
  return paths.map((path) => ({
    slug: path.split("/").filter(Boolean),
  }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  const tag = findTagByUrlPath(path);
  if (!tag) return {};

  return {
    title: `Промты для фото: ${tag.labelRu} — готовые промпты для ИИ`,
    description: `Готовые промты «${tag.labelRu}». Копируй и используй в нейросети для создания фото.`,
  };
}

const INTRO_TEMPLATES: Record<string, string> = {
  audience_tag:
    "Готовые промпты для создания фото с помощью нейросетей. Выбери подходящий промт, скопируй и вставь в ИИ-генератор — получишь результат за секунды. Все промты проверены на практике.",
  style_tag:
    "Промпты для фото в разных визуальных стилях. От реалистичного портрета до мультяшного или ретро — копируй текст и получай нужный результат в любом ИИ-генераторе изображений.",
  occasion_tag:
    "Промпты для праздничных и тематических фото. День рождения, 8 марта, свадьба, Новый год — готовые формулировки для нейросетей, чтобы создать атмосферное фото к любому событию.",
  object_tag:
    "Промпты для фото с объектами, в определённой обстановке или позе. С машиной, с цветами, на море, в зеркале — копируй и используй в ИИ для создания нужной сцены.",
  doc_task_tag:
    "Промпты для создания фото на документы: паспорт, резюме, аватарку. Готовые формулировки под требования к освещению, фону и ракурсу — для нейросетей и фоторедакторов.",
};

const HOW_TO_STEPS = [
  "Выбери карточку с подходящим промтом и нажми «Скопировать промт».",
  "Открой нейросеть (Kandinsky, Midjourney, DALL·E, Flux и др.) или фоторедактор с ИИ.",
  "Вставь скопированный текст в поле ввода и добавь своё фото, если нужно.",
  "Получи результат и при необходимости скорректируй промт под свой запрос.",
];

const FAQ_ITEMS = [
  {
    q: "Как использовать промт для фото?",
    a: "Скопируйте текст промта, откройте нейросеть или фоторедактор с ИИ, вставьте промт в поле ввода. Добавьте своё фото, если требуется, и запустите генерацию.",
  },
  {
    q: "Какие нейросети подходят для этих промптов?",
    a: "Промпты работают в Kandinsky, Midjourney, DALL·E, Flux, Leonardo AI, Ideogram и других генераторах изображений. Формулировки на русском языке.",
  },
  {
    q: "Можно ли изменить промт под себя?",
    a: "Да. Используйте промт как основу: добавляйте детали (цвет волос, одежду, фон), меняйте стиль или убирайте лишнее. Нейросеть поймёт контекст.",
  },
  {
    q: "Промпты бесплатные?",
    a: "Да. Все промты на сайте можно копировать и использовать бесплатно в любых ИИ-сервисах.",
  },
];

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const path = "/" + slug.join("/");
  const tag = findTagByUrlPath(path);

  if (!tag) notFound();

  const rpcParams: Record<string, string | null> = {
    audience_tag: null,
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
  };
  rpcParams[tag.dimension] = tag.slug;

  const result = await fetchRouteCards({
    audience_tag: rpcParams.audience_tag,
    style_tag: rpcParams.style_tag,
    occasion_tag: rpcParams.occasion_tag,
    object_tag: rpcParams.object_tag,
    doc_task_tag: rpcParams.doc_task_tag,
    limit: 48,
  });
  const cards = await enrichCardsWithDetails(result.cards);
  const siblings = getSiblingTags(tag, 6);
  const sectionLabel = DIMENSION_LABELS[tag.dimension];
  const intro = INTRO_TEMPLATES[tag.dimension] || INTRO_TEMPLATES.audience_tag;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Tag hero */}
      <section className="border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white">
        <div className="mx-auto max-w-7xl px-5 pt-10 pb-8">
          <nav className="mb-5 flex items-center gap-1.5 text-sm text-zinc-400">
            <Link href="/" className="transition-colors hover:text-zinc-700">
              Главная
            </Link>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-zinc-300"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span>{sectionLabel}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-zinc-300"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="text-zinc-700 font-medium">{tag.labelRu}</span>
          </nav>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Промты для фото: {tag.labelRu}
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600 leading-relaxed">
            {intro} Ниже — подборка промптов «{tag.labelRu}»: выбирай, копируй и создавай фото.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm tabular-nums text-zinc-600">
              {result.cards_count}{" "}
              {result.cards_count === 1
                ? "промпт"
                : result.cards_count < 5
                  ? "промпта"
                  : "промптов"}
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10">
        <FilterableGrid cards={cards} />

        {/* How to use */}
        <section className="mt-16 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-zinc-900">Как использовать промт</h2>
          <ol className="mt-4 space-y-3 text-zinc-600">
            {HOW_TO_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900">Частые вопросы</h2>
          <dl className="mt-4 space-y-6">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                <dt className="font-semibold text-zinc-900">{item.q}</dt>
                <dd className="mt-2 text-zinc-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Internal links */}
        {siblings.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-zinc-900">Ещё разделы</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={s.urlPath + "/"}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  {s.labelRu}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
