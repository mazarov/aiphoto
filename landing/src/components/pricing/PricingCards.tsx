"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getDefaultPricingPlanId,
  getPricingPlan,
  getPricingPlanPhotoEconomics,
  getPricingPlans,
  type PricingPlan,
  type PricingPlanId,
} from "./pricing-plans";
import {
  PRICING_PAYWALL_EXPERIMENT_ID,
  type PricingPaywallVariant,
} from "@/lib/pricing-paywall-experiment";
import { useAuth } from "@/context/AuthContext";
import { usePricingModal } from "@/context/PricingModalContext";
import {
  clearPricingReturnPath,
  readPricingReturnPath,
} from "@/lib/yookassa-return-path";
import { readYandexCheckoutAttribution } from "@/lib/yandex-attribution-browser";
import {
  openRobokassaPayment,
  type RobokassaBrowserPayload,
} from "@/lib/robokassa-browser";
import { announceRobokassaPayment } from "@/lib/robokassa-payment-events";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PAYMENT_CHECKOUT_STARTED,
  YM_GOAL_PAYMENT_IFRAME_OPENED,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
  YM_GOAL_YOOKASSA_CHECKOUT_REDIRECT,
} from "@/lib/yandex-metrika";

const rubles = new Intl.NumberFormat("ru-RU");
const PENDING_CHECKOUT_KEY = "promptshot:payment-pending-checkout";
const PAYMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutState =
  | { kind: "idle" }
  | { kind: "creating"; planId: string }
  | { kind: "pending"; message: string }
  | { kind: "success"; message: string }
  | { kind: "canceled"; message: string }
  | { kind: "error"; message: string };

type PendingCheckout = {
  planId: string;
  checkoutAttemptId: string;
};

function needsCheckoutAuth(user: { is_anonymous?: boolean } | null | undefined): boolean {
  return !user || user.is_anonymous === true;
}

function createCheckoutAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === "x" ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

function savePendingCheckout(pending: PendingCheckout): void {
  try {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
  } catch {
    // Private mode / blocked storage — auth + checkout can still proceed later.
  }
}

function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingCheckout>;
    if (
      typeof pending.planId === "string" &&
      typeof pending.checkoutAttemptId === "string" &&
      PAYMENT_ID_PATTERN.test(pending.checkoutAttemptId)
    ) {
      return pending as PendingCheckout;
    }
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    try {
      sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    } catch {
      // ignore
    }
  }
  return null;
}

function clearPendingCheckout(): void {
  try {
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // ignore
  }
}

function TokenIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-yellow-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M11.4 1.75 4.7 10.2a.8.8 0 0 0 .63 1.3h3.5l-.65 6a.75.75 0 0 0 1.34.54l6.15-8.25a.8.8 0 0 0-.64-1.28H11.7l.99-6.13a.75.75 0 0 0-1.29-.63Z" />
    </svg>
  );
}

