"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyCountsToMenu } from "@/lib/menu";
import { LISTING_SCROLL_ROOT_ID, useStandalonePageScrollTop } from "@/lib/scroll-preservation";
import { ListingMobileChromeProvider } from "@/context/ListingMobileChromeContext";
import { HeaderClient } from "./HeaderClient";
import { SidebarNav } from "./SidebarNav";
import { Footer } from "./Footer";
import { ListingBottomBar } from "./ListingBottomBar";
import { ListingSearch } from "./ListingSearch";

const MENU_STRUCTURE = applyCountsToMenu({});

export function PageLayout({
  children,
  hideBottomBar = false,
}: {
  children: React.ReactNode;
  hideBottomBar?: boolean;
}) {
  const pathname = usePathname();
  useStandalonePageScrollTop(pathname);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      document.documentElement.classList.toggle("listing-mobile-shell", mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.documentElement.classList.remove("listing-mobile-shell");
    };
  }, []);

  return (
    <ListingMobileChromeProvider>
      <div className="max-lg:flex max-lg:h-dvh max-lg:max-h-dvh max-lg:flex-col max-lg:overflow-hidden lg:contents">
        <HeaderClient />

        <div
          id={LISTING_SCROLL_ROOT_ID}
          className="listing-scroll-root max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:[-webkit-overflow-scrolling:touch]"
        >
          <div className="flex min-h-0 lg:min-h-[calc(100vh-57px)]">
            <SidebarNav menu={MENU_STRUCTURE} />
            <div className="flex min-w-0 flex-1 flex-col">
              {children}
              <Footer />
            </div>
          </div>
        </div>

        {!hideBottomBar ? <ListingBottomBar /> : null}

        <Suspense fallback={null}>
          <ListingSearch variant="header" />
        </Suspense>
      </div>
    </ListingMobileChromeProvider>
  );
}
