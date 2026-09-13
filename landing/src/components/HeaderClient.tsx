"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenMobileCatalogMenu, useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { useAuth } from "@/context/AuthContext";
import {
  holdListingChromeAutoHide,
  releaseListingChromeAutoHide,
} from "@/hooks/useListingChromeAutoHide";
import {
  PS_HEADER_HEIGHT_FALLBACK_PX,
  listingHeaderOverlayHeightPx,
  listingMobileLogoVisible,
  listingMobileSearchHref,
  nextListingHeaderSpacerPx,
  readHeaderSpacerCssPx,
  syncHeaderHeightCssVar,
  syncHeaderSpacerCssVar,
} from "@/lib/listing-header-offset";
import { LISTING_MOBILE_HEADER_SEARCH_ID } from "@/lib/listing-mobile-search-focus";
import { LISTING_MOBILE_CHROME_INSET } from "@/lib/listing-shell-surface";
import { listingHeaderTrailingKind } from "@/lib/promptshot-auth";
import { SEARCH_PLACEHOLDERS } from "@/lib/search-suggestions";
import { HeaderBalancePayChip, HeaderGuestTariffsLink } from "./AccountControls";
import { ListingChromeButton, ListingMenuIcon } from "./ListingChromeButton";
import { ListingSearchField } from "./ListingSearchField";
import { SiteBrandLink } from "./SiteBrandLink";

const HEADER_SEARCH_HOLD = "header-search";

function MobileHeaderSearchField() {
  const chrome = useListingMobileChromeOptional();
  void chrome?.searchMobileRevision;
  const search = chrome?.searchMobileRef.current ?? null;
  const router = useRouter();
  const localRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState("");

  const value = search?.value ?? localQuery;
  const inputRef = search?.inputRef ?? localRef;

  const submitSearch = () => {
    const href = listingMobileSearchHref(inputRef.current?.value || value);
    if (href) router.push(href);
  };

  useEffect(() => {
    return () => releaseListingChromeAutoHide(HEADER_SEARCH_HOLD);
  }, []);

  return (
    <form
      className="min-w-0"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch();
      }}
    >
      <ListingSearchField
        id={LISTING_MOBILE_HEADER_SEARCH_ID}
        className="min-w-0"
        size="toolbar"
        accent="headerBar"
        value={value}
        onChange={search?.onChange ?? setLocalQuery}
        onClear={search?.onClear ?? (() => setLocalQuery(""))}
        onKeyDown={
          search?.onKeyDown ??
          ((e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            submitSearch();
          })
        }
        onFocus={() => {
          holdListingChromeAutoHide(HEADER_SEARCH_HOLD);
          search?.onFocus();
        }}
        onBlur={() => releaseListingChromeAutoHide(HEADER_SEARCH_HOLD)}
        placeholder={search?.placeholder ?? SEARCH_PLACEHOLDERS.header}
        ariaLabel="Поиск"
        inputRef={inputRef}
        loading={search?.loading ?? false}
        enterKeyHint="search"
        inputMode="search"
        mobileSearch
      />
      <button type="submit" className="sr-only">
        Искать
      </button>
    </form>
  );
}

export function HeaderClient() {
  const headerRef = useRef<HTMLElement>(null);
  const openMenu = useOpenMobileCatalogMenu();
  const { user } = useAuth();
  const trailing = listingHeaderTrailingKind(user);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const sync = () => {
      const card = el.querySelector(".listing-mobile-header-card");
      const cardH =
        card instanceof HTMLElement ? card.getBoundingClientRect().height : 0;
      const cs = getComputedStyle(el);
      const measured = listingHeaderOverlayHeightPx({
        cardHeightPx: cardH,
        paddingTopPx: parseFloat(cs.paddingTop) || 0,
        paddingBottomPx: parseFloat(cs.paddingBottom) || 0,
        fallbackPx: el.getBoundingClientRect().height,
      });
      syncHeaderHeightCssVar(measured);
      const root = document.getElementById("listing-scroll-root");
      syncHeaderSpacerCssVar(
        nextListingHeaderSpacerPx({
          measuredPx: measured,
          currentSpacerPx: readHeaderSpacerCssPx() || PS_HEADER_HEIGHT_FALLBACK_PX,
          logoVisible: listingMobileLogoVisible(root?.scrollTop ?? 0),
        }),
      );
    };

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    const card = el.querySelector(".listing-mobile-header-card");
    if (card) observer.observe(card);
    sync();
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className="listing-mobile-header sticky top-[var(--ps-unpaid-banner-height,0px)] z-40 shrink-0 lg:hidden"
    >
      <div className="listing-mobile-header-card listing-mobile-header-surface">
        <div className="listing-mobile-header-brand">
          <div className="listing-mobile-header-brand-inner">
            <div className={`flex justify-center pb-1.5 pt-2 ${LISTING_MOBILE_CHROME_INSET}`}>
              <SiteBrandLink className="min-w-0 justify-center gap-1.5" markSize={24} />
            </div>
          </div>
        </div>
        <div
          className={`listing-mobile-header-search relative z-10 grid items-center gap-2 pb-2.5 pt-1 ${LISTING_MOBILE_CHROME_INSET} grid-cols-[auto_1fr_auto]`}
        >
          <div className="flex shrink-0 justify-start">
            <ListingChromeButton
              variant="icon-sm"
              onClick={openMenu}
              aria-label="Меню категорий"
            >
              <ListingMenuIcon className="h-5 w-5" />
            </ListingChromeButton>
          </div>
          <MobileHeaderSearchField />
          <div className="flex min-w-0 shrink-0 items-center justify-end">
            {trailing === "balance" ? (
              <HeaderBalancePayChip />
            ) : (
              <HeaderGuestTariffsLink />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
