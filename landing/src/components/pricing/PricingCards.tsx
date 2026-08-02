"use client";

import { useEffect, useRef, useState } from "react";
import { PRICING_PLANS, type PricingPlan } from "./pricing-plans";

const rubles = new Intl.NumberFormat("ru-RU");

function perPhoto(price: number, photos: number): number {
  return Math.round(price / photos);
}

function TokenIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m10 2.5 5.5 7.5L10 17.5 4.5 10 10 2.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4.5 10 5.5 2.5 5.5-2.5M10 2.5v10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="8" r="1.25" stroke="currentColor" strokeWidth="1.25" />
      <path d="m4.5 14 3.25-3 2.25 2 2.25-2 3.25 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 10h12m-4.5-4.5L16 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STAGGER = [0, 45, 90, 135];

function PlanCard({
  plan,
  index,
  onSelect,
}: {
  plan: PricingPlan;
  index: number;
  onSelect: (plan: PricingPlan) => void;
}) {
  const headingId = `pricing-${plan.id}`;
  const recommended = plan.recommended === true;
  const unit = perPhoto(plan.price, plan.photos);

  return (
    <article
      aria-labelledby={headingId}
      style={{ animationDelay: `${STAGGER[index] ?? 0}ms` }}
      className={[
        "group relative flex h-full min-h-0 min-w-0 flex-col rounded-2xl border p-3 shadow-sm motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:animate-slide-up motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out sm:p-5 xl:p-6",
        recommended
          ? "border-indigo-300 bg-gradient-to-b from-indigo-50/75 via-white to-white shadow-[0_18px_45px_-26px_rgba(79,70,229,0.48)] ring-1 ring-indigo-200/60 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_22px_55px_-26px_rgba(79,70,229,0.55)]"
          : "border-zinc-200/90 bg-white motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-indigo-200 motion-safe:hover:shadow-[0_18px_42px_-28px_rgba(79,70,229,0.35)]",
      ].join(" ")}
    >
      {recommended && (
        <div className="absolute -top-2 left-3 z-10 inline-flex rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm shadow-indigo-500/20 sm:-top-3 sm:left-5 sm:px-3 sm:py-1 sm:text-xs">
          Популярный
        </div>
      )}

      <div className="flex min-h-6 min-w-0 items-start justify-between gap-3 sm:min-h-[4.25rem]">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold tracking-tight text-zinc-950 sm:text-lg">
            {plan.name}
          </h2>
          <p className="mt-1 hidden text-sm leading-snug text-zinc-500 sm:block">{plan.tagline}</p>
        </div>
        {plan.discount ? (
          <span
            className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100 sm:px-2.5 sm:py-1 sm:text-xs"
            title="Экономия на стоимости фото относительно пакета «Проба»"
          >
            −{plan.discount}%
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap sm:mt-5">
        <span
          className={[
            "text-2xl font-bold tracking-[-0.04em] sm:text-3xl",
            recommended
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-gradient"
              : "text-zinc-950",
          ].join(" ")}
        >
          {rubles.format(plan.price)} ₽
        </span>
      </div>

      <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-indigo-50/80 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 sm:mt-3 sm:px-2.5 sm:py-1">
        ≈ {unit} ₽/фото
      </span>

      <div className="mt-2 space-y-1 text-xs sm:mt-5 sm:space-y-2.5 sm:text-sm">
        <p className="flex min-w-0 items-center gap-2 text-zinc-700 sm:gap-2.5">
          <TokenIcon />
          <span>{rubles.format(plan.credits)} токенов</span>
        </p>
        <p className="flex min-w-0 items-center gap-2 text-zinc-600 sm:gap-2.5">
          <PhotoIcon />
          <span>до {plan.photos} фото</span>
        </p>
      </div>

      <div className="min-h-2 flex-1 sm:min-h-7" aria-hidden />

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={[
          "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-safe:transition-all motion-safe:duration-200 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm",
          recommended
            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 motion-safe:hover:bg-indigo-700 motion-safe:hover:shadow-md motion-safe:hover:shadow-indigo-500/25"
            : "border border-zinc-200 bg-white text-zinc-800 motion-safe:hover:border-indigo-300 motion-safe:hover:bg-indigo-50/50 motion-safe:hover:text-indigo-700",
        ].join(" ")}
      >
        <span>{plan.ctaLabel}</span>
        <span className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5">
          <ArrowIcon />
        </span>
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
    setNotice(`Пакет «${plan.name}»: оплата появится скоро`);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setNotice(null), 3500);
  };

  return (
    <>
      <div className="mx-auto grid h-full w-full grid-cols-2 grid-rows-2 items-stretch gap-2 sm:max-w-none sm:gap-4 lg:h-auto lg:grid-rows-none lg:gap-5 xl:grid-cols-4">
        {PRICING_PLANS.map((plan, index) => (
          <PlanCard key={plan.id} plan={plan} index={index} onSelect={showComingSoon} />
        ))}
      </div>

      {notice ? (
        <div
          className="pointer-events-none fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 animate-scale-in rounded-full border border-zinc-200 bg-white/95 px-5 py-3 text-sm font-medium text-zinc-800 shadow-xl backdrop-blur-xl lg:bottom-6"
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
