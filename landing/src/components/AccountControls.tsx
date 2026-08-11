"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { CREDIT_BALANCE_REFRESH_EVENT } from "@/lib/credit-balance-events";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";
import { ListingChromeButton } from "./ListingChromeButton";
import { UserAvatarImage } from "./UserAvatarImage";

function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

function useIsDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

function useCreditBalance(enabled = true) {
  const { user, loading } = useAuth();
  const { promptCardGenerationEnabled } = useFeatureAccess();
  const [credits, setCredits] = useState<number | null>(null);
  const canShowBalance =
    !loading &&
    Boolean(user) &&
    user?.is_anonymous !== true &&
    promptCardGenerationEnabled &&
    enabled;

  useEffect(() => {
    if (!canShowBalance) {
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
          console.error("[account.balance] failed", error);
        }
      }
    };

    void loadCredits(true);
    const refreshBalance = () => void loadCredits();
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshBalance);

    return () => {
      controller.abort();
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshBalance);
    };
  }, [canShowBalance]);

  return { credits, canShowBalance };
}

function trackPricingClick() {
  reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING, {
    feature_key: "prompt_card_generation",
    variant: "treatment",
  });
}

function CreditIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="m10 2.5 5.5 7.5L10 17.5 4.5 10 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m4.5 10 5.5 2.5 5.5-2.5M10 2.5v10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function AccountAvatar({
  avatarUrl,
  displayName,
  size = 28,
}: {
  avatarUrl?: string;
  displayName: string;
  size?: number;
}) {
  return avatarUrl ? (
    <UserAvatarImage
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full"
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {displayName[0]?.toUpperCase()}
    </div>
  );
}

export function MobileCreditBalance() {
  const isMobile = useIsMobileLayout();
  const { credits, canShowBalance } = useCreditBalance(isMobile);

  if (!canShowBalance) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50/80 px-2.5 text-sm font-semibold text-indigo-700"
        aria-label={credits === null ? "Баланс загружается" : `Баланс: ${credits} токенов`}
      >
        <CreditIcon />
        {credits === null ? (
          <span className="h-4 w-7 animate-pulse rounded bg-indigo-200/70" aria-hidden />
        ) : (
          <span>{new Intl.NumberFormat("ru-RU").format(credits)}</span>
        )}
      </div>

      <Link
        href="/pricing"
        onClick={trackPricingClick}
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

export function MobileUserMenu() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="h-10 w-10 animate-pulse rounded-xl border border-indigo-200/40 bg-white/60" />;
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
        onClick={() => setOpen((value) => !value)}
        className="gap-2 px-2"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AccountAvatar avatarUrl={avatarUrl} displayName={displayName} />
        <span className="hidden text-[13px] font-medium text-zinc-800 sm:block">
          {displayName}
        </span>
      </ListingChromeButton>
      {open ? (
        <>
          <div className="absolute left-0 right-0 top-full z-40 h-2" />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-zinc-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <BookmarkIcon />
              Избранное
            </Link>
            <Link
              href="/generations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <GenerationsIcon />
              Мои генерации
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <SignOutIcon />
              Выйти
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function SidebarAccountPanel() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const isDesktop = useIsDesktopLayout();
  const { credits, canShowBalance } = useCreditBalance(isDesktop);

  if (loading) {
    return (
      <div className="border-t border-zinc-100 p-3">
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  if (!user || user.is_anonymous === true) {
    return (
      <div className="border-t border-zinc-100 p-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-sm font-semibold text-zinc-900">Ваш PromptShot</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Войдите, чтобы сохранять промты и создавать изображения.
          </p>
          <button
            type="button"
            onClick={openAuthModal}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="border-t border-zinc-100 p-3">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5 px-3 py-3">
          <AccountAvatar avatarUrl={avatarUrl} displayName={displayName} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
            {user.email ? <p className="truncate text-xs text-zinc-500">{user.email}</p> : null}
          </div>
        </div>

        {canShowBalance ? (
          <div className="mx-2 rounded-xl bg-indigo-50/80 p-2.5">
            <div
              className="flex items-center justify-between gap-3 text-sm"
              aria-label={credits === null ? "Баланс загружается" : `Баланс: ${credits} токенов`}
            >
              <span className="inline-flex items-center gap-2 font-medium text-indigo-700">
                <CreditIcon />
                Кредиты
              </span>
              {credits === null ? (
                <span className="h-4 w-10 animate-pulse rounded bg-indigo-200/70" aria-hidden />
              ) : (
                <strong className="tabular-nums text-indigo-800">
                  {new Intl.NumberFormat("ru-RU").format(credits)}
                </strong>
              )}
            </div>
            <Link
              href="/pricing"
              onClick={trackPricingClick}
              className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Пополнить
            </Link>
          </div>
        ) : null}

        <div className="p-2">
          <Link
            href="/favorites"
            className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            <BookmarkIcon />
            Избранное
          </Link>
          <Link
            href="/generations"
            className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            <GenerationsIcon />
            Мои генерации
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            <SignOutIcon />
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function GenerationsIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
