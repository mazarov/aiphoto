"use client";

import { useEffect, useRef } from "react";
import { useOpenMobileCatalogMenu } from "@/context/ListingMobileChromeContext";
import { useAuth } from "@/context/AuthContext";
import { syncHeaderHeightCssVar } from "@/lib/listing-header-offset";
import {
  LISTING_MOBILE_CHROME_INSET,
  LISTING_NAV_SHELL_SURFACE,
} from "@/lib/listing-shell-surface";
import { HeaderBalancePayChip } from "./AccountControls";
import { ListingChromeButton, ListingMenuIcon } from "./ListingChromeButton";
import { SiteBrandLink } from "./SiteBrandLink";

export function HeaderClient() {
  const headerRef = useRef<HTMLElement>(null);
  const openMenu = useOpenMobileCatalogMenu();
  const { user, loading } = useAuth();
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      syncHeaderHeightCssVar(box?.blockSize ?? el.getBoundingClientRect().height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className={`listing-mobile-header sticky top-[var(--ps-unpaid-banner-height,0px)] z-40 shrink-0 lg:hidden ${LISTING_NAV_SHELL_SURFACE}`}
    >
      <div
        className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${LISTING_MOBILE_CHROME_INSET}`}
      >
        <div className="relative z-10 flex shrink-0 justify-start">
          <ListingChromeButton
            variant="icon-sm"
            onClick={openMenu}
            aria-label="Меню категорий"
          >
            <ListingMenuIcon className="h-5 w-5" />
          </ListingChromeButton>
        </div>
        <div className="relative z-10 min-h-10 min-w-0 pointer-events-none" />
        <div className="relative z-10 flex min-w-0 shrink-0 items-center justify-end">
          {loading ? (
            <div className="h-10 w-10" aria-hidden />
          ) : isAuthed ? (
            <HeaderBalancePayChip />
          ) : (
            <div className="h-10 w-10" aria-hidden />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] bottom-3 z-[1] flex items-center justify-center">
          <SiteBrandLink className="min-w-0 justify-center gap-1.5 pointer-events-auto" />
        </div>
      </div>
    </header>
  );
}
