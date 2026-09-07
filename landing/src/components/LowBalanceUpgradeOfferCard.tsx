"use client";

import { useEffect, useState } from "react";
import { useLowBalanceUpgradeOffer } from "@/context/LowBalanceUpgradeOfferContext";
import {
  RESULT_RAIL_BUTTON_BASE,
  RESULT_RAIL_BUTTON_GLASS,
} from "@/components/generate/GenerationResultActionRail";
import {
  formatOfferCountdown,
  remainingOfferMs,
} from "@/lib/low-balance-upgrade-nudge";

type Variant = "sidebar" | "result" | "mobile";

function useOfferRemainingMs(expiresAt: string): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return remainingOfferMs(expiresAt, nowMs);
}

function OfferTimer({
  expiresAt,
  remainingMs,
  className,
}: {
  expiresAt: string;
  remainingMs: number;
  className: string;
}) {
  return (
    <time dateTime={expiresAt} className={`tabular-nums ${className}`.trim()}>
      {formatOfferCountdown(remainingMs)}
    </time>
  );
}

export function LowBalanceUpgradeOfferCard({
  variant,
  className = "",
}: {
  variant: Variant;
  className?: string;
}) {
  const { offer, dismiss, buy } = useLowBalanceUpgradeOffer();
  const remainingMs = useOfferRemainingMs(offer?.expiresAt ?? "");
  if (!offer || remainingMs <= 0) return null;

  const percent = `−${offer.percent}%`;
  const aria = `Скидка ${offer.percent}%, 100 токенов за 239 ₽ вместо 299 ₽, осталось ${formatOfferCountdown(remainingMs)}`;

  if (variant === "sidebar") {
    return (
      <aside
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-3 text-white shadow-lg shadow-indigo-950/25 ring-1 ring-white/20 ${className}`.trim()}
        aria-label={aria}
      >
        <p className="pr-8 text-sm font-semibold">Скидка {percent}</p>
        <p className="mt-1 flex items-baseline gap-1.5 text-sm">
          <span className="font-semibold">100 токенов · 239 ₽</span>
          <span className="text-xs text-white/60 line-through decoration-white/40">
            299 ₽
          </span>
        </p>
        <button
          type="button"
          onClick={buy}
          className="mt-2 inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <span>Купить</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <OfferTimer
              expiresAt={offer.expiresAt}
              remainingMs={remainingMs}
              className=""
            />
          </span>
        </button>
        <DismissButton onClick={dismiss} className="text-white/70 hover:bg-white/15 hover:text-white" />
      </aside>
    );
  }

  if (variant === "result") {
    return (
      <button
        type="button"
        onClick={buy}
        className={`${RESULT_RAIL_BUTTON_BASE} ${RESULT_RAIL_BUTTON_GLASS} pointer-events-auto w-[8.75rem] overflow-hidden sm:w-[9.5rem] ${className}`.trim()}
        aria-label={aria}
      >
        <span
          className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center"
          aria-hidden
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7.5V4h3.5L20 16.5 16.5 20 4 7.5Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7.25" cy="7.25" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="relative z-10 min-w-0 flex-1">
          <span className="block whitespace-normal leading-tight">
            Скидка {percent}
          </span>
          <span className="mt-0.5 block whitespace-nowrap font-medium leading-tight text-white/70">
            239 ₽ ·{" "}
            <OfferTimer
              expiresAt={offer.expiresAt}
              remainingMs={remainingMs}
              className=""
            />
          </span>
        </span>
      </button>
    );
  }

  return (
    <aside
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 pl-3 pr-14 text-white shadow-xl shadow-indigo-950/30 ${className}`.trim()}
      aria-label={aria}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Скидка {percent} · 239 ₽</p>
        <p className="mt-0.5 text-xs font-medium text-white/75">
          100✦ ·{" "}
          <OfferTimer
            expiresAt={offer.expiresAt}
            remainingMs={remainingMs}
            className=""
          />
        </p>
      </div>
      <button
        type="button"
        onClick={buy}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
      >
        Купить
      </button>
      <DismissButton onClick={dismiss} className="text-white/70 hover:bg-white/15 hover:text-white" />
    </aside>
  );
}

function DismissButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-full transition ${className}`}
      aria-label="Закрыть предложение"
    >
      <span className="text-xl leading-none" aria-hidden>
        ×
      </span>
    </button>
  );
}
