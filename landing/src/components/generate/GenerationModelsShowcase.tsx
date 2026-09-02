"use client";

import { useState } from "react";
import {
  displayDescriptionForGenerationModel,
  displayLabelForGenerationModel,
  isNanoBananaFamilyModel,
  type GenerationModelOption,
} from "@/lib/generation-model-labels";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { ComposeModelChoiceCard } from "@/components/generate/ComposeModelChoiceCard";
import { GenerationModelShowcaseChip } from "@/components/generate/GenerationModelShowcaseChip";
import { GoogleGenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
} from "@/components/generate/generaciya-foto-ui";

export function GenerationModelsShowcase({
  models,
  eyebrow = "Выбор модели",
  title = "Модели ИИ для генерации фото",
  lead = "Выберите модель для генерации фото: скорость, детализация и цена. Она сразу включится в генераторе.",
  layout = "cards",
  nanoBananaHref,
  googleBranded = false,
}: {
  models: GenerationModelOption[];
  eyebrow?: string;
  title?: string;
  lead?: string;
  layout?: "cards" | "chips";
  nanoBananaHref?: string;
  googleBranded?: boolean;
}) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const { requestModelSelection } = useGenerateDock();

  if (!models.length) return null;

  const selectModel = (modelId: string) => {
    requestModelSelection(modelId, {
      entrySource: "route",
      dockSurface: "model",
    });
    setSelectedModelId(modelId);
  };

  return (
    <div className={GF_BLOCK}>
      <div>
        {googleBranded ? (
          <p className={`inline-flex items-center gap-1.5 ${GF_EYEBROW}`}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-indigo-100">
              <GoogleGenerationModelIcon className="h-3.5 w-3.5" />
            </span>
            {eyebrow}
          </p>
        ) : (
          <p className={GF_EYEBROW}>{eyebrow}</p>
        )}
        <h2 id="generation-models-heading" className={`mt-2 ${GF_H2}`}>
          {title}
        </h2>
        <p className={GF_LEAD}>{lead}</p>
      </div>

      {layout === "chips" ? (
        <div
          className={`grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 ${GF_STACK}`}
          role="list"
          aria-label={title}
        >
          {models.map((item) => {
            const href =
              nanoBananaHref && isNanoBananaFamilyModel(item.id, item.label)
                ? nanoBananaHref
                : undefined;
            return (
              <div key={item.id} role="listitem" className="min-h-[5rem]">
                <GenerationModelShowcaseChip
                  modelId={item.id}
                  label={displayLabelForGenerationModel(item.id, item.label)}
                  description={displayDescriptionForGenerationModel(
                    item.id,
                    "Генерация изображений"
                  )}
                  cost={item.cost}
                  selected={selectedModelId === item.id}
                  href={href}
                  onClick={href ? undefined : () => selectModel(item.id)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-x-2 gap-y-5 sm:grid-cols-2 ${GF_STACK}`}
          role="list"
          aria-label={title}
        >
          {models.map((item) => {
            const selected = selectedModelId === item.id;
            const href =
              nanoBananaHref && isNanoBananaFamilyModel(item.id, item.label)
                ? nanoBananaHref
                : undefined;
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
                  href={href}
                  onClick={href ? undefined : () => selectModel(item.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
