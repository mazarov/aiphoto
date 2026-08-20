"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useListingFilters } from "@/hooks/useListingFilters";
import { useListingSort } from "@/hooks/useListingSort";
import { FilterFAB } from "./FilterFAB";
import { ListingDesktopFilters } from "./ListingDesktopFilters";
import { InfiniteGrid } from "./InfiniteGrid";
import { ListingExplorerFrame } from "./ListingExplorerFrame";
import {
  ListingExplorerHeading,
  ListingExplorerSearch,
} from "./ListingExplorerSearch";
import { ListingMasonry, ListingMasonryItem } from "./ListingMasonry";
import { ListingPhotoTile } from "./ListingPhotoTile";
import { ListingPromptCountBadge } from "./ListingPromptCountBadge";
import {
  toGenerationExampleCard,
  writeGenerationExampleNavigation,
} from "@/lib/generation/example-card";
import { listingPhotoAspectRatio } from "@/lib/listing-masonry";
import type { PromptCardFull } from "@/lib/supabase";
import type { Dimension } from "@/lib/tag-registry";
import type { ListingSort } from "@/lib/listing-sort";
import type { ReactNode } from "react";

const SEARCH_RESULT_LIMIT = 16;
const SEARCH_DEBOUNCE_MS = 500;

/** Stable React `key` — raw `JSON.stringify(mergedRpcParams)` can differ by object insertion order → remount grid on scroll/hydration churn. */
function stableListingKey(r: Record<string, string | null>, sort: ListingSort): string {
  const sortedKeys = Object.keys(r).sort();
  const norm: Record<string, string | null> = {};
  for (const k of sortedKeys) {
    norm[k] = r[k] ?? null;
  }
  return `${JSON.stringify(norm)}|${sort}`;
}

export type CatalogWithFiltersProps = {
  initialCards: PromptCardFull[];
  totalCount: number;
  /** Ranked rows returned by resolve_route_cards for the first page (before sibling expansion). */
  initialRankedBatchSize: number;
  baseRpcParams: Record<string, string | null>;
  lockedDimensions: Dimension[];
  heading: string;
  headingId?: string;
  eyebrow?: string;
  intro?: string;
  introSecondary?: string;
  afterIntro?: ReactNode;
  /**
   * When set, listing is always sorted this way: no sort toggle, no sessionStorage / `?sort=` sync.
   * Used by `/trends` (always `created_at` / sort=new).
   */
  fixedSort?: ListingSort;
  /** Rendered above the masonry — e.g. event cross-link chips. */
  preGrid?: ReactNode;
  /**
   * Birthday-cluster pages: masonry is hybrid listing search, not `resolve_route_cards`.
   * Category filters are hidden because they would switch the source back to tags.
   */
  listingSearchQuery?: string | null;
  listingSearchHasMore?: boolean;
};

