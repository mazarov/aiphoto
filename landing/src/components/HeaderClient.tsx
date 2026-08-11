"use client";

import { useEffect, useRef } from "react";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { syncHeaderHeightCssVar } from "@/lib/listing-header-offset";
import {
  LISTING_MOBILE_CHROME_INSET,
  LISTING_NAV_SHELL_SURFACE,
} from "@/lib/listing-shell-surface";
import { MobileCreditBalance, MobileUserMenu } from "./AccountControls";
import { ListingChromeButton, ListingMenuIcon } from "./ListingChromeButton";
import { SiteBrandLink } from "./SiteBrandLink";

function MobileCatalogMenuButton() {
  const chrome = useListingMobileChromeOptional();
  void chrome?.menuRevision;
  const openMenu = chrome?.menuOpenRef.current;

  if (!openMenu) return null;

  return (
    <ListingChromeButton variant="icon-sm" onClick={openMenu} aria-label="Каталог">
      <ListingMenuIcon />
    </ListingChromeButton>
  );
}

export function HeaderClient() {
  const headerRef = useRef<HTMLElement>(null);

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
      className={`sticky top-0 z-40 shrink-0 lg:hidden ${LISTING_NAV_SHELL_SURFACE}`}
    >
      <div
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${LISTING_MOBILE_CHROME_INSET}`}
      >
        <div className="flex shrink-0 justify-start">
          <MobileCatalogMenuButton />
        </div>
        <SiteBrandLink className="justify-center gap-1.5" />
        <div className="flex shrink-0 items-center justify-end gap-2">
          <MobileCreditBalance />
          <MobileUserMenu />
        </div>
      </div>
    </header>
  );
}
