"use client";

import type { ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

export type GenerationResultAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  /** Thin violet stripe along the border; plays ~8s on show, then fades. */
  accent?: "orbit";
};

type Props = {
  actions: GenerationResultAction[];
  className?: string;
};

const RAIL_BTN_BASE = `${OVERLAY_BUTTON_UA_RESET} flex min-h-12 w-full items-center justify-start gap-1.5 rounded-2xl px-3 py-3 text-left text-[13px] font-semibold active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`;
/** Same glass as prompt-card chips (`CARD_OVERLAY_ACTION_PILL` / `MOBILE_FS_*`). */
const RAIL_BTN = `${RAIL_BTN_BASE} overflow-hidden bg-black/15 text-white/90 shadow-none backdrop-blur-md transition-colors hover:bg-black/25`;
/** Brand CTA — same indigo→violet as generate / credit badge. */
const RAIL_BTN_PRIMARY = `${RAIL_BTN_BASE} overflow-hidden bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-950/35 transition hover:brightness-110`;
/** Glass fill; glow must not clip — orbit/sheen live inside. */
const RAIL_BTN_ORBIT = `${RAIL_BTN_BASE} relative isolate overflow-visible bg-black/15 text-white/90 shadow-none backdrop-blur-md result-animate-cta transition-colors hover:bg-black/25`;

function railButtonClass(action: GenerationResultAction) {
  if (action.primary) return RAIL_BTN_PRIMARY;
  if (action.accent === "orbit") return RAIL_BTN_ORBIT;
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
          <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
            {action.icon}
          </span>
          <span className="relative z-10 truncate">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
