"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CREDIT_BALANCE_REFRESH_EVENT } from "@/lib/credit-balance-events";
import { ANALYZE_QUOTA_AUTH_SUBTITLE } from "@/lib/foto-v-promt-copy";
import { useListingIsDesktop } from "@/hooks/useListingIsMobile";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";
import { UserAvatarImage } from "./UserAvatarImage";
import { OAuthSignInButtons } from "./OAuthSignInButtons";
import { PricingEntryLink } from "./PricingEntryLink";

let meCreditsCache: { value: number; at: number } | null = null;
let meCreditsInflight: Promise<number> | null = null;
const ME_CREDITS_TTL_MS = 15_000;

function invalidateMeCreditsCache() {
  meCreditsCache = null;
}

function loadMeCredits(): Promise<number> {
  if (meCreditsCache && Date.now() - meCreditsCache.at < ME_CREDITS_TTL_MS) {
    return Promise.resolve(meCreditsCache.value);
  }
  if (!meCreditsInflight) {
    meCreditsInflight = fetch("/api/me", {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Balance request failed: ${response.status}`);
        }
        const payload = (await response.json()) as { credits?: number };
        const credits = Number.isFinite(payload.credits) ? Number(payload.credits) : 0;
        meCreditsCache = { value: credits, at: Date.now() };
        return credits;
      })
      .finally(() => {
        meCreditsInflight = null;
      });
  }
  return meCreditsInflight;
}

function useCreditBalance(enabled = true) {
  const { user, loading } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const canShowBalance =
    !loading &&
    Boolean(user) &&
    user?.is_anonymous !== true &&
    enabled;

  useEffect(() => {
    if (!canShowBalance) {
      setCredits(null);
      return;
    }

    let cancelled = false;
    const loadCredits = async (showLoading = false) => {
      const cached =
        meCreditsCache && Date.now() - meCreditsCache.at < ME_CREDITS_TTL_MS
          ? meCreditsCache.value
          : null;
      if (cached !== null) {
        setCredits(cached);
      } else if (showLoading) {
        setCredits(null);
      }
      try {
        const next = await loadMeCredits();
        if (!cancelled) setCredits(next);
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("[account.balance] failed", error);
        }
      }
    };

    void loadCredits(true);
    const refreshBalance = () => {
      invalidateMeCreditsCache();
      void loadCredits();
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshBalance);

    return () => {
      cancelled = true;
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, refreshBalance);
    };
  }, [canShowBalance]);

  return { credits, canShowBalance };
}

function trackPricingClick() {
  reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING);
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

/** Header chip: balance + pay CTA (Lexy-style split pill, PromptShot chrome). */
export function HeaderBalancePayChip() {
  const { credits } = useCreditBalance(true);
  const empty = credits === 0;
  const label =
    credits === null
      ? "Баланс загружается, пополнить"
      : `Баланс ${new Intl.NumberFormat("ru-RU").format(credits)} токенов, пополнить`;

  return (
    <PricingEntryLink
      href="/pricing"
      onClick={trackPricingClick}
      aria-label={label}
      className={`group listing-chrome-btn inline-flex h-10 max-w-[16rem] shrink-0 overflow-hidden rounded-xl border shadow-sm shadow-indigo-500/[0.08] backdrop-blur-xl transition-[border-color,box-shadow] ${
        empty
          ? "border-rose-200/80 bg-white/82 hover:border-rose-300"
          : "border-indigo-200/70 bg-white/82 hover:border-indigo-200 hover:bg-white/90"
      }`}
    >
      <span
        className={`inline-flex min-w-0 items-center gap-1 pl-2.5 pr-2 text-[13px] font-semibold tabular-nums ${
          empty ? "text-rose-700" : "text-indigo-700"
        }`}
      >
        <CreditIcon className="h-4 w-4 shrink-0" />
        {credits === null ? (
          <span className="h-3.5 w-8 animate-pulse rounded bg-indigo-200/70" aria-hidden />
        ) : (
          <span className="truncate">{new Intl.NumberFormat("ru-RU").format(credits)}</span>
        )}
      </span>
      <span
        className={`inline-flex h-full w-10 items-center justify-center text-[17px] font-semibold leading-none text-white transition-colors ${
          empty
            ? "bg-rose-500 group-hover:bg-rose-600"
            : "bg-indigo-600 group-hover:bg-indigo-700"
        }`}
        aria-hidden
      >
        +
      </span>
    </PricingEntryLink>
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

export function SidebarAccountPanel({
  onNavigate,
  showBalance,
}: {
  onNavigate?: () => void;
  showBalance?: boolean;
}) {
  const { user, loading, signOut, authModalReason } = useAuth();
  const isDesktop = useListingIsDesktop();
  const { credits, canShowBalance } = useCreditBalance(showBalance ?? isDesktop);

  if (loading) {
    return (
      <div className="border-b border-zinc-100 p-3">
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
      </div>
    );
  }

  if (!user || user.is_anonymous === true) {
    return (
      <div className="border-b border-zinc-100 p-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-sm font-semibold text-zinc-900">Ваш PromptShot</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {authModalReason === "analyze_quota"
              ? ANALYZE_QUOTA_AUTH_SUBTITLE
              : "Войдите, чтобы сохранять промты и создавать изображения."}
          </p>
          <OAuthSignInButtons className="mt-3 space-y-2" />
        </div>
      </div>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="border-b border-zinc-100 p-3">
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
            <PricingEntryLink
              href="/pricing"
              onClick={() => {
                onNavigate?.();
                trackPricingClick();
              }}
              className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Пополнить
            </PricingEntryLink>
          </div>
        ) : null}

        <div className="p-2">
          <Link
            href="/favorites"
            onClick={onNavigate}
            className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            <BookmarkIcon />
            Избранное
          </Link>
          <Link
            href="/generations"
            onClick={onNavigate}
            className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            <GenerationsIcon />
            Мои генерации
          </Link>
          <Link
            href="/analyses"
            onClick={onNavigate}
            className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            <AnalysesIcon />
            Мои анализы
          </Link>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              void signOut();
            }}
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

function AnalysesIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
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
