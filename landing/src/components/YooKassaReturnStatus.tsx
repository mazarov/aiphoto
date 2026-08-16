"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { isYooKassaPaymentId } from "@/lib/yookassa-return-path";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_YOOKASSA_PAYMENT_SUCCEEDED,
} from "@/lib/yandex-metrika";

const rubles = new Intl.NumberFormat("ru-RU");

type ReturnState =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "success"; message: string }
  | { kind: "canceled"; message: string }
  | { kind: "error"; message: string };

/**
 * Polls YooKassa return (`?payment=`) on any page so checkout can land
 * back on the listing instead of hard `/pricing`.
 */
export function YooKassaReturnStatus() {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [status, setStatus] = useState<ReturnState>({ kind: "idle" });
  const successTrackedRef = useRef(false);
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentId = url.searchParams.get("payment");
    if (!isYooKassaPaymentId(paymentId)) return;
    if (authLoading) return;
    if (!isAuthed) {
      setStatus({
        kind: "error",
        message: "Войдите в аккаунт, чтобы проверить оплату",
      });
      openAuthModal();
      return;
    }

    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 20;
    const pollDelayMs = (attempt: number) => {
      if (attempt <= 5) return 2_000;
      if (attempt <= 12) return 5_000;
      return 10_000;
    };
    setStatus({ kind: "pending", message: "Проверяем оплату…" });

    const stripPaymentQuery = () => {
      const next = new URL(window.location.href);
      if (!next.searchParams.has("payment")) return;
      next.searchParams.delete("payment");
      const search = next.searchParams.toString();
      window.history.replaceState(
        null,
        "",
        `${next.pathname}${search ? `?${search}` : ""}${next.hash}`,
      );
    };

    const checkStatus = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/payments/yookassa/${paymentId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { status?: string; credits?: number; message?: string }
          | null;
        if (!response.ok) {
          if (response.status === 401) {
            setStatus({ kind: "idle" });
            openAuthModal();
            return;
          }
          throw new Error(payload?.message || "Не удалось проверить оплату");
        }
        if (canceled) return;

        if (payload?.status === "succeeded") {
          const credits = Number(payload.credits || 0);
          setStatus({
            kind: "success",
            message: `Оплата прошла. Начислено ${rubles.format(credits)} токенов`,
          });
          requestCreditBalanceRefresh();
          if (!successTrackedRef.current) {
            successTrackedRef.current = true;
            reachYandexMetrikaGoal(YM_GOAL_YOOKASSA_PAYMENT_SUCCEEDED, {
              credits,
            });
          }
          stripPaymentQuery();
          return;
        }
        if (payload?.status === "canceled") {
          setStatus({
            kind: "canceled",
            message: "Оплата отменена. Токены не списаны и не начислены.",
          });
          stripPaymentQuery();
          return;
        }
        if (attempts >= maxAttempts) {
          setStatus({
            kind: "pending",
            message: "Платёж обрабатывается. Баланс обновится после подтверждения.",
          });
          return;
        }
        timer = setTimeout(checkStatus, pollDelayMs(attempts));
      } catch (error) {
        if (canceled) return;
        if (attempts < maxAttempts) {
          timer = setTimeout(checkStatus, pollDelayMs(attempts));
          return;
        }
        setStatus({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Не удалось проверить оплату",
        });
      }
    };

    void checkStatus();
    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, isAuthed, openAuthModal]);

  if (status.kind === "idle") return null;

  return (
    <div
      className={[
        "fixed bottom-[calc(3.5rem+0.75rem+max(0px,env(safe-area-inset-bottom,0px)))] left-1/2 z-[90] w-[min(92vw,34rem)] -translate-x-1/2 animate-scale-in rounded-2xl border bg-white/95 px-5 py-3 text-center text-sm font-medium shadow-xl backdrop-blur-xl lg:bottom-6",
        status.kind === "success"
          ? "border-emerald-200 text-emerald-800"
          : status.kind === "error"
            ? "border-red-200 text-red-700"
            : "border-zinc-200 text-zinc-800",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {status.message}
    </div>
  );
}