function CheckIcon({ className = "text-zinc-100" }: { className?: string }) {
  return (
    <svg className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m3.5 10.5 4 4 9-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaywallPlanCard({
  plan,
  selected,
  onSelect,
  disabled,
}: {
  plan: PricingPlan;
  selected: boolean;
  onSelect: (plan: PricingPlan) => void;
  disabled: boolean;
}) {
  const headingId = `pricing-${plan.id}`;
  const economics = getPricingPlanPhotoEconomics(plan);

  return (
    <button
      type="button"
      aria-labelledby={headingId}
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onSelect(plan)}
      className={[
        "relative flex min-h-[98px] min-w-0 flex-col items-start justify-center rounded-xl border bg-white/90 px-3 py-3 text-left shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-wait disabled:opacity-60 sm:min-h-[102px] sm:px-4",
        selected
          ? "border-indigo-500 ring-1 ring-indigo-500"
          : "border-zinc-200 hover:border-indigo-300",
      ].join(" ")}
    >
      <div className="flex w-full min-w-0 items-center gap-1.5 pr-7">
        <h2 id={headingId} className="shrink-0 text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
          {rubles.format(plan.price)} ₽
        </h2>
        {plan.badge ? (
          <span
            className={[
              "min-w-0 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none sm:px-2 sm:text-xs",
              plan.id === "max"
                ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                : "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30",
            ].join(" ")}
          >
            {plan.badge}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-sm text-zinc-500 sm:text-base">
        <TokenIcon />
        <span>{rubles.format(plan.credits)} токенов</span>
      </div>
      <span className="mt-0.5 text-xs font-semibold text-indigo-600">
        от {economics.fromRubPerPhoto} ₽/фото
      </span>
      <span
        aria-hidden
        className={[
          "absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border",
          selected
            ? "border-indigo-500 bg-indigo-500 text-white"
            : "border-zinc-300 text-transparent",
        ].join(" ")}
      >
        <CheckIcon />
      </span>
    </button>
  );
}

export function PricingCards({
  variant,
}: {
  variant: PricingPaywallVariant;
}) {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const { closeWithoutHistory } = usePricingModal();
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "idle" });
  const [selectedPlanId, setSelectedPlanId] = useState<PricingPlanId>(
    getDefaultPricingPlanId(variant),
  );
  const checkoutInFlightRef = useRef(false);
  const plans = getPricingPlans(variant);
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]!;
  const selectedEconomics = getPricingPlanPhotoEconomics(selectedPlan);

  useEffect(() => {
    reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING, {
      experiment_id: PRICING_PAYWALL_EXPERIMENT_ID,
      paywall_variant: variant,
    });
  }, [variant]);

  const createCheckout = useCallback(async (pending: PendingCheckout) => {
    if (checkoutInFlightRef.current) return;
    const plan = getPricingPlan(pending.planId, variant);
    if (!plan) {
      clearPendingCheckout();
      setCheckout({ kind: "error", message: "Выбранный пакет не найден" });
      return;
    }

    checkoutInFlightRef.current = true;
    setCheckout({ kind: "creating", planId: plan.id });
    reachYandexMetrikaGoal(YM_GOAL_PAYMENT_CHECKOUT_STARTED, {
      plan_id: plan.id,
      price_rub: plan.price,
      experiment_id: PRICING_PAYWALL_EXPERIMENT_ID,
      paywall_variant: variant,
    });
    try {
      const attribution = await readYandexCheckoutAttribution();
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          checkoutAttemptId: pending.checkoutAttemptId,
          testAccess:
            new URL(window.location.href).searchParams.get("test") === "true",
          returnPath: readPricingReturnPath(),
          ymClientId: attribution.ymClientId,
          yclid: attribution.yclid,
          paywallVariant: variant,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            provider?: "yookassa";
            confirmationUrl?: string;
            message?: string;
          }
        | {
            provider?: "robokassa";
            paymentId?: string;
            payload?: RobokassaBrowserPayload;
            message?: string;
          }
        | null;
      if (response.status === 401) {
        checkoutInFlightRef.current = false;
        setCheckout({ kind: "idle" });
        openAuthModal();
        return;
      }
      if (!response.ok || !payload) {
        throw new Error(payload?.message || "Не удалось создать оплату");
      }

      clearPendingCheckout();
      if (
        payload.provider === "robokassa" &&
        payload.paymentId &&
        payload.payload
      ) {
        await openRobokassaPayment(payload.payload);
        announceRobokassaPayment(payload.paymentId);
        const returnPath = readPricingReturnPath();
        clearPricingReturnPath();
        closeWithoutHistory();
        window.history.replaceState(null, "", returnPath);
        reachYandexMetrikaGoal(YM_GOAL_PAYMENT_IFRAME_OPENED, {
          provider: "robokassa",
          plan_id: plan.id,
          experiment_id: PRICING_PAYWALL_EXPERIMENT_ID,
          paywall_variant: variant,
        });
        checkoutInFlightRef.current = false;
        setCheckout({
          kind: "pending",
          message: "Форма оплаты открыта поверх страницы",
        });
        return;
      }
      if (payload.provider !== "yookassa" || !payload.confirmationUrl) {
        throw new Error("Платёжный провайдер не вернул форму оплаты");
      }
      const returnPath = readPricingReturnPath();
      clearPricingReturnPath();
      closeWithoutHistory();
      window.history.replaceState(null, "", returnPath);
      reachYandexMetrikaGoal(YM_GOAL_YOOKASSA_CHECKOUT_REDIRECT, {
        plan_id: plan.id,
        experiment_id: PRICING_PAYWALL_EXPERIMENT_ID,
        paywall_variant: variant,
      });
      window.location.assign(payload.confirmationUrl);
    } catch (error) {
      checkoutInFlightRef.current = false;
      setCheckout({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось создать оплату. Попробуйте ещё раз.",
      });
    }
  }, [closeWithoutHistory, openAuthModal, variant]);

  const selectPlan = useCallback(
    (plan: PricingPlan) => {
      if (checkoutInFlightRef.current) return;
      // Auth first — do not depend on storage / UUID side effects.
      if (needsCheckoutAuth(user)) {
        const pending: PendingCheckout = {
          planId: plan.id,
          checkoutAttemptId: createCheckoutAttemptId(),
        };
        savePendingCheckout(pending);
        openAuthModal();
        return;
      }
      const pending: PendingCheckout = {
        planId: plan.id,
        checkoutAttemptId: createCheckoutAttemptId(),
      };
      savePendingCheckout(pending);
      void createCheckout(pending);
    },
    [createCheckout, openAuthModal, user],
  );

  useEffect(() => {
    if (authLoading || needsCheckoutAuth(user)) return;
    const pending = readPendingCheckout();
    if (!pending) return;
    void createCheckout(pending);
  }, [authLoading, createCheckout, user]);

  const checkoutNotice =
    checkout.kind !== "idle" && checkout.kind !== "creating" ? (
      <div
        className={[
          "fixed bottom-[calc(1rem+max(0px,env(safe-area-inset-bottom,0px)))] left-1/2 z-[300] w-[min(92vw,30rem)] -translate-x-1/2 animate-scale-in rounded-2xl border bg-zinc-900/95 px-5 py-3 text-center text-sm font-medium shadow-xl backdrop-blur-xl",
          checkout.kind === "success"
            ? "border-emerald-500/40 text-emerald-200"
            : checkout.kind === "error"
              ? "border-red-500/40 text-red-200"
              : "border-zinc-700 text-zinc-100",
        ].join(" ")}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {checkout.message}
      </div>
    ) : null;

  return (
    <>
      <div
        className="grid w-full min-w-0 grid-cols-2 gap-2 sm:gap-3"
        role="radiogroup"
        aria-label="Выберите пакет токенов"
      >
        {plans.map((plan) => (
          <PaywallPlanCard
            key={plan.id}
            plan={plan}
            selected={plan.id === selectedPlan.id}
            onSelect={(nextPlan) => setSelectedPlanId(nextPlan.id)}
            disabled={checkout.kind === "creating"}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 rounded-xl border border-zinc-100 bg-zinc-50/90 px-2 py-2.5 text-center">
        <div className="px-1">
          <strong className="block text-xs font-semibold text-zinc-900 sm:text-sm">
            Разовая
          </strong>
          <span className="block text-[10px] leading-tight text-zinc-500 sm:text-xs">
            покупка
          </span>
        </div>
        <div className="border-x border-zinc-200 px-1">
          <strong className="block text-xs font-semibold text-zinc-900 sm:text-sm">
            Без срока
          </strong>
          <span className="block text-[10px] leading-tight text-zinc-500 sm:text-xs">
            токены не сгорают
          </span>
        </div>
        <div className="px-1">
          <strong className="block text-xs font-semibold text-zinc-900 sm:text-sm">
            Без подписки
          </strong>
          <span className="block text-[10px] leading-tight text-zinc-500 sm:text-xs">
            и автосписаний
          </span>
        </div>
      </div>

      <section className="mt-4" aria-labelledby="pricing-benefits-heading">
        <h2
          id="pricing-benefits-heading"
          className="text-base font-semibold text-zinc-950 sm:text-lg"
        >
          Что вы получите:
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-snug text-zinc-600 sm:text-base">
          <li className="flex gap-1.5">
            <CheckIcon className="text-indigo-600" />
            <span>
              <strong className="font-semibold text-zinc-950">
                {selectedEconomics.minPhotos}–{selectedEconomics.maxPhotos} фото
              </strong>{" "}
              в зависимости от модели
            </span>
          </li>
          <li className="flex gap-1.5">
            <CheckIcon className="text-indigo-600" />
            <span>
              Доступ к{" "}
              <Link
                href="/generaciya-foto"
                className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-500"
              >
                готовым ИИ-фотосессиям
              </Link>
            </span>
          </li>
          <li className="flex gap-1.5">
            <CheckIcon className="text-indigo-600" />
            <span>Вернём токены за неудачные фото</span>
          </li>
          <li className="flex gap-1.5">
            <CheckIcon className="text-indigo-600" />
            <span>Повторяйте тренды в несколько кликов</span>
          </li>
          <li className="flex gap-1.5">
            <CheckIcon className="text-indigo-600" />
            <span>Семейные и парные портреты</span>
          </li>
          <li className="flex gap-1.5">
            <CheckIcon className="text-indigo-600" />
            <span>Без водяных знаков</span>
          </li>
        </ul>
      </section>

      <button
        type="button"
        onClick={() => selectPlan(selectedPlan)}
        disabled={checkout.kind === "creating" || authLoading}
        className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-[#5b5cf0] to-violet-500 px-5 text-base font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-65 sm:text-lg"
      >
        <TokenIcon />
        <span>
          {checkout.kind === "creating"
            ? "Переходим к оплате…"
            : `Получить ${rubles.format(selectedPlan.credits)} токенов`}
        </span>
      </button>

      {checkoutNotice}
    </>
  );
}
