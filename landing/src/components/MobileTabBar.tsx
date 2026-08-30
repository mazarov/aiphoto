"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
import { bumpListingShellViewportHeight } from "@/lib/listing-shell-viewport";
import { useListingIsMobile } from "@/hooks/useListingIsMobile";
import {
  holdListingChromeAutoHide,
  releaseListingChromeAutoHide,
} from "@/hooks/useListingChromeAutoHide";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";
import { MobileProfileSheet } from "./MobileProfileSheet";
import { UserAvatarImage } from "./UserAvatarImage";
import { usePricingModal } from "@/context/PricingModalContext";
import {
  COMPOSE_BUY_CREDITS_CTA,
  COMPOSE_BUY_CREDITS_CTA_COMPACT,
} from "@/lib/generate-compose-mode";
import { listingGenerateIdleIntent } from "@/lib/generate-dock-path";
import {
  PROMTY_DLYA_II_FOTOSESSII_GENERATE_CTA,
  listingGenerateIdleCta,
} from "@/lib/promty-dlya-ii-fotosessii-cluster";

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
  const { open: openPricing } = usePricingModal();
  const chrome = useListingMobileChromeOptional();
  const { isOpen: fotoModalOpen, open: openFotoModal } = useFotoVPromtMobileModal();
  const {
    focusBlank: focusGenerateDock,
    seedBlankPrompt,
    plateOpen: generatePlateOpen,
    setPlateOpen: setGeneratePlateOpen,
    setDockSurface: setGenerateDockSurface,
    runBusy: generateRunBusy,
    runProgress: generateRunProgress,
    needsCredits: generateNeedsCredits,
  } = useGenerateDock();
  const { user } = useAuth();
  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const generateIdleLabel = listingGenerateIdleCta({
    pathname,
    isAuthed: true,
  });

  const isMobile = useListingIsMobile();
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  void chrome?.searchMobileRevision;
  void chrome?.filterRevision;

  const search = chrome?.searchMobileRef.current ?? null;
  const filterOpen = chrome?.filterOpenRef.current ?? null;
  const filterActiveCount = chrome?.filterActiveCount ?? 0;
  const registerMobileSearchOpen = chrome?.registerMobileSearchOpen;

  const openSheet = useCallback(() => {
    holdListingChromeAutoHide("search");
    flushSync(() => setSearchSheetOpen(true));
    focusMobileSearchInput(searchInputRef.current);
    requestAnimationFrame(() => focusMobileSearchInput(searchInputRef.current));
    bumpListingShellViewportHeight();
  }, []);

  const closeSheet = useCallback(() => {
    releaseListingChromeAutoHide("search");
    setSearchSheetOpen(false);
    bumpListingShellViewportHeight();
  }, []);

  useEffect(() => {
    return () => releaseListingChromeAutoHide("search");
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

  if (!isMobile) return null;

  const np = normalizePath(pathname);

  const isActive = (
    key: "new" | "catalog" | "generate" | "foto"
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
    }
  };

  const handleFotoTab = () => {
    if (fotoModalOpen) return;
    openFotoModal();
  };

  const handleGenerateTab = () => {
    if (generateNeedsCredits) {
      reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
      openPricing();
      return;
    }
    if (generatePlateOpen) {
      setGeneratePlateOpen(false);
      setGenerateDockSurface(null);
      return;
    }
    if (listingGenerateIdleIntent(pathname) === "photo_prompt") {
      seedBlankPrompt("", { entrySource: "tab", intent: "photo_prompt" });
      return;
    }
    focusGenerateDock({ entrySource: "tab" });
  };

  const fotoActive = isActive("foto") || fotoModalOpen;
  const generateActive = generatePlateOpen || isActive("generate");

  return (
    <>
      <div className="mobile-tab-bar pointer-events-none absolute inset-x-0 bottom-0 z-50 max-lg:block lg:hidden">
        <div
          ref={tabBarRef}
          className="pointer-events-auto rounded-t-2xl border-t border-zinc-200/70 bg-white/95 shadow-[0_-8px_32px_-12px_rgba(99,102,241,0.12)] backdrop-blur-xl pb-[max(0px,env(safe-area-inset-bottom,0px))]"
        >
          <div className="flex h-14 items-end justify-around px-1 pb-1">
            <Link
              href="/trends"
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
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
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
              aria-label="Каталог и поиск"
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
              <span className={`whitespace-nowrap text-[11px] ${tabLabelClass(isActive("catalog"))}`}>
                Каталог
              </span>
            </Link>

            <div className="flex min-w-0 flex-1 flex-col items-center justify-end pb-0.5">
                <button
                  type="button"
                  onClick={handleGenerateTab}
                  aria-label={
                    generateRunBusy
                      ? `Генерируем ${Math.round(generateRunProgress)}%`
                      : generateNeedsCredits
                        ? COMPOSE_BUY_CREDITS_CTA
                        : generateIdleLabel
                  }
                  aria-busy={generateRunBusy || undefined}
                  aria-pressed={generateActive}
                  className="flex flex-col items-center gap-0.5 transition-transform active:scale-[0.97]"
                >
                  <span
                    className={`relative -translate-y-2 flex h-10 w-14 items-center justify-center overflow-hidden rounded-2xl text-white ${
                      generateRunBusy
                        ? ""
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
                    className={`${
                      generateIdleLabel === PROMTY_DLYA_II_FOTOSESSII_GENERATE_CTA
                      || generateNeedsCredits
                        ? "max-w-[6.5rem]"
                        : "max-w-[4.75rem]"
                    } text-center text-[9px] leading-tight ${
                      generateActive || generateRunBusy || generateNeedsCredits
                        ? "font-semibold text-indigo-600"
                        : "font-medium text-indigo-600"
                    }`}
                  >
                    {generateRunBusy
                      ? "Генерируем"
                      : generateNeedsCredits
                        ? COMPOSE_BUY_CREDITS_CTA_COMPACT
                        : generateIdleLabel}
                  </span>
                </button>
              </div>

            <button
              type="button"
              onClick={handleFotoTab}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
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
              <span className={`whitespace-nowrap text-[11px] ${tabLabelClass(fotoActive)}`}>
                В промт
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="relative z-[1] flex min-h-11 min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1 pt-2"
              aria-label={isAuthed ? "Профиль" : "Войти"}
              aria-haspopup="dialog"
              aria-pressed={profileOpen}
            >
              {isAuthed ? (
                <TabAccountAvatar
                  avatarUrl={user?.user_metadata?.avatar_url}
                  displayName={
                    user?.user_metadata?.full_name ||
                    user?.email?.split("@")[0] ||
                    "User"
                  }
                  active={profileOpen}
                />
              ) : (
                <svg
                  className={`h-6 w-6 ${tabIconClass(profileOpen)}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={profileOpen ? 2 : 1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
              <span className={`text-[11px] ${tabLabelClass(profileOpen)}`}>
                {isAuthed ? "Профиль" : "Войти"}
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
      <MobileProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function TabAccountAvatar({
  avatarUrl,
  displayName,
  active,
}: {
  avatarUrl?: string;
  displayName: string;
  active: boolean;
}) {
  if (avatarUrl) {
    return (
      <UserAvatarImage
        src={avatarUrl}
        alt=""
        width={24}
        height={24}
        className={`h-6 w-6 rounded-full ${active ? "ring-2 ring-indigo-500" : ""}`}
      />
    );
  }
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
        active ? "bg-indigo-100 text-indigo-600" : "bg-zinc-200 text-zinc-500"
      }`}
      aria-hidden
    >
      {displayName[0]?.toUpperCase()}
    </span>
  );
}
