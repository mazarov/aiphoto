"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { flushSync } from "react-dom";
import {
  focusMobileSearchInput,
  ListingMobileSearchSheet,
} from "./ListingMobileSearchSheet";
import { MobileProfileSheet } from "./MobileProfileSheet";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import { useAuth } from "@/context/AuthContext";
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";

function tabIconClass(active: boolean) {
  return active ? "text-indigo-600" : "text-zinc-400";
}

function tabLabelClass(active: boolean) {
  return active ? "font-semibold text-indigo-600" : "text-zinc-400";
}

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const chrome = useListingMobileChromeOptional();
  const { user, openAuthModal } = useAuth();
  const { isOpen: fotoModalOpen, open: openFotoModal } = useFotoVPromtMobileModal();

  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  void chrome?.searchMobileRevision;
  void chrome?.filterRevision;

  const search = chrome?.searchMobileRef.current ?? null;
  const filterOpen = chrome?.filterOpenRef.current ?? null;
  const filterActiveCount = chrome?.filterActiveCount ?? 0;
  const registerMobileSearchOpen = chrome?.registerMobileSearchOpen;

  const openSheet = useCallback(() => {
    flushSync(() => setSearchSheetOpen(true));
    focusMobileSearchInput(searchInputRef.current);
    requestAnimationFrame(() => focusMobileSearchInput(searchInputRef.current));
    bumpListingShellViewportHeight();
  }, []);

  const closeSheet = useCallback(() => {
    setSearchSheetOpen(false);
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
    if (!registerMobileSearchOpen) return;
    registerMobileSearchOpen(openSheet);
    return () => registerMobileSearchOpen(null);
  }, [registerMobileSearchOpen, openSheet]);

  // iOS Safari ignores overscroll-behavior/touch-action for document-level bounce when the
  // gesture starts on a non-scrollable element. Intercept touchmove on the bar itself with a
  // non-passive listener so preventDefault() actually cancels the native scroll chain.
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  });

  if (!mounted || isDesktop) return null;

  const np = normalizePath(pathname);

  const isActive = (
    key: "new" | "catalog" | "foto" | "search" | "profile"
  ): boolean => {
    switch (key) {
      case "new":
        return np === "/new";
      case "catalog":
        // Home (/) and /catalog both map to the catalog tab
        return np === "/" || np === "/catalog";
      case "foto":
        return np === "/foto-v-promt" || np.startsWith("/foto-v-promt/");
      case "search":
        return np === "/search";
      case "profile":
        return np === "/favorites" || np === "/generations";
    }
  };

  const handleSearchTab = () => {
    if (search && !search.hideMobileBar) {
      openSheet();
    } else {
      router.push("/search");
    }
  };

  const handleProfileTab = () => {
    if (user) {
      setProfileSheetOpen(true);
    } else {
      openAuthModal();
    }
  };

  const handleFotoTab = () => {
    if (fotoModalOpen) return;
    openFotoModal();
  };

  const fotoActive = isActive("foto") || fotoModalOpen;

  return (
    <>
      <div
        className="mobile-tab-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 max-lg:block lg:hidden"
      >
        <div ref={tabBarRef} className="pointer-events-auto rounded-t-2xl border-t border-zinc-200/70 bg-white/95 shadow-[0_-8px_32px_-12px_rgba(99,102,241,0.12)] backdrop-blur-xl pb-[max(0px,env(safe-area-inset-bottom,0px))]">
        <div className="flex h-14 items-end justify-around px-1 pb-1">
          {/* Новое */}
          <Link
            href="/new"
            className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
            aria-label="Новое"
          >
            <svg
              className={`h-6 w-6 ${tabIconClass(isActive("new"))}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive("new") ? 2 : 1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.5 14.5l.75 2.25L21.5 17.5l-2.25.75L18.5 20.5l-.75-2.25L15.5 17.5l2.25-.75.75-2.25z"
              />
            </svg>
            <span className={`text-[11px] ${tabLabelClass(isActive("new"))}`}>
              Новое
            </span>
          </Link>

          {/* Каталог */}
          <Link
            href="/catalog"
            className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
            aria-label="Каталог"
          >
            <svg
              className={`h-6 w-6 ${tabIconClass(isActive("catalog"))}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive("catalog") ? 2 : 1.5}
            >
              <rect x="3" y="3" width="8" height="8" rx="1.5" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" />
            </svg>
            <span className={`text-[11px] ${tabLabelClass(isActive("catalog"))}`}>
              Каталог
            </span>
          </Link>

          {/* Фото в промт — center accent → soft fullscreen modal + pushState */}
          <div className="flex flex-1 flex-col items-center justify-end pb-0.5">
            <button
              type="button"
              onClick={handleFotoTab}
              aria-label="Фото в промт"
              aria-pressed={fotoActive}
              className="flex flex-col items-center gap-0.5 transition-transform active:scale-[0.97]"
            >
              <span
                className={`-translate-y-2 flex h-10 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-500/30 ${
                  fotoActive ? "bg-indigo-700" : "bg-indigo-600"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
              <span
                className={`max-w-[4.75rem] text-center text-[9px] leading-tight ${
                  fotoActive
                    ? "font-semibold text-indigo-600"
                    : "font-medium text-indigo-600"
                }`}
              >
                Фото в промт
              </span>
            </button>
          </div>

          {/* Поиск */}
          <button
            type="button"
            onClick={handleSearchTab}
            className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
            aria-label="Поиск"
          >
            <svg
              className={`h-6 w-6 ${tabIconClass(isActive("search"))}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive("search") ? 2 : 1.5}
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m16.5 16.5 3 3" />
            </svg>
            <span className={`text-[11px] ${tabLabelClass(isActive("search"))}`}>
              Поиск
            </span>
          </button>

          {/* Профиль */}
          <button
            type="button"
            onClick={handleProfileTab}
            className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
            aria-label="Профиль"
          >
            <svg
              className={`h-6 w-6 ${tabIconClass(isActive("profile"))}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive("profile") ? 2 : 1.5}
            >
              <circle cx="12" cy="8" r="4" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 20c0-4 3.582-7 8-7s8 3 8 7"
              />
            </svg>
            <span className={`text-[11px] ${tabLabelClass(isActive("profile"))}`}>
              Профиль
            </span>
          </button>
        </div>
        </div>
      </div>

      {/* Mobile search sheet — only when a search is registered */}
      {search && !search.hideMobileBar && (
        <ListingMobileSearchSheet
          open={searchSheetOpen}
          onClose={closeSheet}
          search={search}
          filterOpen={filterOpen}
          filterActiveCount={filterActiveCount}
          inputRef={searchInputRef}
        />
      )}

      {/* Profile sheet — only when authenticated */}
      {user && (
        <MobileProfileSheet
          open={profileSheetOpen}
          onClose={() => setProfileSheetOpen(false)}
        />
      )}
    </>
  );
}
