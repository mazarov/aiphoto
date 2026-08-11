"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { flushSync } from "react-dom";
import {
  focusMobileSearchInput,
  ListingMobileSearchSheet,
} from "./ListingMobileSearchSheet";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { useFotoVPromtMobileModal } from "@/context/FotoVPromtMobileModalContext";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

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
  const { isOpen: fotoModalOpen, open: openFotoModal } = useFotoVPromtMobileModal();
  const {
    focusBlank: focusGenerateDock,
    plateOpen: generatePlateOpen,
    setPlateOpen: setGeneratePlateOpen,
    setDockSurface: setGenerateDockSurface,
    runBusy: generateRunBusy,
    runProgress: generateRunProgress,
    needsCredits: generateNeedsCredits,
  } = useGenerateDock();
  const { user, openAuthModal } = useAuth();
  const { promptCardGenerationEnabled, loading: featureLoading } =
    useFeatureAccess();
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
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
  const showGenerateCenter = !featureLoading && promptCardGenerationEnabled;

  const isActive = (
    key: "new" | "catalog" | "generate" | "foto" | "search"
  ): boolean => {
    switch (key) {
      case "new":
        return np === "/trends";
      case "catalog":
        return np === "/" || np === "/catalog";
      case "generate":
        return np === "/generate" || np.startsWith("/generate/");
      case "foto":
        return np === "/foto-v-promt" || np.startsWith("/foto-v-promt/");
      case "search":
        return np === "/search";
    }
  };

  const handleSearchTab = () => {
    if (search && !search.hideMobileBar) {
      openSheet();
    } else {
      router.push("/search");
    }
  };

  const handleFotoTab = () => {
    if (fotoModalOpen) return;
    openFotoModal();
  };

  const handleGenerateTab = () => {
    if (!isAuthed) {
      openAuthModal();
      return;
    }
    if (generateNeedsCredits) {
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING, {
        feature_key: "prompt_card_generation",
        variant: "treatment",
      });
      router.push("/pricing");
      return;
    }
    if (generatePlateOpen) {
      setGeneratePlateOpen(false);
      setGenerateDockSurface(null);
      return;
    }
    focusGenerateDock({ entrySource: "tab" });
  };

  const fotoActive = isActive("foto") || fotoModalOpen;
  const generateActive = generatePlateOpen || isActive("generate");

  return (
    <>
      <div className="mobile-tab-bar pointer-events-none absolute inset-x-0 bottom-0 z-40 max-lg:block lg:hidden">
        <div
          ref={tabBarRef}
          className="pointer-events-auto rounded-t-2xl border-t border-zinc-200/70 bg-white/95 shadow-[0_-8px_32px_-12px_rgba(99,102,241,0.12)] backdrop-blur-xl pb-[max(0px,env(safe-area-inset-bottom,0px))]"
        >
          <div className="flex h-14 items-end justify-around px-1 pb-1">
            <Link
              href="/trends"
              className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
              aria-label="Тренды"
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
                Тренды
              </span>
            </Link>

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

            {showGenerateCenter ? (
              <div className="flex flex-1 flex-col items-center justify-end pb-0.5">
                <button
                  type="button"
                  onClick={handleGenerateTab}
                  aria-label={
                    generateRunBusy
                      ? `Генерируем ${Math.round(generateRunProgress)}%`
                      : generateNeedsCredits
                        ? "Недостаточно кредитов"
                        : "Сгенерировать"
                  }
                  aria-busy={generateRunBusy || undefined}
                  aria-pressed={generateActive}
                  className="flex flex-col items-center gap-0.5 transition-transform active:scale-[0.97]"
                >
                  <span
                    className={`relative -translate-y-2 flex h-10 w-14 items-center justify-center overflow-hidden rounded-2xl text-white ${
                      generateRunBusy
                        ? ""
                        : generateNeedsCredits
                          ? "bg-rose-500/85 shadow-lg shadow-rose-500/25"
                          : generateActive
                            ? "bg-indigo-700 shadow-lg shadow-indigo-500/30"
                            : "bg-indigo-600 shadow-lg shadow-indigo-500/30"
                    }`}
                    style={
                      generateRunBusy
                        ? { backgroundColor: "rgba(39,39,42,0.95)" }
                        : undefined
                    }
                  >
                    {generateRunBusy ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 z-0 origin-left transition-transform duration-300 ease-out"
                        style={{
                          width: "100%",
                          transform: `scaleX(${Math.min(1, Math.max(0.06, generateRunProgress / 100))})`,
                          background:
                            "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
                        }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative z-10 text-[11px] font-semibold tabular-nums">
                      {generateRunBusy ? (
                        `${Math.round(generateRunProgress)}%`
                      ) : generateNeedsCredits ? (
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.75}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                          />
                        </svg>
                      ) : (
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
                            d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
                          />
                        </svg>
                      )}
                    </span>
                  </span>
                  <span
                    className={`max-w-[4.75rem] text-center text-[9px] leading-tight ${
                      generateNeedsCredits
                        ? "font-semibold text-rose-500/90"
                        : generateActive || generateRunBusy
                          ? "font-semibold text-indigo-600"
                          : "font-medium text-indigo-600"
                    }`}
                  >
                    {generateRunBusy
                      ? "Генерируем"
                      : generateNeedsCredits
                        ? "Нет кредитов"
                        : "Сгенерировать"}
                  </span>
                </button>
              </div>
            ) : null}

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

            <button
              type="button"
              onClick={handleFotoTab}
              className="flex flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
              aria-label="Фото в промт"
              aria-pressed={fotoActive}
            >
              <svg
                className={`h-6 w-6 ${tabIconClass(fotoActive)}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={fotoActive ? 2 : 1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span
                className={`max-w-[4.5rem] text-center text-[10px] leading-tight ${tabLabelClass(fotoActive)}`}
              >
                Фото в промт
              </span>
            </button>
          </div>
        </div>
      </div>

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
    </>
  );
}
