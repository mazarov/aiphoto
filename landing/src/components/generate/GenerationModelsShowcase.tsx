"use client";

import { useState } from "react";
import {
  GENERATION_MODEL_DISPLAY,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { CyclingPreviewImage } from "@/components/generate/CyclingPreviewImage";

function badgeForModel(modelId: string): string {
  if (modelId.includes("lite")) return "Экономно";
  if (modelId.includes("pro")) return "Макс. качество";
  if (modelId.includes("3.1")) return "Новая";
  return "Быстро";
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
  const { user, openAuthModal } = useAuth();
  const { requestModelSelection } = useGenerateDock();

  if (!models.length) return null;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-indigo-100/90 bg-[linear-gradient(145deg,#f2f1ff_0%,#ffffff_48%,#faf7ff_100%)] px-3 py-6 text-zinc-900 shadow-[0_28px_80px_-46px_rgba(79,70,229,0.45)] sm:px-5 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Выбор модели
          </p>
          <h2
            id="generation-models-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          >
            Модели ИИ для генерации фото
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
            Выберите скорость, детализацию и стоимость под свою задачу.
            Модель сразу переключится в генераторе.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-medium text-indigo-700">
          Фото
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
        {models.map((model, modelIndex) => {
          const display = GENERATION_MODEL_DISPLAY[model.id];
          const latestGenerationPreview =
            generationPreviewByModel[model.id] ?? null;
          const frames = latestGenerationPreview
            ? [latestGenerationPreview]
            : previewImages.length
              ? Array.from(
                  { length: Math.min(3, previewImages.length) },
                  (_, frameIndex) =>
                    previewImages[
                      (modelIndex * 2 + frameIndex) % previewImages.length
                    ]
                )
              : [];
          const selected = selectedModelId === model.id;

          return (
            <article
              key={model.id}
              className={`group/model relative min-h-48 w-full overflow-hidden rounded-2xl border bg-indigo-950 transition duration-300 lg:min-h-[22rem] ${
                selected
                  ? "border-indigo-400 shadow-[0_0_0_1px_rgba(129,140,248,0.25),0_18px_45px_-24px_rgba(99,102,241,0.55)]"
                  : "border-indigo-100 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/70"
              }`}
            >
              <CyclingPreviewImage
                images={frames}
                alt={`Пример результата ${model.label}`}
                sizes="(max-width: 639px) calc(100vw - 3rem), (max-width: 1023px) 50vw, 25vw"
                quality={60}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-indigo-950/20 to-zinc-950/20" />

              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3">
                <span className="rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-xs font-semibold text-indigo-950 backdrop-blur-md">
                  {badgeForModel(model.id)}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-xs font-medium text-indigo-950 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-indigo-500 ${
                      latestGenerationPreview ? "animate-pulse" : ""
                    }`}
                  />
                  {latestGenerationPreview ? "Последняя генерация" : "Пример"}
                </span>
              </div>

              <div className="relative z-10 flex min-h-48 flex-col justify-end p-3 lg:min-h-[22rem] lg:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">
                      {model.label}
                    </h3>
                    <p className="mt-1 min-h-9 text-xs leading-relaxed text-white/75">
                      {display?.description || "Генерация изображений по промту"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                    {model.cost} кр.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!user || user.is_anonymous === true) {
                      openAuthModal();
                      return;
                    }
                    requestModelSelection(model.id, {
                      entrySource: "route",
                    });
                    setSelectedModelId(model.id);
                  }}
                  className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] ${
                    selected
                      ? "bg-indigo-500 text-white"
                      : "bg-white/90 text-indigo-700 hover:bg-white"
                  }`}
                >
                  {selected ? "Модель выбрана" : "Выбрать модель"}
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="m8 5 11 7-11 7V5Z" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
