import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  createSupabaseServer,
  getStoragePublicUrl,
} from "@/lib/supabase";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type Props = { params: Promise<{ slug: string }> };

export default async function CardPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createSupabaseServer();

  const { data: card } = await supabase
    .from("prompt_cards")
    .select(
      "id,slug,title_ru,title_en,seo_tags,seo_readiness_score,is_published,source_dataset_slug,source_message_id,source_date,hashtags,parse_warnings"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!card) notFound();

  const [variantsRes, mediaRes, beforeRes] = await Promise.all([
    supabase
      .from("prompt_variants")
      .select("prompt_text_ru")
      .eq("card_id", card.id)
      .order("variant_index", { ascending: true }),
    supabase
      .from("prompt_card_media")
      .select("storage_bucket,storage_path")
      .eq("card_id", card.id)
      .eq("media_type", "photo"),
    supabase
      .from("prompt_card_before_media")
      .select("storage_bucket,storage_path")
      .eq("card_id", card.id)
      .maybeSingle(),
  ]);

  const promptTexts = (variantsRes.data || [])
    .map((v) => (v as { prompt_text_ru: string | null }).prompt_text_ru)
    .filter((t): t is string => !!t?.trim());

  const allMedia = (mediaRes.data || []) as {
    storage_bucket: string;
    storage_path: string;
  }[];
  const beforeMedia = beforeRes.data as {
    storage_bucket: string;
    storage_path: string;
  } | null;

  const filteredMedia = beforeMedia
    ? allMedia.filter(
        (m) =>
          !(
            m.storage_bucket === beforeMedia.storage_bucket &&
            m.storage_path === beforeMedia.storage_path
          )
      )
    : allMedia;

  const photoMeta = filteredMedia.map((m) => ({
    url: getStoragePublicUrl(m.storage_bucket, m.storage_path),
    bucket: m.storage_bucket,
    path: m.storage_path,
  }));
  const photoUrls = photoMeta.map((m) => m.url);
  const beforePhotoUrl = beforeMedia
    ? getStoragePublicUrl(beforeMedia.storage_bucket, beforeMedia.storage_path)
    : null;

  const title = card.title_ru || card.title_en || "Без названия";
  const hashtags = (card.hashtags as string[] | null) || [];
  const seoTags = card.seo_tags as Record<string, unknown> | null;
  const seoSlugs = seoTags
    ? [
        "audience_tag",
        "style_tag",
        "occasion_tag",
        "object_tag",
        "doc_task_tag",
      ].flatMap((d) => ((seoTags[d] || []) as string[]))
    : [];

  const mainPhoto = photoUrls[0] || null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <main className="flex-1">
        {/* Hero photo */}
        <section className="relative bg-zinc-950">
          <div className="mx-auto max-w-5xl">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden">
              {mainPhoto ? (
                <>
                  <Image
                    src={mainPhoto}
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover scale-105 blur-3xl brightness-[0.3] saturate-150"
                    aria-hidden
                    priority
                  />
                  <Image
                    src={mainPhoto}
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

              {/* Before badge */}
              {beforePhotoUrl && (
                <div className="absolute left-4 bottom-4 w-16 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl backdrop-blur-sm">
                  <div className="text-[10px] text-white/80 text-center py-0.5 bg-black/40 border-b border-white/10">
                    Было
                  </div>
                  <div className="aspect-square relative">
                    <Image src={beforePhotoUrl} alt="before" fill className="object-cover" sizes="64px" />
                  </div>
                </div>
              )}

              {/* Photo count */}
              {photoUrls.length > 1 && (
                <div className="absolute top-4 right-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
                  {photoUrls.length} фото
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail strip */}
          {photoUrls.length > 1 && (
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-2 overflow-x-auto">
              {photoUrls.map((url, i) => (
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
            <span className="text-zinc-600 line-clamp-1">{title}</span>
          </nav>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            {title}
          </h1>

          {/* Tags */}
          {seoSlugs.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {seoSlugs.map((slug) => (
                <span
                  key={slug}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200"
                >
                  {slug}
                </span>
              ))}
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="mt-3 text-sm text-zinc-400">
              {hashtags.map((h) => `#${h.replace(/^#/, "")}`).join("  ")}
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
