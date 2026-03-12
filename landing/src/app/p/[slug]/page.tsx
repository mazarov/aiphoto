import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getCardPageData,
  getStoragePublicUrl,
} from "@/lib/supabase";
import {
  getFirstTagFromSeoTags,
  findTagBySlug,
  type Dimension,
} from "@/lib/tag-registry";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://promptshot.ru");

const DIMENSIONS: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

function getSeoSlugsWithTags(seoTags: Record<string, unknown> | null): { slug: string; label: string; href: string | null }[] {
  if (!seoTags) return [];
  const result: { slug: string; label: string; href: string | null }[] = [];
  for (const dim of DIMENSIONS) {
    const arr = (seoTags[dim] || []) as string[];
    for (const slug of arr) {
      const entry = findTagBySlug(dim, slug);
      result.push({
        slug,
        label: entry?.labelRu ?? slug,
        href: entry ? entry.urlPath : null,
      });
    }
  }
  return result;
}

function buildDescription(data: Awaited<ReturnType<typeof getCardPageData>>): string {
  if (!data) return "Готовый промт для генерации фото ИИ. Посмотри результат и скопируй.";
  const title = data.title_ru || data.title_en || "Промт";
  const tags = getSeoSlugsWithTags(data.seo_tags).map((t) => t.label);
  if (data.promptTexts.length > 0) {
    const excerpt = data.promptTexts[0].slice(0, 100).trim();
    const suffix = data.promptTexts[0].length > 100 ? "…" : "";
    return `Промт для фото: «${excerpt}${suffix}». Скопируй и создай фото в нейросети.`;
  }
  if (tags.length > 0) {
    return `Готовый промт «${title}» — ${tags.join(", ")}. Копируй и используй в ИИ.`;
  }
  return "Готовый промт для генерации фото ИИ. Посмотри результат и скопируй.";
}

function buildTitle(titleRu: string): string {
  const suffix = " — промт для фото ИИ | PromptShot";
  const maxLen = 60;
  if (titleRu.length + suffix.length <= maxLen) return `${titleRu}${suffix}`;
  return titleRu.slice(0, maxLen - suffix.length - 1).trim() + suffix;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCardPageData(slug);
  if (!data) return {};

  const title = data.title_ru || data.title_en || "Промт";
  const isThin = data.promptTexts.length === 0 && data.photoUrls.length === 0;
  const canonical = `${BASE_URL}/p/${data.slug}`;

  return {
    title: buildTitle(title),
    description: buildDescription(data),
    alternates: { canonical },
    openGraph: {
      title: buildTitle(title),
      description: buildDescription(data),
      url: canonical,
      type: "article",
      images: data.mainPhotoUrl ? [{ url: data.mainPhotoUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: buildTitle(title),
      description: buildDescription(data),
      images: data.mainPhotoUrl ? [data.mainPhotoUrl] : undefined,
    },
    robots: isThin ? "noindex, follow" : "index, follow",
  };
}

export default async function CardPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCardPageData(slug);

  if (!data) notFound();

  const title = data.title_ru || data.title_en || "Без названия";
  const hashtags = data.hashtags;
  const tagEntries = getSeoSlugsWithTags(data.seo_tags);
  const breadcrumbTag = getFirstTagFromSeoTags(data.seo_tags);
  const promptTexts = data.promptTexts;

  // JSON-LD CreativeWork
  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    description:
      data.promptTexts[0]?.slice(0, 150) ?? data.title_ru ?? "Промт для фото ИИ",
    image: data.mainPhotoUrl ?? undefined,
    url: `${BASE_URL}/p/${data.slug}`,
    datePublished: data.source_date ?? undefined,
    keywords: tagEntries.map((t) => t.label).join(", "),
    isPartOf: {
      "@type": "CollectionPage",
      name: "PromptShot — промты для фото ИИ",
      url: BASE_URL,
    },
  };

  // JSON-LD BreadcrumbList
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Главная", item: BASE_URL },
    ...(breadcrumbTag
      ? [
          {
            "@type": "ListItem",
            position: 2,
            name: breadcrumbTag.labelRu,
            item: `${BASE_URL}${breadcrumbTag.urlPath}`,
          },
          { "@type": "ListItem", position: 3, name: title, item: `${BASE_URL}/p/${data.slug}` },
        ]
      : [{ "@type": "ListItem", position: 2, name: title, item: `${BASE_URL}/p/${data.slug}` }]),
  ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  const safeJson = (obj: object) =>
    JSON.stringify(obj).replace(/</g, "\\u003c");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(creativeWorkLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbLd) }}
      />
      <Header />

      <main className="flex-1">
        {/* Hero photo */}
        <section className="relative bg-zinc-950">
          <div className="mx-auto max-w-5xl">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
              {data.mainPhotoUrl ? (
                <>
                  <Image
                    src={data.mainPhotoUrl}
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover scale-105 blur-3xl brightness-[0.3] saturate-150"
                    aria-hidden
                    priority
                  />
                  <Image
                    src={data.mainPhotoUrl}
                    alt={title}
                    fill
                    sizes="100vw"
                    className="object-contain relative"
                    priority
                  />
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600 text-sm">
                  Нет фото
                </div>
              )}

              {/* Before badge — flush to top-left */}
              {data.beforePhotoUrl && (
                <div className="absolute top-0 left-0 z-10 w-[18%] min-w-[100px] max-w-[180px]">
                  <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                    <Image src={data.beforePhotoUrl} alt="before" fill className="object-cover" sizes="180px" />
                    <div className="absolute inset-x-0 bottom-0 text-[10px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">
                      БЫЛО
                    </div>
                  </div>
                </div>
              )}

              {/* Photo count */}
              {data.photoUrls.length > 1 && (
                <div className="absolute top-4 right-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
                  {data.photoUrls.length} фото
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail strip */}
          {data.photoUrls.length > 1 && (
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-2 overflow-x-auto">
              {data.photoUrls.map((url, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                    i === 0 ? "border-white/80" : "border-white/20 hover:border-white/50"
                  }`}
                >
                  <Image
                    src={url}
                    alt={`${title} ${i + 1}`}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Content */}
        <section className="mx-auto max-w-3xl px-5 py-10">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400">
            <Link href="/" className="transition-colors hover:text-zinc-700">Главная</Link>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-300"><path d="M9 18l6-6-6-6"/></svg>
            {breadcrumbTag ? (
              <>
                <Link href={breadcrumbTag.urlPath} className="transition-colors hover:text-zinc-700">
                  {breadcrumbTag.labelRu}
                </Link>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-300"><path d="M9 18l6-6-6-6"/></svg>
                <span className="text-zinc-600 line-clamp-1">{title}</span>
              </>
            ) : (
              <span className="text-zinc-600 line-clamp-1">{title}</span>
            )}
          </nav>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            {title}
          </h1>

          {/* Tags — clickable */}
          {tagEntries.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tagEntries.map(({ slug, label, href }) =>
                href ? (
                  <Link
                    key={slug}
                    href={href}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={slug}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600"
                  >
                    {label}
                  </span>
                )
              )}
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="mt-3 text-sm text-zinc-400">
              {hashtags.map((h) => `#${String(h).replace(/^#/, "")}`).join("  ")}
            </div>
          )}

          {/* Prompt section */}
          {promptTexts.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900">Промпт</h2>
                <CopyPromptButton texts={promptTexts} />
              </div>

              <div className="space-y-3">
                {promptTexts.map((text, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap"
                  >
                    {text}
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <CopyPromptButton texts={promptTexts} variant="large" className="w-full sm:w-auto" />
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
