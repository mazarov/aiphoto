"use client";

import { useEffect, useRef } from "react";
import { useOpenMobileSearchEntry } from "@/context/ListingMobileChromeContext";
import { useAuth } from "@/context/AuthContext";
import { syncHeaderHeightCssVar } from "@/lib/listing-header-offset";
import {
  LISTING_MOBILE_CHROME_INSET,
  LISTING_NAV_SHELL_SURFACE,
} from "@/lib/listing-shell-surface";
import { HeaderBalancePayChip } from "./AccountControls";
import { ListingChromeButton } from "./ListingChromeButton";
import { ListingSearchIcon } from "./ListingSearchField";
import { SiteBrandLink } from "./SiteBrandLink";

export function HeaderClient() {
  const headerRef = useRef<HTMLElement>(null);
  const openSearch = useOpenMobileSearchEntry();
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

  return (
    <header
      ref={headerRef}
      className={`listing-mobile-header sticky top-0 z-40 shrink-0 lg:hidden ${LISTING_NAV_SHELL_SURFACE}`}
    >
      <div
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${LISTING_MOBILE_CHROME_INSET}`}
      >
        <div className="flex shrink-0 justify-start">
          <ListingChromeButton variant="icon-sm" onClick={openSearch} aria-label="Поиск">
            <ListingSearchIcon className="h-5 w-5" />
          </ListingChromeButton>
        </div>
        <SiteBrandLink className="min-w-0 justify-center gap-1.5" />
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
