"use client";

import { useCallback, useEffect, useState } from "react";
import { findTagBySlug, type Dimension } from "@/lib/tag-registry";
import type { FilterState } from "@/hooks/useListingFilters";
import { useListingFilterCounts } from "@/hooks/useListingFilterCounts";
import { FilterChips } from "./FilterChips";
import type { PromptCardFull } from "@/lib/supabase";
import {
  FILTER_ICON_BTN,
  FILTER_MODAL_BACKDROP,
  FILTER_MODAL_FOOTER,
  FILTER_MODAL_HEADER,
  FILTER_MODAL_SHELL,
  FILTER_PRIMARY_BTN,
  FILTER_RESET_LINK,
  FILTER_TRIGGER,
  FILTER_TRIGGER_ACTIVE,
} from "@/lib/listing-filter-styles";

const DIMENSION_UI_LABELS: Record<string, string> = {
  audience_tag: "Кто на фото",
  style_tag: "Стиль",
  occasion_tag: "Событие",
  object_tag: "Сцена",
};

const DIMENSION_ORDER: (keyof FilterState)[] = ["audience", "style", "occasion", "object"];
const DIM_TO_DIMENSION: Record<keyof FilterState, Dimension> = {
  audience: "audience_tag",
  style: "style_tag",
  occasion: "occasion_tag",
  object: "object_tag",
};

const SEARCH_MIN_TAGS = 10;

type Props = {
  filters: FilterState;
  onSetFilter: (key: keyof FilterState, value: string | null) => void;
  onReset: () => void;
  activeCount: number;
  hiddenDimensions: Dimension[];
  rpcParams?: Record<string, string | null>;
  cardsForCounts?: PromptCardFull[];
};

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function formatButtonLabel(dimLabel: string, selectedSlug: string | null, dim: Dimension): string {
  if (!selectedSlug) return dimLabel;
  const tag = findTagBySlug(dim, selectedSlug);
  return tag ? `${dimLabel}: ${tag.labelRu}` : dimLabel;
}

export function ListingDesktopFilters({
  filters,
  onSetFilter,
  onReset,
  activeCount,
  hiddenDimensions,
  rpcParams,
  cardsForCounts,
}: Props) {
  const [openKey, setOpenKey] = useState<keyof FilterState | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const { getTagsWithCounts } = useListingFilterCounts({ rpcParams, cardsForCounts });

  const dimsToShow = DIMENSION_ORDER.filter(
    (k) => !hiddenDimensions.includes(DIM_TO_DIMENSION[k])
  );

  const closeModal = useCallback(() => {
    setOpenKey(null);
    setModalSearch("");
  }, []);

  useEffect(() => {
    if (!openKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openKey, closeModal]);

  const openDim = openKey ? DIM_TO_DIMENSION[openKey] : null;
  const openLabel = openDim ? (DIMENSION_UI_LABELS[openDim] ?? openDim) : "";
  const openSelectedSlug = openKey ? filters[openKey] : null;
  const openTagsData =
    openKey && openDim ? getTagsWithCounts(openDim, openSelectedSlug) : null;

  const handleSelect = (slug: string | null) => {
    if (!openKey) return;
    onSetFilter(openKey, slug);
    closeModal();
  };

  return (
    <>
      <div className="mb-5 hidden flex-wrap items-center gap-2 lg:flex">
        {dimsToShow.map((key) => {
          const dim = DIM_TO_DIMENSION[key];
          const label = DIMENSION_UI_LABELS[dim] ?? dim;
          const selectedSlug = filters[key];
          const { tags } = getTagsWithCounts(dim, selectedSlug);

          if (tags.length === 0 && !selectedSlug) return null;

          const isActive = selectedSlug != null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setModalSearch("");
                setOpenKey(key);
              }}
              className={`${FILTER_TRIGGER} ${isActive ? FILTER_TRIGGER_ACTIVE : ""}`}
              aria-expanded={openKey === key}
              aria-haspopup="dialog"
            >
              <span>{formatButtonLabel(label, selectedSlug, dim)}</span>
              <ChevronDownIcon
                className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-500/80" : "text-zinc-400"}`}
              />
            </button>
          );
        })}

        {activeCount > 0 && (
          <button type="button" onClick={onReset} className={`ml-0.5 ${FILTER_RESET_LINK}`}>
            Сбросить
          </button>
        )}
      </div>

      {openKey && openTagsData && (
        <>
          <div
            className={`fixed inset-0 z-40 hidden lg:block ${FILTER_MODAL_BACKDROP}`}
            onClick={closeModal}
            aria-hidden
          />
          <div
            className={`fixed left-1/2 top-1/2 z-50 hidden max-h-[min(70vh,32rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 ${FILTER_MODAL_SHELL} lg:block`}
            role="dialog"
            aria-modal="true"
            aria-label={openLabel}
          >
            <div className={FILTER_MODAL_HEADER}>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">{openLabel}</h2>
              <button
                type="button"
                onClick={closeModal}
                className={FILTER_ICON_BTN}
                aria-label="Закрыть"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              <FilterChips
                tags={openTagsData.tags}
                selectedSlug={openSelectedSlug}
                onSelect={handleSelect}
                searchQuery={modalSearch}
                onSearchChange={setModalSearch}
                searchPlaceholder={`Найти в «${openLabel.toLowerCase()}»...`}
                countBySlug={
                  Object.keys(openTagsData.countBySlug).length > 0
                    ? openTagsData.countBySlug
                    : undefined
                }
                searchMinCount={SEARCH_MIN_TAGS}
              />
            </div>

            <div className={FILTER_MODAL_FOOTER}>
              <button type="button" onClick={closeModal} className={`w-full ${FILTER_PRIMARY_BTN}`}>
                Готово
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
