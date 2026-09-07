"use client";

import { useCallback, useEffect, useState } from "react";
import { CREDIT_BALANCE_REFRESH_EVENT } from "@/lib/credit-balance-events";
import { useAuth } from "@/context/AuthContext";
import { usePricingModal } from "@/context/PricingModalContext";

type UpgradeOffer = {
  offerId: string;
  percent: number;
  expiresAt: string;
  targetPlanId: string | null;
  sourceTemplateId: string | null;
  showNudge: boolean;
};

function recordOfferEvent(
  offerId: string,
  event: "seen" | "clicked" | "dismissed",
) {
  void fetch("/api/pricing-offers/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({ offerId, event }),
  }).catch(() => undefined);
}

export function LowBalanceUpgradeNudge() {
  const { user } = useAuth();
  const { open: openPricing } = usePricingModal();
  const [offer, setOffer] = useState<UpgradeOffer | null>(null);

  const checkOffer = useCallback(async () => {
    if (!user || user.is_anonymous === true) return;
    const response = await fetch("/api/me", {
      cache: "no-store",
      credentials: "include",
    }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => null)) as
      | { offer?: UpgradeOffer | null }
      | null;
    const next = payload?.offer;
    if (
      !next?.showNudge ||
      next.sourceTemplateId !== "low_balance_upgrade" ||
      next.targetPlanId !== "start" ||
      next.percent !== 20
    ) {
      return;
    }
    setOffer(next);
    recordOfferEvent(next.offerId, "seen");
  }, [user]);

  useEffect(() => {
    const onBalanceRefresh = () => {
      void checkOffer();
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, onBalanceRefresh);
    return () => {
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, onBalanceRefresh);
    };
  }, [checkOffer]);

  if (!offer) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[240] mx-auto max-w-sm rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl shadow-indigo-950/20 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:mx-0"
      aria-label="Персональное предложение"
    >
      <button
        type="button"
        onClick={() => {
          recordOfferEvent(offer.offerId, "dismissed");
          setOffer(null);
        }}
        className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="Закрыть предложение"
      >
        <span className="text-xl leading-none" aria-hidden>
          ×
        </span>
      </button>
      <p className="pr-9 text-base font-semibold text-zinc-950">
        Продолжите фотосессию выгоднее
      </p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">
        100 токенов за <strong className="text-zinc-950">239 ₽</strong>{" "}
        <span className="text-zinc-400 line-through">299 ₽</span>. Персональная
        скидка действует 7 дней.
      </p>
      <button
        type="button"
        onClick={() => {
          recordOfferEvent(offer.offerId, "clicked");
          setOffer(null);
          openPricing();
        }}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Получить 100 токенов за 239 ₽
      </button>
    </aside>
  );
}
