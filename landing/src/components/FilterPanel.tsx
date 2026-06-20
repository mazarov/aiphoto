"use client";

import { useState, useEffect } from "react";
import { type Dimension } from "@/lib/tag-registry";
import { FilterChips } from "./FilterChips";
import { ListingSortToggle } from "./ListingSortToggle";
import type { FilterState } from "@/hooks/useListingFilters";
import { useListingFilterCounts } from "@/hooks/useListingFilterCounts";
import type { PromptCardFull } from "@/lib/supabase";
import type { ListingSort } from "@/lib/listing-sort";
import {
  FILTER_ICON_BTN,
  FILTER_MODAL_BACKDROP,
  FILTER_MODAL_BODY,
  FILTER_MODAL_FOOTER,
  FILTER_MODAL_HEADER,
  FILTER_MODAL_SHELL,
  FILTER_PRIMARY_BTN,
  FILTER_SECONDARY_BTN,
  FILTER_SECTION_LABEL,
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

const EMPTY_FILTERS: FilterState = {
  audience: null,
  style: null,
  occasion: null,
  object: null,
};

type Props = {
  filters: FilterState;
  onApply: (nextFilters: FilterState) => void;
  onClose: () => void;
  hiddenDimensions: Dimension[];
  rpcParams?: Record<string, string | null>;
  cardsForCounts?: PromptCardFull[];
  sort?: ListingSort;
  onSortChange?: (sort: ListingSort) => void;
};

export function FilterPanel({
  filters,
  onApply,
  onClose,
  hiddenDimensions,
  rpcParams,
  cardsForCounts,
  sort,
  onSortChange,
}: Props) {
  const [draft, setDraft] = useState<FilterState>(filters);
  const [objectSearch, setObjectSearch] = useState("");
  const { getTagsWithCounts } = useListingFilterCounts({ rpcParams, cardsForCounts });

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const dimsToShow = DIMENSION_ORDER.filter(
    (k) => !hiddenDimensions.includes(DIM_TO_DIMENSION[k])
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 ${FILTER_MODAL_BACKDROP}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fab-sheet-bottom-safe fixed right-4 z-50 max-h-[70vh] w-[calc(100vw-2rem)] max-w-md origin-bottom-right animate-scale-in sm:right-6 ${FILTER_MODAL_SHELL}`}
        role="dialog"
        aria-label="Фильтры"
      >
        <div className={FILTER_MODAL_HEADER}>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Фильтры</h2>
          <button
            type="button"
            onClick={onClose}
            className={FILTER_ICON_BTN}
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`space-y-6 p-4 ${FILTER_MODAL_BODY}`}>
          {sort != null && onSortChange && (
            <div className="border-b border-indigo-100/60 pb-5">
              <p className={FILTER_SECTION_LABEL}>Сортировка</p>
              <ListingSortToggle sort={sort} onSortChange={onSortChange} embedded />
            </div>
          )}

          {dimsToShow.map((key) => {
            const dim = DIM_TO_DIMENSION[key];
            const label = DIMENSION_UI_LABELS[dim] ?? dim;
            const selectedSlug = draft[key];
            const { tags, countBySlug } = getTagsWithCounts(dim, selectedSlug);

            return (
              <div key={key}>
                <p className={FILTER_SECTION_LABEL}>{label}</p>
                <FilterChips
                  tags={tags}
                  selectedSlug={selectedSlug}
                  onSelect={(slug) => setDraft((p) => ({ ...p, [key]: slug }))}
                  searchQuery={key === "object" ? objectSearch : undefined}
                  onSearchChange={key === "object" ? setObjectSearch : undefined}
                  searchPlaceholder="Найти сцену..."
                  countBySlug={Object.keys(countBySlug).length > 0 ? countBySlug : undefined}
                />
              </div>
            );
          })}
        </div>

        <div className={`flex gap-2 ${FILTER_MODAL_FOOTER}`}>
          <button
            type="button"
            onClick={() => {
              onApply(EMPTY_FILTERS);
              onClose();
            }}
            className={FILTER_SECONDARY_BTN}
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className={`flex-1 ${FILTER_PRIMARY_BTN}`}
          >
            Применить
          </button>
        </div>
      </div>
    </>
  );
}
