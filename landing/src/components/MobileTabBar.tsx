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
import { useAuth } from "@/context/AuthContext";
import { openLexyGptPlaygroundTab } from "@/lib/lexygpt-generate";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_LEXYGPT_GENERATE,
} from "@/lib/yandex-metrika";
import { LISTING_BOTTOM_BAR_SURFACE } from "@/lib/listing-shell-surface";
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const chrome = useListingMobileChromeOptional();
  const { user, openAuthModal } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  if (!mounted || isDesktop) return null;

  const np = normalizePath(pathname);

  const isActive = (key: "catalog" | "foto" | "search" | "profile"): boolean => {
    switch (key) {
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

  const handleGenerate = () => {
    openLexyGptPlaygroundTab();
    reachYandexMetrikaGoal(YM_GOAL_LEXYGPT_GENERATE, { placement: "tabbar" });
  };

  return (
    <>
      <div
        className="mobile-tab-bar shrink-0 rounded-t-2xl border-t border-zinc-200/70 bg-white/95 shadow-[0_-8px_32px_-12px_rgba(99,102,241,0.12)] backdrop-blur-xl pb-[max(0px,env(safe-area-inset-bottom,0px))]"
      >
        <div className="flex h-14 items-end justify-around px-1 pb-1">
          {/* Каталог */}
          <Link
            href="/catalog"
            className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
            aria-label="Каталог"
          >
            <svg
              className={`h-6 w-6 ${isActive("catalog") ? "text-zinc-900" : "text-zinc-400"}`}
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
            <span
              className={`text-[11px] ${isActive("catalog") ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
            >
              Каталог
            </span>
          </Link>

          {/* Фото в промт */}
          <Link
            href="/foto-v-promt"
            className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
            aria-label="Фото в промт"
          >
            <svg
              className={`h-6 w-6 ${isActive("foto") ? "text-zinc-900" : "text-zinc-400"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive("foto") ? 2 : 1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span
              className={`text-[11px] whitespace-nowrap ${isActive("foto") ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
            >
              Фото в промт
            </span>
          </Link>

          {/* Сгенерировать — center accent pill */}
          <div className="flex flex-1 flex-col items-center justify-end pb-0.5">
            <button
              type="button"
              onClick={handleGenerate}
              aria-label="Сгенерировать"
              className="-translate-y-3 flex h-11 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/30 transition-transform active:scale-[0.97]"
            >
              {/* Sparkle / star icon */}
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.25l1.636 4.909L18.545 8.75l-4.909 1.636L12 15.295l-1.636-4.909L5.455 8.75l4.909-1.591L12 2.25z" />
                <path
                  d="M18.5 15.5l.818 2.454L21.773 18.75l-2.455.796L18.5 22l-.818-2.454L15.227 18.75l2.455-.796L18.5 15.5z"
                  opacity="0.65"
                />
                <path
                  d="M5.5 16l.545 1.636L7.682 18.25l-1.637.614L5.5 20.5l-.545-1.636L3.318 18.25l1.637-.614L5.5 16z"
                  opacity="0.45"
                />
              </svg>
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
              className={`h-6 w-6 ${isActive("search") ? "text-zinc-900" : "text-zinc-400"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive("search") ? 2 : 1.5}
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m16.5 16.5 3 3" />
            </svg>
            <span
              className={`text-[11px] ${isActive("search") ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
            >
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
              className={`h-6 w-6 ${isActive("profile") ? "text-zinc-900" : "text-zinc-400"}`}
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
            <span
              className={`text-[11px] ${isActive("profile") ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
            >
              Профиль
            </span>
          </button>
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
