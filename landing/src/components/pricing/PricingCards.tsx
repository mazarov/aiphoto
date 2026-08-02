"use client";

import { useEffect, useRef, useState } from "react";
import { PRICING_PLANS, type PricingPlan } from "./pricing-plans";

const rubles = new Intl.NumberFormat("ru-RU");

function PlanCard({
  plan,
  onSelect,
}: {
  plan: PricingPlan;
  onSelect: (plan: PricingPlan) => void;
}) {
  const headingId = `pricing-${plan.id}`;
  const recommended = plan.recommended === true;

  return (
    <article
      aria-labelledby={headingId}
      className={[
        "relative flex h-full min-h-0 min-w-0 flex-col rounded-2xl border p-3 transition duration-200 sm:p-5",
        recommended
          ? "border-indigo-300 bg-gradient-to-b from-indigo-50/90 to-white shadow-[0_16px_40px_-28px_rgba(79,70,229,0.55)] ring-1 ring-indigo-200/70"
          : "border-zinc-200/90 bg-white hover:border-zinc-300 hover:shadow-sm",
      ].join(" ")}
    >
      {recommended && (
        <div className="mb-2 inline-flex w-fit rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white sm:mb-3">
          Популярный
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
          {plan.name}
        </h2>
        <p className="text-xs text-zinc-400 sm:text-sm">{plan.level}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-1.5 sm:mt-3 sm:gap-2">
        <span className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {rubles.format(plan.price)} ₽
        </span>
        {plan.discount ? (
          <span className="mb-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            −{plan.discount}%
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-zinc-500">
        {rubles.format(plan.credits)} токенов
      </p>
      <p className="mt-0.5 text-xs text-zinc-400 sm:mt-1">
        до {plan.photos} фото
      </p>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={[
          "mt-auto inline-flex min-h-10 w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:min-h-11 sm:mt-5",
          recommended
            ? "bg-indigo-600 text-white hover:bg-indigo-700"
            : "bg-zinc-900 text-white hover:bg-zinc-800",
        ].join(" ")}
      >
        Выбрать
      </button>
    </article>
  );
}

export function PricingCards() {
  const [notice, setNotice] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showComingSoon = (plan: PricingPlan) => {
    setNotice(`Тариф ${plan.name}: оплата появится скоро`);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setNotice(null), 3500);
  };

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:grid-rows-1 lg:gap-4">
        {PRICING_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSelect={showComingSoon} />
        ))}
      </div>

      {notice ? (
        <div
          className="pointer-events-none fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-zinc-200 bg-white/95 px-5 py-3 text-sm font-medium text-zinc-800 shadow-xl backdrop-blur-xl lg:bottom-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {notice}
        </div>
      ) : null}
    </>
  );
}
