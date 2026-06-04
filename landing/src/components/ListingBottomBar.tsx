"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ListingSearchField } from "./ListingSearchField";
import { ListingSearchDockTrigger } from "./ListingSearchDockTrigger";
import { ListingChromeButton, ListingFilterIcon } from "./ListingChromeButton";
import { focusMobileSearchInput, ListingMobileSearchSheet } from "./ListingMobileSearchSheet";
import { useListingMobileChrome } from "@/context/ListingMobileChromeContext";
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";
import { LISTING_BOTTOM_BAR_SURFACE } from "@/lib/listing-shell-surface";

export function ListingBottomBar() {
  const {
    searchMobileRef,
    searchMobileRevision,
    filterActiveCount,
    filterOpenRef,
    filterRevision,
    registerMobileSearchOpen,
  } = useListingMobileChrome();
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const openSheet = useCallback(() => {
    flushSync(() => setSheetOpen(true));
    focusMobileSearchInput(sheetInputRef.current);
    requestAnimationFrame(() => focusMobileSearchInput(sheetInputRef.current));
    bumpListingShellViewportHeight();
  }, []);
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    bumpListingShellViewportHeight();
  }, []);

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

  useEffect(() => {
    registerMobileSearchOpen(openSheet);
    return () => registerMobileSearchOpen(null);
  }, [registerMobileSearchOpen, openSheet]);

  void searchMobileRevision;
  void filterRevision;

  const search = searchMobileRef.current;
  const filterOpen = filterOpenRef.current;

  if (!mounted || !search || search.hideMobileBar) {
    return null;
  }

  const barInner = (
    <div
      className={
        isDesktop
          ? `listing-bottom-bar fixed inset-x-0 bottom-0 z-40 ${LISTING_BOTTOM_BAR_SURFACE} lg:inset-x-auto lg:left-60 lg:right-0`
          : `listing-bottom-bar shrink-0 ${LISTING_BOTTOM_BAR_SURFACE} pb-[max(0px,env(safe-area-inset-bottom,0px))]`
      }
    >
      <div className="listing-bottom-bar-inner flex h-[3.75rem] items-center gap-2 px-3 lg:gap-3 lg:px-5 lg:h-auto lg:min-h-[3.75rem] lg:py-3">
        {isDesktop ? (
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
        ) : (
          <ListingSearchDockTrigger
            value={search.value}
            placeholder={search.placeholder}
            onOpen={openSheet}
            onClear={search.onClear}
          />
        )}

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
        ) : (
          <span className="inline-block h-11 w-11 shrink-0 lg:hidden" aria-hidden />
        )}
      </div>
    </div>
  );

  return (
    <>
      {isDesktop ? createPortal(barInner, document.body) : barInner}
      {!isDesktop && (
        <ListingMobileSearchSheet
          open={sheetOpen}
          onClose={closeSheet}
          search={search}
          filterOpen={filterOpen}
          filterActiveCount={filterActiveCount}
          inputRef={sheetInputRef}
        />
      )}
    </>
  );
}

/** @deprecated Use ListingBottomBar */
export const ListingMobileBottomBar = ListingBottomBar;
