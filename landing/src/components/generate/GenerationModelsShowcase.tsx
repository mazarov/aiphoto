"use client";

import { useState } from "react";
import {
  displayDescriptionForGenerationModel,
  displayLabelForGenerationModel,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { ComposeModelChoiceCard } from "@/components/generate/ComposeModelChoiceCard";
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
        className={`grid grid-cols-1 gap-x-2 gap-y-5 sm:grid-cols-2 ${GF_STACK}`}
        role="list"
        aria-label="Модели ИИ для генерации фото"
      >
        {models.map((item) => {
          const selected = selectedModelId === item.id;
          return (
            <div key={item.id} role="listitem">
              <ComposeModelChoiceCard
                modelId={item.id}
                label={displayLabelForGenerationModel(item.id, item.label)}
                description={displayDescriptionForGenerationModel(
                  item.id,
                  "Генерация изображений"
                )}
                cost={item.cost}
                selected={selected}
                onClick={() => {
                  requestModelSelection(item.id, {
                    entrySource: "route",
                    dockSurface: "model",
                  });
                  setSelectedModelId(item.id);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
