"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { closeRobokassaOverlay } from "@/lib/robokassa-browser";
import {
  clearActiveRobokassaPayment,
  readActiveRobokassaPayment,
  ROBOKASSA_PAYMENT_STARTED_EVENT,
} from "@/lib/robokassa-payment-events";
import { handleParentRobokassaReturnMessage } from "@/lib/robokassa-return-browser";
import {
  reachYandexMetrikaGoal,
  trackYandexPurchase,
  YM_GOAL_PAYMENT_SUCCEEDED,
} from "@/lib/yandex-metrika";

const rubles = new Intl.NumberFormat("ru-RU");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PaymentState =
  | { kind: "idle"; paymentId: null }
  | {
      kind: "pending" | "processing" | "success" | "error";
      paymentId: string;
      message: string;
    };

export function RobokassaPaymentStatus() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PaymentState>({
    kind: "idle",
    paymentId: null,
  });
  const successTrackedRef = useRef(new Set<string>());
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  const start = useCallback((paymentId: string | null) => {
    if (!paymentId || !UUID_PATTERN.test(paymentId)) return;
    setState({
      kind: "pending",
      paymentId,
      message: "Ожидаем подтверждение оплаты…",
    });
  }, []);

  useEffect(() => {
    start(readActiveRobokassaPayment());
    const handleStarted = (event: Event) => {
      start((event as CustomEvent<string>).detail);
    };
    window.addEventListener(ROBOKASSA_PAYMENT_STARTED_EVENT, handleStarted);
    window.addEventListener("message", handleParentRobokassaReturnMessage);
    return () => {
      window.removeEventListener(ROBOKASSA_PAYMENT_STARTED_EVENT, handleStarted);
      window.removeEventListener("message", handleParentRobokassaReturnMessage);
    };
  }, [start]);

  useEffect(() => {
    if (
      state.kind !== "pending" ||
      authLoading ||
      !isAuthed
    ) {
      return;
    }
    const paymentId = state.paymentId;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 24;
    const delay = () => (attempts <= 6 ? 2_000 : attempts <= 15 ? 5_000 : 10_000);

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/payments/robokassa/${paymentId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              status?: string;
              credits?: number;
              amountRub?: number;
              planId?: string;
              paymentId?: string;
              message?: string;
            }
          | null;
        if (!response.ok) {
          throw new Error(payload?.message || "Не удалось проверить оплату");
        }
        if (stopped) return;
        if (payload?.status === "succeeded") {
          const credits = Number(payload.credits || 0);
          setState({
            kind: "success",
            paymentId,
            message: `Оплата прошла. Начислено ${rubles.format(credits)} токенов`,
          });
          closeRobokassaOverlay();
          clearActiveRobokassaPayment(paymentId);
          requestCreditBalanceRefresh();
          if (!successTrackedRef.current.has(paymentId)) {
            successTrackedRef.current.add(paymentId);
            reachYandexMetrikaGoal(YM_GOAL_PAYMENT_SUCCEEDED, {
              provider: "robokassa",
              credits,
            });
            const priceRub = Number(payload.amountRub);
            if (Number.isFinite(priceRub) && priceRub > 0 && payload.planId) {
              trackYandexPurchase({
                orderId: payload.paymentId || paymentId,
                priceRub,
                planId: payload.planId,
                credits,
              });
            }
          }
          return;
        }
        if (attempts >= maxAttempts) {
          setState({
            kind: "processing",
            paymentId,
            message: "Платёж обрабатывается. Баланс обновится после подтверждения.",
          });
          return;
        }
        timer = setTimeout(poll, delay());
      } catch (error) {
        if (stopped) return;
        if (attempts < maxAttempts) {
          timer = setTimeout(poll, delay());
          return;
        }
        setState({
          kind: "error",
          paymentId,
          message:
            error instanceof Error ? error.message : "Не удалось проверить оплату",
        });
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, isAuthed, state]);

  if (state.kind === "idle") return null;
  return (
    <div
      className={[
        "fixed bottom-[calc(3.5rem+0.75rem+max(0px,env(safe-area-inset-bottom,0px)))] left-1/2 z-[250] w-[min(92vw,34rem)] -translate-x-1/2 animate-scale-in rounded-2xl border bg-white/95 px-5 py-3 text-center text-sm font-medium shadow-xl backdrop-blur-xl lg:bottom-6",
        state.kind === "success"
          ? "border-emerald-200 text-emerald-800"
          : state.kind === "error"
            ? "border-red-200 text-red-700"
            : "border-zinc-200 text-zinc-800",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {state.message}
    </div>
  );
}
