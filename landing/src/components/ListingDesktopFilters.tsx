"use client";

import { useCallback, useEffect, useState } from "react";
import { findTagBySlug, type Dimension } from "@/lib/tag-registry";
import type { FilterState } from "@/hooks/useListingFilters";
import { useListingFilterCounts } from "@/hooks/useListingFilterCounts";
import { FilterChips } from "./FilterChips";
import { ListingSortToggle } from "./ListingSortToggle";
import type { PromptCardFull } from "@/lib/supabase";
import type { ListingSort } from "@/lib/listing-sort";
import {
  FILTER_CHROME_SURFACE,
  FILTER_ICON_BTN,
  FILTER_MODAL_BACKDROP,
  FILTER_MODAL_BODY,
  FILTER_MODAL_FOOTER,
  FILTER_MODAL_HEADER,
  FILTER_MODAL_LAYOUT,
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
  sort?: ListingSort;
  onSortChange?: (sort: ListingSort) => void;
  onOpenMobileFilters?: () => void;
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

function FilterLinesIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function formatButtonLabel(dimLabel: string, selectedSlug: string | null, dim: Dimension): string {
  if (!selectedSlug) return dimLabel;
  const tag = findTagBySlug(dim, selectedSlug);
  return tag ? `${dimLabel}: ${tag.labelRu}` : dimLabel;
}

/** Unified catalog toolbar: tag filters + sort in one chrome block. */
export function ListingDesktopFilters({
  filters,
  onSetFilter,
  onReset,
  activeCount,
  hiddenDimensions,
  rpcParams,
  cardsForCounts,
  sort,
  onSortChange,
  onOpenMobileFilters,
}: Props) {
  const [openKey, setOpenKey] = useState<keyof FilterState | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const { getTagsWithCounts } = useListingFilterCounts({ rpcParams, cardsForCounts });

  const dimsToShow = DIMENSION_ORDER.filter(
    (k) => !hiddenDimensions.includes(DIM_TO_DIMENSION[k])
  );

  const hasMobileFilters = dimsToShow.some((key) => {
    const dim = DIM_TO_DIMENSION[key];
    const selectedSlug = filters[key];
    const { tags } = getTagsWithCounts(dim, selectedSlug);
    return tags.length > 0 || selectedSlug != null;
  });

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
      <div
        className={`mb-5 rounded-2xl px-3 py-2.5 sm:px-4 ${FILTER_CHROME_SURFACE}`}
        role="toolbar"
        aria-label="Фильтры и сортировка каталога"
      >
        <div className="flex flex-wrap items-center gap-2">
          {hasMobileFilters && onOpenMobileFilters && (
            <button
              type="button"
              onClick={onOpenMobileFilters}
              className={`lg:hidden ${FILTER_TRIGGER} ${activeCount > 0 ? FILTER_TRIGGER_ACTIVE : ""}`}
              aria-label={activeCount > 0 ? `Фильтры (${activeCount})` : "Фильтры"}
            >
              <FilterLinesIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              <span>Фильтры</span>
              {activeCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold tabular-nums text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
          )}

          <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex">
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
                  className={`${FILTER_TRIGGER} border-transparent bg-white/60 shadow-none hover:bg-white/90 ${isActive ? FILTER_TRIGGER_ACTIVE : ""}`}
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
              <button type="button" onClick={onReset} className={FILTER_RESET_LINK}>
                Сбросить
              </button>
            )}
          </div>

          <div className={`flex shrink-0 items-center gap-2 ${sort && onSortChange ? "ms-auto" : ""}`}>
            {activeCount > 0 && (
              <button type="button" onClick={onReset} className={`lg:hidden ${FILTER_RESET_LINK}`}>
                Сбросить
              </button>
            )}
            {sort && onSortChange ? (
              <ListingSortToggle sort={sort} onSortChange={onSortChange} embedded />
            ) : null}
          </div>
        </div>
      </div>

      {openKey && openTagsData && (
        <>
          <div
            className={`fixed inset-0 z-40 hidden lg:block ${FILTER_MODAL_BACKDROP}`}
            onClick={closeModal}
            aria-hidden
          />
          <div
            className={`fixed left-1/2 top-1/2 z-50 hidden max-h-[min(70vh,32rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 ${FILTER_MODAL_LAYOUT} ${FILTER_MODAL_SHELL} lg:flex`}
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

            <div className={`p-4 ${FILTER_MODAL_BODY}`}>
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
