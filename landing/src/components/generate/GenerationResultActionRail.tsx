"use client";

import type { ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";

export type GenerationResultAction = {
  id: string;
  label: string;
  /** Second line under the label — same 13px tier, quieter. */
  detail?: string;
  /** Same `N✦` pill as photo/video model tiles in the generate modal. */
  creditCost?: number;
  creditUnaffordable?: boolean;
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
};

const RAIL_BTN_BASE = `${OVERLAY_BUTTON_UA_RESET} relative flex min-h-12 w-full items-center justify-start gap-1.5 rounded-2xl px-3 py-3 text-left text-[13px] font-semibold active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`;
/** Same glass as prompt-card chips (`CARD_OVERLAY_ACTION_PILL` / `MOBILE_FS_*`). */
const RAIL_BTN_GLASS = `bg-black/15 text-white/90 shadow-none backdrop-blur-md transition-colors hover:bg-black/25`;
const RAIL_BTN = `${RAIL_BTN_BASE} overflow-hidden ${RAIL_BTN_GLASS}`;
/** Brand CTA — same indigo→violet as generate / credit badge. */
const RAIL_BTN_PRIMARY = `${RAIL_BTN_BASE} overflow-hidden bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-950/35 transition hover:brightness-110`;
/** Glass fill; glow must not clip — orbit/sheen live inside. */
const RAIL_BTN_ORBIT = `${RAIL_BTN_BASE} relative isolate overflow-visible ${RAIL_BTN_GLASS} result-animate-cta`;
const RAIL_BTN_CREDIT = `${RAIL_BTN_BASE} mt-1.5 overflow-visible ${RAIL_BTN_GLASS}`;

function hasTopCreditBadge(action: GenerationResultAction) {
  return action.creditCost != null;
}

function railButtonClass(action: GenerationResultAction) {
  if (action.primary) return RAIL_BTN_PRIMARY;
  if (action.accent === "orbit") {
    return hasTopCreditBadge(action) ? `${RAIL_BTN_ORBIT} mt-1.5` : RAIL_BTN_ORBIT;
  }
  if (hasTopCreditBadge(action)) return RAIL_BTN_CREDIT;
  return RAIL_BTN;
}

export function GenerationResultActionRail({ actions, className = "" }: Props) {
  if (!actions.length) return null;
  return (
    <div
      className={`flex w-[9.5rem] flex-col gap-2 ${className}`.trim()}
      role="toolbar"
      aria-label="Действия с результатом"
    >
      {actions.map((action) => (
        <button
          key={action.id}
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
          {typeof action.creditCost === "number" ? (
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
      ))}
    </div>
  );
}
