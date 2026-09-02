"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { CREDIT_BALANCE_REFRESH_EVENT, requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { syncUnpaidBannerHeightCssVar } from "@/lib/listing-header-offset";
import {
  formatUnpaidBannerCountdown,
  isSafeYooKassaConfirmationUrl,
  isUnpaidBannerPathHidden,
  persistUnpaidBannerDismiss,
  resolveUnpaidBanner,
  unpaidBannerCopy,
  unpaidBannerDismissedPaymentId,
  type UnpaidBannerSnapshot,
} from "@/lib/unpaid-checkout-banner";
import {
  openRobokassaPayment,
  type RobokassaBrowserPayload,
} from "@/lib/robokassa-browser";
import { announceRobokassaPayment } from "@/lib/robokassa-payment-events";
import {
  isYooKassaPaymentId,
  sanitizeYooKassaReturnPath,
} from "@/lib/yookassa-return-path";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PAYMENT_CHECKOUT_STARTED,
  YM_GOAL_PAYMENT_IFRAME_OPENED,
  YM_GOAL_YOOKASSA_CHECKOUT_REDIRECT,
} from "@/lib/yandex-metrika";

const REFRESH_MS = 30_000;

function paymentQueryPresent(): boolean {
  if (typeof window === "undefined") return false;
  return isYooKassaPaymentId(new URL(window.location.href).searchParams.get("payment"));
}

export function UnpaidCheckoutBanner() {
  const pathname = usePathname();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const isAuthed = Boolean(user && user.is_anonymous !== true);
  const [snapshot, setSnapshot] = useState<UnpaidBannerSnapshot | null>(null);
  const [dismissedPaymentId, setDismissedPaymentId] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hasPaymentQuery, setHasPaymentQuery] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const checkoutInFlightRef = useRef(false);

  const hiddenPath = isUnpaidBannerPathHidden(pathname || "/");

  useEffect(() => {
    setDismissedPaymentId(unpaidBannerDismissedPaymentId(window.localStorage));
    setHasPaymentQuery(paymentQueryPresent());
  }, [pathname]);

  const load = useCallback(async () => {
    if (!isAuthed) {
      setSnapshot(null);
      return;
    }
    try {
      const response = await fetch("/api/payments/unpaid-banner", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        banner?: UnpaidBannerSnapshot | null;
      } | null;
      setSnapshot(payload?.banner ?? null);
    } catch {
      setSnapshot(null);
    }
  }, [isAuthed]);

  const continueCheckout = useCallback(
    async (planId: string) => {
      if (checkoutInFlightRef.current) return;
      checkoutInFlightRef.current = true;
      setCheckoutBusy(true);
      setCheckoutError("");
      reachYandexMetrikaGoal(YM_GOAL_PAYMENT_CHECKOUT_STARTED, {
        plan_id: planId,
        source: "unpaid_banner",
        ...(snapshot?.provider ? { provider: snapshot.provider } : {}),
      });
      try {
        const returnPath = sanitizeYooKassaReturnPath(
          window.location.pathname + window.location.search,
        );
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            planId,
            checkoutAttemptId: crypto.randomUUID(),
            returnPath,
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              provider?: "yookassa";
              confirmationUrl?: string;
              alreadyCredited?: boolean;
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
          openAuthModal();
          return;
        }
        if (!response.ok || !payload) {
          throw new Error(payload?.message || "Не удалось открыть оплату");
        }
        if ("alreadyCredited" in payload && payload.alreadyCredited === true) {
          requestCreditBalanceRefresh();
          persistUnpaidBannerDismiss(
            window.localStorage,
            snapshot?.paymentId || "",
          );
          setDismissedPaymentId(snapshot?.paymentId || "");
          return;
        }
        if (
          payload.provider === "robokassa" &&
          payload.paymentId &&
          payload.payload
        ) {
          await openRobokassaPayment(payload.payload);
          announceRobokassaPayment(payload.paymentId, returnPath);
          reachYandexMetrikaGoal(YM_GOAL_PAYMENT_IFRAME_OPENED, {
            provider: "robokassa",
            plan_id: planId,
            source: "unpaid_banner",
          });
          return;
        }
        if (
          payload.provider !== "yookassa" ||
          !isSafeYooKassaConfirmationUrl(payload.confirmationUrl)
        ) {
          throw new Error("Платёжный провайдер не вернул форму оплаты");
        }
        reachYandexMetrikaGoal(YM_GOAL_YOOKASSA_CHECKOUT_REDIRECT, {
          plan_id: planId,
          source: "unpaid_banner",
        });
        window.location.assign(payload.confirmationUrl!);
      } catch (error) {
        setCheckoutError(
          error instanceof Error ? error.message : "Не удалось открыть оплату",
        );
      } finally {
        checkoutInFlightRef.current = false;
        setCheckoutBusy(false);
      }
    },
    [openAuthModal, snapshot?.paymentId, snapshot?.provider],
  );

  useEffect(() => {
    if (authLoading || hiddenPath) return;
    void load();
    const onRefresh = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener(CREDIT_BALANCE_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      window.removeEventListener(CREDIT_BALANCE_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [authLoading, hiddenPath, load]);

  const view = resolveUnpaidBanner({
    nowMs,
    snapshot,
    dismissedPaymentId,
    paymentQueryPresent: hasPaymentQuery,
  });
  const visible = view.visible && !hiddenPath && isAuthed;

  useEffect(() => {
    if (!visible || view.visible !== true || view.phase !== "flash") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visible, view]);

  useEffect(() => {
    const el = barRef.current;
    if (!visible || !el) {
      syncUnpaidBannerHeightCssVar(0);
      return;
    }
    const update = () => syncUnpaidBannerHeightCssVar(el.offsetHeight);
    update();
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      syncUnpaidBannerHeightCssVar(box?.blockSize ?? el.offsetHeight);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      syncUnpaidBannerHeightCssVar(0);
    };
  }, [visible]);

  if (!visible || view.visible !== true) return null;

  const copy = unpaidBannerCopy(view);
  const countdown =
    view.phase === "flash" && view.remainingMs != null
      ? formatUnpaidBannerCountdown(view.remainingMs)
      : null;

  return (
    <div
      ref={barRef}
      className="sticky top-0 z-[60] border-b border-white/10 bg-zinc-950 text-white"
      role="region"
      aria-label="Незавершенная оплата"
    >
      <div className="relative mx-auto flex min-h-11 max-w-5xl items-center justify-center gap-2 px-11 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3">
        <p className="min-w-0 text-center text-sm font-medium leading-snug">
          {copy.message}
          {countdown ? (
            <span className="tabular-nums text-indigo-200">
              {" "}
              · {countdown}
            </span>
          ) : null}
          {checkoutError ? (
            <span className="block text-rose-200">{checkoutError}</span>
          ) : null}
        </p>
        <button
          type="button"
          disabled={checkoutBusy}
          className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
          onClick={() => {
            void continueCheckout(view.planId);
          }}
        >
          {checkoutBusy ? "Открываем оплату…" : copy.action}
        </button>
        <button
          type="button"
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white/70 transition hover:text-white"
          aria-label="Закрыть"
          onClick={() => {
            persistUnpaidBannerDismiss(window.localStorage, view.paymentId);
            setDismissedPaymentId(view.paymentId);
            syncUnpaidBannerHeightCssVar(0);
          }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
