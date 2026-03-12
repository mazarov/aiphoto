"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CardPageData } from "@/lib/supabase";

type TagEntry = { slug: string; label: string; href: string | null };
type BreadcrumbTag = { labelRu: string; urlPath: string } | null;

type Props = {
  data: CardPageData;
  tagEntries: TagEntry[];
  breadcrumbTag: BreadcrumbTag;
};

export function CardPageClient({ data, tagEntries, breadcrumbTag }: Props) {
  const title = data.title_ru || data.title_en || "Без названия";

  const [photoIndex, setPhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const photos = data.photoUrls;
  const currentPhoto = photos[photoIndex] || null;

  const groupCards = useMemo(() => {
    if (data.siblings.length === 0) return [];
    const current = {
      id: data.id,
      slug: data.slug,
      title_ru: data.title_ru,
      card_split_index: data.card_split_index,
      mainPhotoUrl: data.mainPhotoUrl,
    };
    return [current, ...data.siblings].sort(
      (a, b) => a.card_split_index - b.card_split_index
    );
  }, [data]);

  function prevPhoto() {
    if (photos.length > 1) setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function nextPhoto() {
    if (photos.length > 1) setPhotoIndex((i) => (i + 1) % photos.length);
  }

  async function handleCopy() {
    const str = data.promptTexts.join("\n\n");
    if (!str) return;
    try {
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleCopySingle(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400">
        <Link href="/" className="transition-colors hover:text-zinc-700">
          Главная
        </Link>
        <Chevron />
        {breadcrumbTag ? (
          <>
            <Link
              href={breadcrumbTag.urlPath}
              className="transition-colors hover:text-zinc-700"
            >
              {breadcrumbTag.labelRu}
            </Link>
            <Chevron />
            <span className="text-zinc-600 line-clamp-1">{title}</span>
          </>
        ) : (
          <span className="text-zinc-600 line-clamp-1">{title}</span>
        )}
      </nav>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row lg:gap-12 xl:gap-16">
        {/* ── Left: Photo Card — 1:1 from PromptCard listing ── */}
        <div className="lg:w-[55%] xl:w-[58%] lg:flex-shrink-0">
          <article className="group relative overflow-hidden rounded-2xl">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200">
              {/* Photo — object-cover, no blur layer */}
              {currentPhoto ? (
                <Image
                  src={currentPhoto}
                  alt={title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-zinc-100 text-zinc-400 text-sm">
                  Нет фото
                </div>
              )}

              {/* Arrow buttons — visible on hover */}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/60 active:scale-90"
                    aria-label="Previous photo"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-1.5 text-white opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 hover:bg-black/60 active:scale-90"
                    aria-label="Next photo"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </>
              )}

              {/* Before badge — flush to top-left corner */}
              {data.beforePhotoUrl && (
                <div className="absolute top-0 left-0 z-20 w-[28%] min-w-[72px]">
                  <div className="aspect-square relative bg-zinc-800 rounded-br-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                    <Image src={data.beforePhotoUrl} alt="before" fill className="object-cover" sizes="120px" />
                    <div className="absolute inset-x-0 bottom-0 text-[8px] text-white font-bold text-center py-0.5 bg-gradient-to-t from-black/70 to-transparent tracking-wider">
                      БЫЛО
                    </div>
                  </div>
                </div>
              )}

              {/* Top badges */}
              <div className="absolute top-3 left-3 right-3 z-20 flex items-start justify-between pointer-events-none">
                <div className="flex items-center gap-1.5">
                  {data.beforePhotoUrl && <div className="w-[28%] min-w-[72px]" />}
                  {data.card_split_total > 1 && (
                    <div className="rounded-full bg-indigo-500/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      {data.card_split_index + 1}/{data.card_split_total}
                    </div>
                  )}
                </div>
                {/* Photo counter */}
                {photos.length > 1 && (
                  <div className="rounded-full bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
                    {photoIndex + 1}/{photos.length}
                  </div>
                )}
              </div>

              {/* Photo dots */}
              {photos.length > 1 && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoIndex(i)}
                      className={`rounded-full transition-all ${
                        i === photoIndex
                          ? "w-2 h-2 bg-white shadow-sm"
                          : "w-1.5 h-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Bottom gradient overlay — title (h1) + tags */}
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-3.5 px-3.5">
                <h1 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-1.5">
                  {title}
                </h1>
                {tagEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1 pointer-events-auto">
                    {tagEntries.map(({ slug, label, href }) =>
                      href ? (
                        <Link
                          key={slug}
                          href={href}
                          className="rounded-full bg-white/15 backdrop-blur-md px-2 py-0.5 text-[10px] text-white/80 transition-colors hover:bg-white/25"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span
                          key={slug}
                          className="rounded-full bg-white/15 backdrop-blur-md px-2 py-0.5 text-[10px] text-white/80"
                        >
                          {label}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Group navigation tabs — below the card */}
          {groupCards.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {groupCards.map((card) => {
                const isActive = card.id === data.id;
                return (
                  <Link
                    key={card.id}
                    href={`/p/${card.slug}`}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all flex-shrink-0 ${
                      isActive
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    {card.mainPhotoUrl && (
                      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={card.mainPhotoUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        isActive ? "text-indigo-700" : "text-zinc-600"
                      }`}
                    >
                      Вариант {card.card_split_index + 1}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Content ── */}
        <div className="mt-8 lg:mt-0 lg:flex-1">
          <div className="lg:sticky lg:top-8">
            {/* Prompt section — first */}
            {data.promptTexts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {data.promptTexts.length > 1 ? "Промпты" : "Промпт"}
                  </h2>
                </div>

                <div className="space-y-3">
                  {data.promptTexts.map((text, i) => (
                    <div
                      key={i}
                      className="group/prompt relative rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                    >
                      {data.promptTexts.length > 1 && (
                        <div className="mb-2 text-[11px] font-medium text-zinc-400">
                          Вариант {i + 1}
                        </div>
                      )}
                      <div className="font-mono text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                        {text}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopySingle(text)}
                        className="absolute top-3 right-3 rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 opacity-0 shadow-sm transition-all group-hover/prompt:opacity-100 hover:text-zinc-700 hover:border-zinc-300"
                        title="Скопировать"
                      >
                        <CopyIcon size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Copy CTA */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md active:scale-[0.98]"
                  >
                    {copied ? (
                      <>
                        <CheckIcon size={16} />
                        Скопировано!
                      </>
                    ) : (
                      <>
                        <CopyIcon size={16} />
                        {data.promptTexts.length > 1
                          ? "Скопировать все промпты"
                          : "Скопировать промпт"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Hashtags */}
            {data.hashtags.length > 0 && (
              <div className="mt-8 text-sm text-zinc-400">
                {data.hashtags
                  .map((h) => `#${String(h).replace(/^#/, "")}`)
                  .join("  ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="flex-shrink-0 text-zinc-300"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
