"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ListingSearchField } from "./ListingSearchField";
import { ListingChromeButton, ListingFilterIcon } from "./ListingChromeButton";
import { useListingMobileChrome } from "@/context/ListingMobileChromeContext";
import { LISTING_BOTTOM_BAR_SURFACE } from "@/lib/listing-shell-surface";

export function ListingBottomBar() {
  const {
    searchMobileRef,
    searchMobileRevision,
    filterActiveCount,
    filterOpenRef,
    filterRevision,
  } = useListingMobileChrome();
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  void searchMobileRevision;
  void filterRevision;

  const search = searchMobileRef.current;
  const filterOpen = filterOpenRef.current;

  if (!mounted || !isDesktop || !search || search.hideMobileBar) {
    return null;
  }

  const desktopBar = (
    <div
      className={`listing-bottom-bar fixed inset-x-0 bottom-0 z-40 ${LISTING_BOTTOM_BAR_SURFACE} lg:inset-x-auto lg:left-60 lg:right-0`}
    >
      <div className="listing-bottom-bar-inner flex min-h-[3.75rem] items-center gap-3 px-5 py-3">
        <ListingSearchField
          className="min-w-0 flex-1"
          size="compact"
          value={search.value}
          onChange={search.onChange}
          onClear={search.onClear}
          onKeyDown={search.onKeyDown}
          onFocus={search.onFocus}
          placeholder={search.placeholder}
          inputRef={search.inputRef}
          accent="compact"
          loading={search.loading}
          enterKeyHint="search"
        />

        {filterOpen ? (
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
        ) : null}
      </div>
    </div>
  );

  return createPortal(desktopBar, document.body);
}

/** @deprecated Use ListingBottomBar */
export const ListingMobileBottomBar = ListingBottomBar;
