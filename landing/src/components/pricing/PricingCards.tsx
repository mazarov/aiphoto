"use client";

import { useEffect, useRef, useState } from "react";
import { PRICING_PLANS, type PricingPlan } from "./pricing-plans";

const rubles = new Intl.NumberFormat("ru-RU");

function CheckIcon({ included }: { included: boolean }) {
  return included ? (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m6 6 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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
        "relative flex min-w-0 flex-col rounded-2xl border p-5 transition duration-200 sm:p-6",
        recommended
          ? "border-emerald-400/70 bg-emerald-950/30 shadow-[0_20px_70px_-35px_rgba(52,211,153,0.75)]"
          : "border-white/10 bg-white/[0.045] hover:border-white/20 hover:bg-white/[0.065]",
      ].join(" ")}
    >
      {recommended && (
        <div className="-mx-5 -mt-5 mb-5 rounded-t-[15px] bg-emerald-300 px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-emerald-950 sm:-mx-6 sm:-mt-6">
          Самый популярный
        </div>
      )}

      <div className={recommended ? "" : "pt-1"}>
        <h2 id={headingId} className="text-lg font-semibold text-white">
          {plan.name}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{plan.level}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-3xl font-bold tracking-tight text-white">
          {rubles.format(plan.price)} ₽
        </span>
        {plan.discount && (
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
            {plan.discount}% скидка
          </span>
        )}
      </div>

      <p className="mt-1 text-base text-zinc-500">/ {rubles.format(plan.credits)} токенов</p>
      <p className="mt-4 inline-flex w-fit rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-zinc-200">
        до {plan.photos} фото / {plan.videos} видео
      </p>

      <div className="my-5 h-px bg-white/10" />

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={[
          "inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          recommended
            ? "bg-emerald-300 text-emerald-950 hover:bg-emerald-200 focus-visible:ring-emerald-300"
            : "bg-white text-zinc-950 hover:bg-zinc-100 focus-visible:ring-white",
        ].join(" ")}
      >
        Выбрать тариф
      </button>

      <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
        {plan.features.map((feature) => (
          <li
            key={feature.label}
            className={`flex items-start gap-2.5 ${feature.included ? "text-zinc-200" : "text-zinc-600"}`}
          >
            <CheckIcon included={feature.included} />
            <span>{feature.label}</span>
          </li>
        ))}
      </ul>
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PRICING_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSelect={showComingSoon} />
        ))}
      </div>

      {notice && (
        <div
          className="pointer-events-none fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-white/10 bg-zinc-900/95 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl lg:bottom-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {notice}
        </div>
      )}
    </>
  );
}
