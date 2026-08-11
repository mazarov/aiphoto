"use client";

import { useEffect, useRef, useState } from "react";
import { syncHeaderHeightCssVar } from "@/lib/listing-header-offset";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteLogoMark } from "./SiteLogoMark";
import { ListingChromeButton, ListingMenuIcon } from "./ListingChromeButton";
import { UserAvatarImage } from "./UserAvatarImage";
import { useAuth } from "@/context/AuthContext";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { isSameNavPath, scrollCatalogToTop } from "@/lib/scroll-preservation";
import {
  LISTING_MOBILE_CHROME_INSET,
  LISTING_NAV_SHELL_SURFACE,
} from "@/lib/listing-shell-surface";
import { CREDIT_BALANCE_REFRESH_EVENT } from "@/lib/credit-balance-events";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

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

function CreditBalance() {
  const { user, loading } = useAuth();
  const { promptCardGenerationEnabled } = useFeatureAccess();
  const [credits, setCredits] = useState<number | null>(null);
  const hasPricingAccess = promptCardGenerationEnabled;

  useEffect(() => {
    if (loading || !user || user.is_anonymous === true || !hasPricingAccess) {
      setCredits(null);
      return;
    }

    const controller = new AbortController();
    const loadCredits = async (showLoading = false) => {
      if (showLoading) setCredits(null);
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Balance request failed: ${response.status}`);
        }
        const payload = (await response.json()) as { credits?: number };
        if (!controller.signal.aborted) {
          setCredits(Number.isFinite(payload.credits) ? Number(payload.credits) : 0);
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          console.error("[header.balance] failed", error);
        }
      }
    };

    void loadCredits(true);
    const refreshBalance = () => {
      void loadCredits();
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshBalance);

    return () => {
      controller.abort();
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshBalance);
    };
  }, [hasPricingAccess, loading, user]);

  if (loading || !user || user.is_anonymous === true || !hasPricingAccess) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50/80 px-2.5 text-sm font-semibold text-indigo-700"
        aria-label={credits === null ? "Баланс загружается" : `Баланс: ${credits} токенов`}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="m10 2.5 5.5 7.5L10 17.5 4.5 10 10 2.5Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="m4.5 10 5.5 2.5 5.5-2.5M10 2.5v10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {credits === null ? (
          <span className="h-4 w-7 animate-pulse rounded bg-indigo-200/70" aria-hidden />
        ) : (
          <span>{new Intl.NumberFormat("ru-RU").format(credits)}</span>
        )}
      </div>

      <Link
        href="/pricing"
        onClick={() =>
          reachYandexMetrikaGoal(
            YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
            {
              feature_key: "prompt_card_generation",
              variant: "treatment",
            }
          )
        }
        className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:px-3.5"
        aria-label="Пополнить баланс"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="hidden lg:inline">Пополнить</span>
      </Link>
    </div>
  );
}

function UserMenu() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-xl border border-indigo-200/40 bg-white/60" />
    );
  }

  if (!user || user.is_anonymous === true) {
    return (
      <ListingChromeButton variant="pill" onClick={openAuthModal}>
        Войти
      </ListingChromeButton>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="relative">
      <ListingChromeButton
        variant="pill"
        onClick={() => setOpen((v) => !v)}
        className="gap-2 px-2"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          <UserAvatarImage
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden text-[13px] font-medium text-zinc-800 sm:block">
          {displayName}
        </span>
      </ListingChromeButton>
      {open && (
        <>
          <div className="absolute left-0 right-0 top-full z-40 h-2" />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-zinc-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Избранное
            </Link>
            <Link
              href="/generations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <span aria-hidden>🚀</span>
              Мои генерации
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); signOut(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Выйти
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function HeaderClient() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => syncHeaderHeightCssVar(el);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleHomeLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSameNavPath(pathname, "/")) {
      e.preventDefault();
      scrollCatalogToTop();
    }
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-40 shrink-0 ${LISTING_NAV_SHELL_SURFACE}`}
    >
      {/* Mobile: menu + logo + auth */}
      <div
        className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${LISTING_MOBILE_CHROME_INSET} lg:hidden`}
      >
        <div className="flex shrink-0 justify-start">
          <MobileCatalogMenuButton />
        </div>
        <Link
          href="/"
          scroll={false}
          onClick={handleHomeLogoClick}
          className="flex min-w-0 items-center justify-center gap-1.5 text-lg font-bold tracking-tight text-zinc-900"
        >
          <SiteLogoMark size={28} className="h-7 w-7 shrink-0 rounded-lg" />
          <span className="truncate">PromptShot</span>
        </Link>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <CreditBalance />
          <UserMenu />
        </div>
      </div>

      {/* Desktop: logo + user menu */}
      <div className="hidden items-center justify-between gap-4 px-5 py-3 lg:flex">
        <Link
          href="/"
          scroll={false}
          onClick={handleHomeLogoClick}
          className="flex flex-shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-zinc-900"
        >
          <SiteLogoMark size={28} className="h-7 w-7 rounded-lg" />
          <span>PromptShot</span>
        </Link>

        <div className="flex items-center gap-2">
          <CreditBalance />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
