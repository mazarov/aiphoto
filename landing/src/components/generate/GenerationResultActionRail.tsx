"use client";

import type { ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import { PublishRewardBadge } from "@/components/generate/PublishRewardBadge";

export type GenerationResultAction = {
  id: string;
  label: string;
  /** Second line under the label — same 13px tier, quieter. */
  detail?: string;
  /** Same `N✦` pill as photo/video model tiles in the generate modal. */
  creditCost?: number;
  creditUnaffordable?: boolean;
  /** Emerald `+N✦` for publish bonus — not a spend. */
  creditReward?: number;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  ariaLabel?: string;
  /** Thin violet stripe along the border; plays ~8s on show, then fades. */
  accent?: "orbit";
  /** Allow two-line labels in the narrow rail. */
  wrap?: boolean;
};

type Props = {
  actions: GenerationResultAction[];
  className?: string;
  /** Sits in one row with the last rail button (primary CTA). */
  beforePrimary?: ReactNode;
};

export const RESULT_RAIL_BUTTON_BASE = `${OVERLAY_BUTTON_UA_RESET} relative flex min-h-12 w-full items-center justify-start gap-1.5 rounded-2xl px-3 py-3 text-left text-[13px] font-semibold active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`;
/** Same glass as prompt-card chips (`CARD_OVERLAY_ACTION_PILL` / `MOBILE_FS_*`). */
export const RESULT_RAIL_BUTTON_GLASS = `bg-black/15 text-white/90 shadow-none backdrop-blur-md transition-colors hover:bg-black/25`;
const RAIL_BTN = `${RESULT_RAIL_BUTTON_BASE} overflow-hidden ${RESULT_RAIL_BUTTON_GLASS}`;
/** Brand CTA — same indigo→violet as generate / credit badge. */
const RAIL_BTN_PRIMARY = `${RESULT_RAIL_BUTTON_BASE} overflow-hidden bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-950/35 transition hover:brightness-110`;
/** Glass fill; glow must not clip — orbit/sheen live inside. */
const RAIL_BTN_ORBIT = `${RESULT_RAIL_BUTTON_BASE} relative isolate overflow-visible ${RESULT_RAIL_BUTTON_GLASS} result-animate-cta`;
const RAIL_BTN_CREDIT = `${RESULT_RAIL_BUTTON_BASE} mt-1.5 overflow-visible ${RESULT_RAIL_BUTTON_GLASS}`;

function hasTopCreditBadge(action: GenerationResultAction) {
  return action.creditCost != null || action.creditReward != null;
}

function railButtonClass(action: GenerationResultAction) {
  if (action.primary) return RAIL_BTN_PRIMARY;
  if (action.accent === "orbit") {
    return hasTopCreditBadge(action) ? `${RAIL_BTN_ORBIT} mt-1.5` : RAIL_BTN_ORBIT;
  }
  if (hasTopCreditBadge(action)) return RAIL_BTN_CREDIT;
  return RAIL_BTN;
}

function RailActionButton({ action }: { action: GenerationResultAction }) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      aria-label={action.ariaLabel}
      onClick={action.onClick}
      className={railButtonClass(action)}
    >
      {action.accent === "orbit" ? (
        <>
          <span className="result-animate-cta__sheen" aria-hidden />
          <span className="result-animate-cta__orbit" aria-hidden>
            <span className="result-animate-cta__spin" />
          </span>
        </>
      ) : null}
      {typeof action.creditReward === "number" ? (
        <PublishRewardBadge
          credits={action.creditReward}
          className="pointer-events-none absolute -top-2.5 right-2 z-20"
        />
      ) : typeof action.creditCost === "number" ? (
        <GenerationCreditCostBadge
          cost={action.creditCost}
          unaffordable={action.creditUnaffordable}
          className="pointer-events-none absolute -top-2.5 right-2 z-20"
        />
      ) : null}
      <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
        {action.icon}
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className={`block ${action.wrap || action.detail ? "whitespace-normal leading-tight" : "truncate"}`}>
          {action.label}
        </span>
        {action.detail ? (
          <span className="mt-0.5 block font-medium leading-tight text-white/70">
            {action.detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function GenerationResultActionRail({
  actions,
  className = "",
  beforePrimary,
}: Props) {
  if (!actions.length) return null;

  if (!beforePrimary) {
    return (
      <div
        className={`flex w-[9.5rem] flex-col gap-2 ${className}`.trim()}
        role="toolbar"
        aria-label="Действия с результатом"
      >
        {actions.map((action) => (
          <RailActionButton key={action.id} action={action} />
        ))}
      </div>
    );
  }

  const stacked = actions.slice(0, -1);
  const primary = actions[actions.length - 1];
  return (
    <div
      className={`flex flex-col items-end gap-2 ${className}`.trim()}
      role="toolbar"
      aria-label="Действия с результатом"
    >
      {stacked.length ? (
        <div className="flex w-[9.5rem] flex-col gap-2">
          {stacked.map((action) => (
            <RailActionButton key={action.id} action={action} />
          ))}
        </div>
      ) : null}
      <div className="flex items-stretch gap-2">
        {beforePrimary}
        <div className="flex w-[9.5rem]">
          <RailActionButton action={primary} />
        </div>
      </div>
    </div>
  );
}
