"use client";

import type { ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import type { GenerationResultAction } from "@/components/generate/GenerationResultActionRail";
import { PublishRewardBadge } from "@/components/generate/PublishRewardBadge";

type Props = {
  actions: GenerationResultAction[];
  film?: ReactNode;
  offerBanner?: ReactNode;
  className?: string;
};

const ICON_ONLY_IDS = new Set(["download", "view", "repeat", "copy"]);

/**
 * Compact bottom glass-bar for the post-generation result screen.
 * Keeps the generated portrait completely unobstructed (replaces the tall
 * vertical right-hand column) while preserving 1-tap access to every action.
 */
export function GenerationResultBottomBar({
  actions,
  film = null,
  offerBanner = null,
  className = "",
}: Props) {
  if (!actions.length) return null;

  const primary = actions.find((item) => item.primary) ?? null;
  const featured =
    actions.find((item) => !item.primary && item.accent === "orbit") ?? null;
  const iconUtilities = actions.filter(
    (item) =>
      item !== primary && item !== featured && ICON_ONLY_IDS.has(item.id),
  );
  const secondaryChips = actions.filter(
    (item) =>
      item !== primary && item !== featured && !ICON_ONLY_IDS.has(item.id),
  );

  return (
    <div
      className={`pointer-events-none flex flex-col gap-2 ${className}`.trim()}
      role="toolbar"
      aria-label="Действия с результатом"
    >
      {offerBanner ? (
        <div className="pointer-events-auto self-end">{offerBanner}</div>
      ) : null}

      {film ? <div className="pointer-events-auto w-full">{film}</div> : null}

      {secondaryChips.length > 0 ? (
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto overscroll-x-contain py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {secondaryChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={chip.disabled}
              aria-label={chip.ariaLabel || chip.label}
              title={
                chip.detail ? `${chip.label} · ${chip.detail}` : chip.label
              }
              onClick={chip.onClick}
              className={`${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-zinc-950/65 px-3 py-1.5 text-[13px] font-semibold leading-none text-white/90 ring-1 ring-white/20 backdrop-blur-xl transition hover:bg-zinc-900/80 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                aria-hidden
              >
                {chip.icon}
              </span>
              <span className="whitespace-nowrap">{chip.label}</span>
              {chip.creditRewardLabel ? (
                <PublishRewardBadge
                  label={chip.creditRewardLabel}
                  className="ml-0.5"
                />
              ) : typeof chip.creditReward === "number" ? (
                <PublishRewardBadge credits={chip.creditReward} className="ml-0.5" />
              ) : typeof chip.creditCost === "number" ? (
                <GenerationCreditCostBadge
                  cost={chip.creditCost}
                  unaffordable={chip.creditUnaffordable}
                  compact
                  className="ml-0.5"
                />
              ) : chip.detail === "бесплатно" ? (
                <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white/80">
                  0✦
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl bg-zinc-950/70 p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.48)] ring-1 ring-white/15 backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {primary ? (
            <button
              type="button"
              disabled={primary.disabled}
              aria-label={primary.ariaLabel || primary.label}
              onClick={primary.onClick}
              className={`${OVERLAY_BUTTON_UA_RESET} relative inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 text-[13px] font-semibold leading-none text-white shadow-md shadow-indigo-950/35 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                aria-hidden
              >
                {primary.icon}
              </span>
              <span className="truncate">{primary.label}</span>
              {typeof primary.creditCost === "number" ? (
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${
                    primary.creditUnaffordable ? "bg-rose-400/95" : "bg-white/20"
                  }`}
                >
                  {primary.creditCost}✦
                </span>
              ) : null}
            </button>
          ) : null}

          {featured ? (
            <button
              type="button"
              disabled={featured.disabled}
              aria-label={featured.ariaLabel || featured.label}
              onClick={featured.onClick}
              className={`${OVERLAY_BUTTON_UA_RESET} result-animate-cta relative isolate inline-flex h-11 shrink-0 items-center justify-center gap-1.5 overflow-visible rounded-xl bg-white/12 px-3 text-[13px] font-semibold leading-none text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="result-animate-cta__sheen" aria-hidden />
              <span className="result-animate-cta__orbit" aria-hidden>
                <span className="result-animate-cta__spin" />
              </span>
              <span
                className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                aria-hidden
              >
                {featured.icon}
              </span>
              <span className="relative z-10 whitespace-nowrap">
                {featured.label}
              </span>
              {typeof featured.creditCost === "number" ? (
                <span
                  className={`relative z-10 inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${
                    featured.creditUnaffordable
                      ? "bg-rose-400/95 text-white"
                      : "bg-indigo-500/80 text-white"
                  }`}
                >
                  {featured.creditCost}✦
                </span>
              ) : null}
            </button>
          ) : null}
        </div>

        {iconUtilities.length > 0 ? (
          <div className="flex shrink-0 items-center gap-1">
            {iconUtilities.map((util) => (
              <button
                key={util.id}
                type="button"
                disabled={util.disabled}
                aria-label={util.ariaLabel || util.label}
                title={
                  util.detail ? `${util.label} (${util.detail})` : util.label
                }
                onClick={util.onClick}
                className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/90 ring-1 ring-inset ring-white/15 transition hover:bg-white/20 hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center"
                  aria-hidden
                >
                  {util.icon}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
