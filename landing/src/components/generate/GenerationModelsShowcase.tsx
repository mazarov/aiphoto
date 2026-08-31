"use client";

import { useState } from "react";
import {
  displayLabelForGenerationModel,
  GENERATION_MODEL_DISPLAY,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";

export function GenerationModelsShowcase({
  models,
}: {
  models: GenerationModelOption[];
}) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const { requestModelSelection } = useGenerateDock();

  if (!models.length) return null;

  return (
    <div className={GF_BLOCK}>
      <div>
        <p className={GF_EYEBROW}>Выбор модели</p>
        <h2 id="generation-models-heading" className={`mt-2 ${GF_H2}`}>
          Модели ИИ для генерации фото
        </h2>
        <p className={GF_LEAD}>
          Выберите модель для генерации фото: скорость, детализация и цена.
          Она сразу включится в генераторе.
        </p>
      </div>

      <div
        className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${GF_STACK}`}
        role="list"
        aria-label="Модели ИИ для генерации фото"
      >
        {models.map((item) => {
          const selected = selectedModelId === item.id;
          const display = GENERATION_MODEL_DISPLAY[item.id];
          const label = displayLabelForGenerationModel(item.id, item.label);

          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              aria-pressed={selected}
              title={display?.description || item.label}
              onClick={() => {
                requestModelSelection(item.id, {
                  entrySource: "route",
                  dockSurface: "model",
                });
                setSelectedModelId(item.id);
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-20 min-w-0 items-center gap-3 rounded-xl p-3 text-left ring-2 transition ${
                selected
                  ? "bg-indigo-50 text-zinc-900 ring-indigo-500 shadow-sm"
                  : "bg-zinc-100 text-zinc-900 ring-zinc-200 hover:bg-zinc-200 hover:ring-zinc-300"
              }`}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
              >
                <GenerationModelIcon modelId={item.id} />
              </span>
              <span className="min-w-0 flex-1 pr-9">
                <span className="block truncate text-[13px] font-semibold leading-tight">
                  {label}
                </span>
                <span className="mt-1 block line-clamp-2 text-[13px] font-medium leading-tight text-zinc-500">
                  {display?.description || "Генерация изображений"}
                </span>
              </span>
              <GenerationCreditCostBadge
                cost={item.cost}
                className="absolute right-1.5 top-1.5"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
