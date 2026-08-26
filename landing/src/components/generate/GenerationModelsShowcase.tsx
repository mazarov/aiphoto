"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  displayDescriptionForGenerationModel,
  displayLabelForGenerationModel,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { previewFramesForGenerationModel } from "@/lib/generation-model-preview";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { CyclingPreviewImage } from "@/components/generate/CyclingPreviewImage";
import {
  LISTING_MASONRY_CAROUSEL_CARD_CLASS,
  LISTING_MASONRY_CAROUSEL_TRACK_CLASS,
} from "@/components/ListingMasonry";
import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";

const GLASS_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md";
const BRAND_CTA =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

function badgeForModel(modelId: string): string {
  if (modelId.includes("lite")) return "Экономно";
  if (modelId.includes("pro")) return "Макс. качество";
  if (modelId.includes("3.1")) return "Новая";
  return "Быстро";
}

function SparkleIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4 10-10" />
    </svg>
  );
}

function ArrowIcon({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {dir === "prev" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

export function GenerationModelsShowcase({
  models,
  previewImages,
  generationPreviewByModel,
}: {
  models: GenerationModelOption[];
  previewImages: string[];
  generationPreviewByModel: Record<string, string>;
}) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const { requestModelSelection } = useGenerateDock();
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const root = scrollerRef.current;
    if (!root) return;
    const card = root.querySelector("li");
    const gap = Number.parseFloat(getComputedStyle(root).columnGap) || 12;
    const step = (card?.getBoundingClientRect().width ?? 218) + gap;
    const max = root.scrollWidth - root.clientWidth;
    let next = root.scrollLeft + dir * step;
    if (next > max - 4) next = 0;
    if (next < 0) next = max;
    root.scrollTo({ left: next, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const id = window.setInterval(() => {
      const wrap = wrapRef.current;
      if (wrap?.matches(":hover") || wrap?.matches(":focus-within")) return;
      scrollByCard(1);
    }, 5000);

    return () => window.clearInterval(id);
  }, [scrollByCard]);

  if (!models.length) return null;

  return (
    <div className={GF_BLOCK}>
      <div>
        <p className={GF_EYEBROW}>Выбор модели</p>
        <h2 id="generation-models-heading" className={`mt-2 ${GF_H2}`}>
          Модели ИИ для генерации фото
        </h2>
        <p className={GF_LEAD}>
          Выберите скорость, детализацию и стоимость под свою задачу.
          Модель сразу переключится в генераторе.
        </p>
      </div>

      <div ref={wrapRef} className={`group/models relative ${GF_STACK}`}>
        <ul
          ref={scrollerRef}
          className={LISTING_MASONRY_CAROUSEL_TRACK_CLASS}
          aria-label="Модели ИИ для генерации фото"
        >
          {models.map((model, modelIndex) => {
            const latestGenerationPreview =
              generationPreviewByModel[model.id] ?? null;
            const frames = previewFramesForGenerationModel({
              modelId: model.id,
              latestGenerationPreview,
              catalogImages: previewImages,
              modelIndex,
            });
            const selected = selectedModelId === model.id;
            const label = displayLabelForGenerationModel(model.id, model.label);
            const description = displayDescriptionForGenerationModel(
              model.id,
              "Генерация изображений по промту"
            );

            return (
              <li
                key={model.id}
                className={LISTING_MASONRY_CAROUSEL_CARD_CLASS}
              >
                <article
                  className={`group/model relative min-h-48 w-full overflow-hidden rounded-2xl bg-zinc-900 transition duration-200 lg:min-h-[22rem] ${
                    selected
                      ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#f4f3ff]"
                      : "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10"
                  }`}
                >
                  {frames.length ? (
                    <CyclingPreviewImage
                      images={frames}
                      alt={`Пример результата ${label}`}
                      sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                      quality={60}
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-violet-950"
                      aria-hidden
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-2.5">
                    <span
                      className={GLASS_PILL}
                      title={
                        latestGenerationPreview
                          ? "Последняя генерация этой модели"
                          : "Пример из каталога"
                      }
                    >
                      {latestGenerationPreview ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-white animate-pulse"
                          aria-hidden
                        />
                      ) : null}
                      {badgeForModel(model.id)}
                      <span className="sr-only">
                        {latestGenerationPreview
                          ? "последняя генерация"
                          : "пример"}
                      </span>
                    </span>
                    <span className={GLASS_PILL}>{model.cost} кр.</span>
                  </div>

                  <div className="relative z-10 flex min-h-48 flex-col justify-end p-3 lg:min-h-[22rem]">
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-semibold leading-snug text-white">
                        {label}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/75">
                        {description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        requestModelSelection(model.id, {
                          entrySource: "route",
                          dockSurface: "model",
                        });
                        setSelectedModelId(model.id);
                      }}
                      className={`mt-3 ${BRAND_CTA}`}
                    >
                      {selected ? <CheckIcon /> : <SparkleIcon />}
                      {selected ? "Модель выбрана" : "Выбрать модель"}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700 sm:inline-flex"
          aria-label="Предыдущие модели"
        >
          <ArrowIcon dir="prev" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-indigo-200 hover:text-indigo-700 sm:inline-flex"
          aria-label="Следующие модели"
        >
          <ArrowIcon dir="next" />
        </button>
      </div>
    </div>
  );
}
