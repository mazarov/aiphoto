"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  getDefaultPricingPlanId,
  getPaywallSwipePlans,
  getPricingPlansByAscendingPrice,
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
  savePricingReturnPath,
  sanitizeYooKassaReturnPath,
} from "@/lib/yookassa-return-path";
import { readYandexCheckoutAttribution } from "@/lib/yandex-attribution-browser";
import { captureBrowserAcquisitionContext } from "@/lib/traffic-source-attribution-browser";
import {
  openRobokassaPayment,
  type RobokassaBrowserPayload,
} from "@/lib/robokassa-browser";
import { announceRobokassaPayment } from "@/lib/robokassa-payment-events";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { applyMailOfferPercent } from "@/lib/mail-offer-price";
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

function SwipeHintIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      className={["h-5 w-5", direction === "prev" ? "-scale-x-100" : ""].join(" ")}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M7.5 4.5 13 10l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

const PAYWALL_SWIPE_MQ = "(max-width: 639px)";

function PaywallPlanCard({
  plan,
  selected,
  onSelect,
  disabled,
  offerPercent,
}: {
  plan: PricingPlan;
  selected: boolean;
  onSelect: (plan: PricingPlan) => void;
  disabled: boolean;
  offerPercent: number | null;
}) {
  const headingId = `pricing-${plan.id}`;
  const salePrice = offerPercent ? applyMailOfferPercent(plan.price, offerPercent) : plan.price;
  const economics = getPricingPlanPhotoEconomics({
    credits: plan.credits,
    price: salePrice,
  });

  return (
    <button
      type="button"
      data-plan-id={plan.id}
      aria-labelledby={headingId}
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onSelect(plan)}
      className={[
        "pricing-paywall-plan relative flex min-h-[98px] min-w-0 flex-col items-start justify-center rounded-xl border bg-white/90 px-3 py-3 text-left shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-wait disabled:opacity-60 sm:min-h-[102px] sm:px-4",
        selected
          ? "border-indigo-500 ring-1 ring-indigo-500"
          : plan.badge
            ? "border-indigo-200 bg-indigo-50/60 hover:border-indigo-400"
            : "border-zinc-200 hover:border-indigo-300",
      ].join(" ")}
    >
      {plan.badge ? (
        <>
          <span
            className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-indigo-500"
            aria-hidden
          />
          <span className="sr-only">{plan.badge}</span>
        </>
      ) : null}
      <h2 id={headingId} className="shrink-0 text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
        {offerPercent && salePrice < plan.price ? (
          <>
            <span className="mr-2 text-base font-medium text-zinc-400 line-through">
              {rubles.format(plan.price)} ₽
            </span>
            {rubles.format(salePrice)} ₽
          </>
        ) : (
          <>{rubles.format(plan.price)} ₽</>
        )}
      </h2>
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
  legalFooter,
  returnPath,
  sortBy = "swipe",
}: {
  variant: PricingPaywallVariant;
  legalFooter?: ReactNode;
  returnPath?: string;
  sortBy?: "swipe" | "price";
}) {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const { closeWithoutHistory } = usePricingModal();
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "idle" });
  const [selectedPlanId, setSelectedPlanId] = useState<PricingPlanId>(
    getDefaultPricingPlanId(variant),
  );
  const [offerPercent, setOfferPercent] = useState<number | null>(null);
  const checkoutInFlightRef = useRef(false);
  const plansScrollerRef = useRef<HTMLDivElement>(null);
  const plans = useMemo(() => {
    const catalog = getPricingPlans(variant);
    return sortBy === "price"
      ? getPricingPlansByAscendingPrice(catalog)
      : getPaywallSwipePlans(catalog);
  }, [sortBy, variant]);
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]!;
  const selectedSalePrice = offerPercent
    ? applyMailOfferPercent(selectedPlan.price, offerPercent)
    : selectedPlan.price;
  const selectedEconomics = getPricingPlanPhotoEconomics({
    credits: selectedPlan.credits,
    price: selectedSalePrice,
  });
  const selectedPlanIndex = plans.findIndex((plan) => plan.id === selectedPlan.id);
  const previousPlan = selectedPlanIndex > 0 ? plans[selectedPlanIndex - 1] ?? null : null;
  const nextPlan = plans[selectedPlanIndex + 1] ?? null;

  const scrollPlanIntoView = useCallback((planId: PricingPlanId) => {
    const root = plansScrollerRef.current;
    const card = root?.querySelector<HTMLElement>(`[data-plan-id="${planId}"]`);
    if (!root || !card) return;
    if (!window.matchMedia(PAYWALL_SWIPE_MQ).matches) return;
    const left = card.offsetLeft - (root.clientWidth - card.offsetWidth) / 2;
    root.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!user || user.is_anonymous === true) {
      setOfferPercent(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { offer?: { percent?: unknown } | null } | null) => {
        if (cancelled) return;
        const percent = Number(data?.offer?.percent);
        setOfferPercent(percent === 10 || percent === 20 ? percent : null);
      })
      .catch(() => {
        if (!cancelled) setOfferPercent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    reachYandexMetrikaGoal(YM_GOAL_PROMPT_CARD_GENERATION_PRICING, {
      experiment_id: PRICING_PAYWALL_EXPERIMENT_ID,
      paywall_variant: variant,
    });
  }, [variant]);

  useEffect(() => {
    const mq = window.matchMedia(PAYWALL_SWIPE_MQ);
    const syncLeadPlan = () => {
      if (!mq.matches) {
        setSelectedPlanId(getDefaultPricingPlanId(variant));
        return;
      }
      const leadId = plans[0]?.id;
      if (leadId) setSelectedPlanId(leadId);
    };
    syncLeadPlan();
    mq.addEventListener("change", syncLeadPlan);
    return () => mq.removeEventListener("change", syncLeadPlan);
  }, [plans, variant]);

  useEffect(() => {
    const root = plansScrollerRef.current;
    if (!root) return;

    const syncFromScroll = () => {
      if (!window.matchMedia(PAYWALL_SWIPE_MQ).matches) return;
      const cards = [...root.querySelectorAll<HTMLElement>("[data-plan-id]")];
      if (cards.length === 0) return;
      const midpoint = root.scrollLeft + root.clientWidth / 2;
      let closest = cards[0]!;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const card of cards) {
        const center = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(center - midpoint);
        if (distance < closestDistance) {
          closest = card;
          closestDistance = distance;
        }
      }
      const planId = closest.dataset.planId;
      if (planId) setSelectedPlanId(planId as PricingPlanId);
    };

    root.addEventListener("scroll", syncFromScroll, { passive: true });
    return () => root.removeEventListener("scroll", syncFromScroll);
  }, [plans]);

  const createCheckout = useCallback(async (pending: PendingCheckout) => {
    if (checkoutInFlightRef.current) return;
    const plan = getPricingPlan(pending.planId, variant);
    if (!plan) {
      clearPendingCheckout();
      setCheckout({ kind: "error", message: "Выбранный пакет не найден" });
      return;
    }
    const checkoutReturnPath = returnPath
      ? sanitizeYooKassaReturnPath(returnPath)
      : readPricingReturnPath();
    if (returnPath) savePricingReturnPath(returnPath);

    checkoutInFlightRef.current = true;
    setCheckout({ kind: "creating", planId: plan.id });
    reachYandexMetrikaGoal(YM_GOAL_PAYMENT_CHECKOUT_STARTED, {
      plan_id: plan.id,
      price_rub: plan.price,
      experiment_id: PRICING_PAYWALL_EXPERIMENT_ID,
      paywall_variant: variant,
    });
    try {
      const yandexAttribution = await readYandexCheckoutAttribution();
      const acquisition = captureBrowserAcquisitionContext();
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          checkoutAttemptId: pending.checkoutAttemptId,
          testAccess:
            new URL(window.location.href).searchParams.get("test") === "true",
          returnPath: checkoutReturnPath,
          ymClientId: yandexAttribution.ymClientId,
          yclid: yandexAttribution.yclid ?? acquisition.yclid,
          visitorId: acquisition.visitorId,
          sessionId: acquisition.sessionId,
          ...acquisition.attribution,
          paywallVariant: variant,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            provider?: "yookassa";
            confirmationUrl?: string;
            alreadyCredited?: boolean;
            credits?: number;
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
        clearPricingReturnPath();
        closeWithoutHistory();
        window.history.replaceState(null, "", checkoutReturnPath);
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
      if (payload.provider === "yookassa" && payload.alreadyCredited === true) {
        const credits = Number(payload.credits || 0);
        clearPricingReturnPath();
        closeWithoutHistory();
        requestCreditBalanceRefresh();
        checkoutInFlightRef.current = false;
        setCheckout({
          kind: "success",
          message: `Оплата прошла. Начислено ${rubles.format(credits)} токенов`,
        });
        return;
      }
      if (payload.provider !== "yookassa" || !payload.confirmationUrl) {
        throw new Error("Платёжный провайдер не вернул форму оплаты");
      }
      clearPricingReturnPath();
      closeWithoutHistory();
      window.history.replaceState(null, "", checkoutReturnPath);
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
  }, [closeWithoutHistory, openAuthModal, returnPath, variant]);

  const selectPlan = useCallback(
    (plan: PricingPlan) => {
      if (checkoutInFlightRef.current) return;
      // Auth first — do not depend on storage / UUID side effects.
      if (returnPath) savePricingReturnPath(returnPath);
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
    [createCheckout, openAuthModal, returnPath, user],
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

  const trustStrip = (
    <div className="pricing-paywall-trust order-1 mb-3 grid shrink-0 grid-cols-3 rounded-xl border border-zinc-100 bg-zinc-50/90 px-2 py-2.5 text-center sm:order-3 sm:mb-0 sm:mt-3">
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
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {trustStrip}
      <div
        className="pricing-paywall-plans-wrap order-2 shrink-0 sm:order-1"
        data-has-prev={previousPlan ? "true" : "false"}
        data-has-next={nextPlan ? "true" : "false"}
      >
        <div
          ref={plansScrollerRef}
          className="pricing-paywall-plans scrollbar-none"
          role="radiogroup"
          aria-label="Выберите пакет токенов"
        >
          {plans.map((plan) => (
            <PaywallPlanCard
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedPlan.id}
              onSelect={(planToSelect) => {
                setSelectedPlanId(planToSelect.id);
                scrollPlanIntoView(planToSelect.id);
              }}
              disabled={checkout.kind === "creating"}
              offerPercent={offerPercent}
            />
          ))}
        </div>
        {previousPlan ? (
          <button
            type="button"
            className="pricing-paywall-swipe-hint absolute top-1/2 left-1 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100"
            aria-label={`Предыдущий тариф: ${previousPlan.name}`}
            onClick={() => {
              setSelectedPlanId(previousPlan.id);
              scrollPlanIntoView(previousPlan.id);
            }}
          >
            <SwipeHintIcon direction="prev" />
          </button>
        ) : null}
        {nextPlan ? (
          <button
            type="button"
            className="pricing-paywall-swipe-hint absolute top-1/2 right-1 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-indigo-600 shadow-md ring-1 ring-indigo-100"
            aria-label={`Следующий тариф: ${nextPlan.name}`}
            onClick={() => {
              setSelectedPlanId(nextPlan.id);
              scrollPlanIntoView(nextPlan.id);
            }}
          >
            <SwipeHintIcon direction="next" />
          </button>
        ) : null}
      </div>
      <div
        className="pricing-paywall-dots order-3 mt-2 flex shrink-0 items-center justify-center gap-1.5 sm:order-2"
        aria-hidden
      >
        {plans.map((plan) => (
          <span
            key={plan.id}
            className={[
              "h-2 rounded-full transition-all",
              plan.id === selectedPlan.id
                ? "w-5 bg-indigo-500"
                : "w-2 bg-zinc-300",
            ].join(" ")}
          />
        ))}
      </div>

      <div className="order-4 mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <section
          className="pricing-paywall-secondary pb-1"
          aria-labelledby="pricing-benefits-heading"
        >
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
        {legalFooter ? (
          <div className="pricing-paywall-legal">{legalFooter}</div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => selectPlan(selectedPlan)}
        disabled={checkout.kind === "creating" || authLoading}
        className="relative z-20 order-5 mt-3 inline-flex min-h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-[#5b5cf0] to-violet-500 px-5 text-base font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-65 sm:text-lg"
      >
        <TokenIcon />
        <span>
          {checkout.kind === "creating"
            ? "Переходим к оплате…"
            : `Получить ${rubles.format(selectedPlan.credits)} токенов`}
        </span>
      </button>

      {checkoutNotice}
    </div>
  );
}
