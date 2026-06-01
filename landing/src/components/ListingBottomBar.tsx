"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListingSearchField } from "./ListingSearchField";
import { ListingChromeButton, ListingFilterIcon } from "./ListingChromeButton";
import { useListingMobileChrome } from "@/context/ListingMobileChromeContext";

export function ListingBottomBar() {
  const {
    searchMobileRef,
    searchMobileRevision,
    filterActiveCount,
    filterOpenRef,
    filterRevision,
  } = useListingMobileChrome();
  const [mounted, setMounted] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  void searchMobileRevision;
  void filterRevision;

  const search = searchMobileRef.current;
  const filterOpen = filterOpenRef.current;

  if (!mounted || !search || search.hideMobileBar) {
    return null;
  }

  const keyboardOpen = searchFocused;

  return createPortal(
    <div
      className={`listing-bottom-bar fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-8px_32px_-12px_rgba(99,102,241,0.1)] backdrop-blur-2xl lg:inset-x-auto lg:left-60 lg:right-0 ${
        keyboardOpen
          ? "border-indigo-100/80 bg-white/95"
          : "border-indigo-100/60 bg-white/75"
      }`}
      style={{
        paddingBottom: keyboardOpen ? "0.5rem" : undefined,
      }}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2.5 lg:gap-3 lg:px-5 lg:pt-3">
        <ListingSearchField
          className="min-w-0 flex-1"
          size="compact"
          value={search.value}
          onChange={search.onChange}
          onClear={search.onClear}
          onKeyDown={search.onKeyDown}
          onFocus={() => {
            setSearchFocused(true);
            search.onFocus?.();
          }}
          onBlur={() => setSearchFocused(false)}
          placeholder={search.placeholder}
          inputRef={search.inputRef}
          accent="compact"
          loading={search.loading}
          enterKeyHint="search"
        />

        {filterOpen && (
          <ListingChromeButton
            variant="icon-md"
            active={filterActiveCount > 0}
            onClick={filterOpen}
            aria-label={
              filterActiveCount > 0
                ? `Фильтры (${filterActiveCount})`
                : "Фильтры"
            }
          >
            {filterActiveCount > 0 ? (
              <span className="text-sm font-semibold tabular-nums">{filterActiveCount}</span>
            ) : (
              <ListingFilterIcon />
            )}
          </ListingChromeButton>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** @deprecated Use ListingBottomBar */
export const ListingMobileBottomBar = ListingBottomBar;
