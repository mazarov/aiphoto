"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyCountsToMenu } from "@/lib/menu";
import { LISTING_SCROLL_ROOT_ID, useListingScrollOnRouteChange } from "@/lib/scroll-preservation";
import {
  bumpListingShellViewportHeight,
  useListingShellViewportSync,
} from "@/lib/listing-shell-viewport";
import { ListingMobileChromeProvider } from "@/context/ListingMobileChromeContext";
import {
  isGenerateDockListingPath,
} from "@/context/GenerateDockContext";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { GenerateListingDockHost } from "@/components/generate/GenerateListingDockHost";
import { HeaderClient } from "./HeaderClient";
import { SidebarNav } from "./SidebarNav";
import { Footer } from "./Footer";
import { ListingBottomBar } from "./ListingBottomBar";
import { MobileTabBar } from "./MobileTabBar";
import { ListingSearch } from "./ListingSearch";

const MENU_STRUCTURE = applyCountsToMenu({});

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { promptCardGenerationEnabled, loading: featureLoading } =
    useFeatureAccess();
  const showGenerateDock =
    !featureLoading &&
    promptCardGenerationEnabled &&
    isGenerateDockListingPath(pathname);
  useListingScrollOnRouteChange(pathname);
  useListingShellViewportSync();

  useEffect(() => {
    bumpListingShellViewportHeight();
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      document.documentElement.classList.toggle("listing-mobile-shell", mq.matches);
      if (!mq.matches) {
        document.documentElement.style.removeProperty("--ps-listing-shell-height");
      }
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
      <div className="listing-shell-root max-lg:relative max-lg:flex max-lg:h-dvh max-lg:max-h-dvh max-lg:flex-col max-lg:overflow-hidden lg:contents">
        <HeaderClient />

        <div
          id={LISTING_SCROLL_ROOT_ID}
          className={`listing-scroll-root max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:[-webkit-overflow-scrolling:touch] ${
            showGenerateDock
              ? "max-lg:pb-[calc(3.5rem+max(0px,env(safe-area-inset-bottom,0px))+12.5rem)] lg:pb-[min(42vh,22rem)]"
              : "max-lg:pb-[calc(3.5rem+max(0px,env(safe-area-inset-bottom,0px)))]"
          }`}
        >
          <div className="flex min-h-0 lg:min-h-[calc(100vh-57px)]">
            <SidebarNav menu={MENU_STRUCTURE} />
            <div className="flex min-w-0 flex-1 flex-col">
              {children}
              {/* Floating generate dock fights footer on listing routes */}
              {showGenerateDock || normalizePath(pathname) === "/generate" ? null : (
                <Footer />
              )}
            </div>
          </div>
        </div>

        <ListingBottomBar />
        <MobileTabBar />
        <GenerateListingDockHost />

        <Suspense fallback={null}>
          <ListingSearch variant="header" />
        </Suspense>
      </div>
    </ListingMobileChromeProvider>
  );
}