export function CatalogWithFilters({
  initialCards,
  totalCount,
  initialRankedBatchSize,
  baseRpcParams,
  lockedDimensions,
  heading,
  headingId = "listing-explorer-heading",
  eyebrow,
  intro,
  introSecondary,
  afterIntro,
  fixedSort,
  preGrid,
  listingSearchQuery = null,
  listingSearchHasMore = false,
}: CatalogWithFiltersProps) {
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchCards, setSearchCards] = useState<PromptCardFull[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const { filters, setFilter, applyFilters, resetFilters, activeCount, mergedRpcParams } =
    useListingFilters({
      baseRpcParams,
      lockedDimensions,
    });
  const searchListing = Boolean(listingSearchQuery?.trim());
  const { sort: urlSort, setSort } = useListingSort({
    disabled: fixedSort != null || searchListing,
  });
  const sort = fixedSort ?? urlSort;
  const sortChangeHandler =
    fixedSort != null || searchListing ? undefined : setSort;

  const listingGridKey = useMemo(
    () =>
      `${stableListingKey(mergedRpcParams, sort)}|q:${listingSearchQuery?.trim() ?? ""}`,
    [mergedRpcParams, sort, listingSearchQuery]
  );

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!isSearching) {
      setSearchCards(null);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError("");
      void fetch(
        `/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${SEARCH_RESULT_LIMIT}`,
        { cache: "no-store", signal: controller.signal }
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("search_failed");
          const payload = (await response.json()) as { cards?: PromptCardFull[] };
          setSearchCards(payload.cards ?? []);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchCards([]);
          setSearchError("Не удалось загрузить подборку. Попробуйте ещё раз.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isSearching, trimmedQuery]);

  const showNewEmpty =
    !isSearching && !searchListing && sort === "new" && totalCount === 0;
  const searchExamples = useMemo(
    () => (searchCards ?? []).map(toGenerationExampleCard),
    [searchCards]
  );

  useLayoutEffect(() => {
    if (isSearching && searchExamples.length > 0) {
      writeGenerationExampleNavigation(searchExamples);
    }
  }, [isSearching, searchExamples]);

  return (
    <ListingExplorerFrame>
      <ListingExplorerHeading
        eyebrow={eyebrow}
        title={heading}
        titleAs="h1"
        titleId={headingId}
        intro={intro}
        introSecondary={introSecondary}
        afterIntro={afterIntro}
        collapseIntroOnMobile
        countBadge={
          !isSearching && !searchListing && totalCount > 0 ? (
            <ListingPromptCountBadge count={totalCount} />
          ) : null
        }
      />

      <ListingExplorerSearch
        id="listing-explorer-search"
        value={query}
        onChange={setQuery}
        onClear={() => setQuery("")}
        loading={searchLoading}
      />

      {searchListing ? null : (
        <ListingDesktopFilters
          variant="explorer"
          filters={filters}
          onSetFilter={setFilter}
          onReset={resetFilters}
          activeCount={activeCount}
          hiddenDimensions={lockedDimensions}
          rpcParams={mergedRpcParams}
          sort={sortChangeHandler ? sort : undefined}
          onSortChange={sortChangeHandler}
          onOpenMobileFilters={() => setFilterPanelOpen(true)}
        />
      )}

      {preGrid ? <div className="mt-3">{preGrid}</div> : null}

      <div className={`relative mt-5${isSearching ? " overflow-hidden" : ""}`}>
        {isSearching ? (
          <>
            <ListingMasonry loading={searchLoading}>
              {searchExamples.map((card, index) => (
                <ListingMasonryItem key={card.id}>
                  <ListingPhotoTile
                    card={card}
                    aspectRatio={listingPhotoAspectRatio(
                      card.photoWidth,
                      card.photoHeight,
                      index
                    )}
                  />
                </ListingMasonryItem>
              ))}
            </ListingMasonry>
            {searchExamples.length > 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
                <div
                  className="absolute inset-x-0 bottom-0 h-32 backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black,transparent)] sm:h-40"
                  aria-hidden
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/50 via-white/15 to-transparent sm:h-40"
                  aria-hidden
                />
                <div className="relative flex justify-center pb-4 pt-16 sm:pb-5 sm:pt-20">
                  <Link
                    href={`/search?q=${encodeURIComponent(trimmedQuery)}`}
                    className="pointer-events-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-sm transition hover:border-indigo-300 hover:bg-white"
                  >
                    Все результаты
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                </div>
              </div>
            ) : null}
            {!searchLoading && searchExamples.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center px-4 pb-8 text-center">
                <p className="text-base font-semibold text-zinc-900">
                  {searchError || "Подходящих промтов пока не найдено"}
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
                  Измените формулировку или сбросьте поиск.
                </p>
              </div>
            ) : null}
          </>
        ) : showNewEmpty ? (
          <p className="py-16 text-center text-sm text-zinc-500">Пока нет новых</p>
        ) : searchListing && initialCards.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Подходящих промтов пока не найдено
          </p>
        ) : (
          <InfiniteGrid
            key={listingGridKey}
            initialCards={initialCards}
            totalCount={totalCount}
            initialRankedBatchSize={initialRankedBatchSize}
            rpcParams={mergedRpcParams}
            strictMode={activeCount > 0}
            sort={sort}
            searchQuery={listingSearchQuery}
            searchHasMore={listingSearchHasMore}
          />
        )}
      </div>

      {searchListing ? null : (
        <FilterFAB
          filters={filters}
          activeCount={activeCount}
          onApply={applyFilters}
          hiddenDimensions={lockedDimensions}
          rpcParams={mergedRpcParams}
          open={filterPanelOpen}
          onOpenChange={setFilterPanelOpen}
          sort={sortChangeHandler ? sort : undefined}
          onSortChange={sortChangeHandler}
        />
      )}
    </ListingExplorerFrame>
  );
}
