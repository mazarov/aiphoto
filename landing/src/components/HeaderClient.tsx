"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  useListingMobileChromeOptional,
  useOpenMobileCatalogMenu,
  useOpenMobileSearchEntry,
} from "@/context/ListingMobileChromeContext";
import { useAuth } from "@/context/AuthContext";
import {
  holdListingChromeAutoHide,
  releaseListingChromeAutoHide,
} from "@/hooks/useListingChromeAutoHide";
import { syncHeaderHeightCssVar } from "@/lib/listing-header-offset";
import {
  LISTING_MOBILE_CHROME_INSET,
  LISTING_NAV_SHELL_SURFACE,
} from "@/lib/listing-shell-surface";
import { HeaderBalancePayChip } from "./AccountControls";
import { ListingChromeButton, ListingMenuIcon } from "./ListingChromeButton";
import { ListingSearchField, ListingSearchIcon } from "./ListingSearchField";
import { SiteBrandLink } from "./SiteBrandLink";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function HeaderClient() {
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const isCatalog = normalizePath(pathname || "/") === "/catalog";
  const openSearch = useOpenMobileSearchEntry();
  const openMenu = useOpenMobileCatalogMenu();
  const chrome = useListingMobileChromeOptional();
  void chrome?.catalogSearchRevision;
  const catalogSearch = chrome?.catalogSearchRef.current ?? null;
  const searchPinned = Boolean(
    isCatalog && chrome?.catalogSearchPinned && catalogSearch
  );
  const { user, loading } = useAuth();
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => syncHeaderHeightCssVar(el);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!searchPinned) return;
    holdListingChromeAutoHide("catalog-search");
    return () => releaseListingChromeAutoHide("catalog-search");
  }, [searchPinned]);

  return (
    <header
      ref={headerRef}
      className={`listing-mobile-header sticky top-0 z-40 shrink-0 lg:hidden ${LISTING_NAV_SHELL_SURFACE}`}
    >
      <div
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${LISTING_MOBILE_CHROME_INSET}`}
      >
        <div className="flex shrink-0 justify-start">
          {isCatalog ? (
            <ListingChromeButton
              variant="icon-sm"
              onClick={openMenu}
              aria-label="Меню категорий"
            >
              <ListingMenuIcon className="h-5 w-5" />
            </ListingChromeButton>
          ) : (
            <ListingChromeButton variant="icon-sm" onClick={openSearch} aria-label="Поиск">
              <ListingSearchIcon className="h-5 w-5" />
            </ListingChromeButton>
          )}
        </div>
        <div className="relative min-h-10 min-w-0">
          <SiteBrandLink
            className={`min-w-0 justify-center gap-1.5 transition-opacity duration-200 ${
              searchPinned ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          />
          {isCatalog && catalogSearch ? (
            <div
              className={`absolute inset-y-0 left-0 right-0 flex items-center transition-all duration-200 ${
                searchPinned
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-2 opacity-0"
              }`}
            >
              <ListingSearchField
                className="w-full"
                size="compact"
                accent="compact"
                mobileSearch
                value={catalogSearch.value}
                onChange={catalogSearch.onChange}
                onClear={catalogSearch.onClear}
                loading={catalogSearch.loading}
                placeholder="Найти промт, стиль или сюжет"
              />
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-end">
          {loading ? (
            <div className="h-10 w-10" aria-hidden />
          ) : isAuthed ? (
            <HeaderBalancePayChip />
          ) : (
            <div className="h-10 w-10" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}
