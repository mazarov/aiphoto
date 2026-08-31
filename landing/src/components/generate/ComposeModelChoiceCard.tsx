"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";

const FRAME =
  "after:pointer-events-none after:absolute after:inset-0 after:z-[1] after:rounded-xl after:border-2 after:border-solid";

type Props = {
  modelId: string;
  label: string;
  description: string;
  cost: number;
  selected: boolean;
  unaffordable?: boolean;
  disabled?: boolean;
  dockChrome?: boolean;
  onClick: () => void;
};

export function ComposeModelChoiceCard({
  modelId,
  label,
  description,
  cost,
  selected,
  unaffordable = false,
  disabled = false,
  dockChrome = false,
  onClick,
}: Props) {
  const hint = unaffordable ? "Не хватает кредитов" : description;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={unaffordable || undefined}
      disabled={disabled}
      title={hint}
      onClick={onClick}
      className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-[4.75rem] min-w-0 items-start gap-2.5 overflow-hidden rounded-xl p-2.5 text-left transition ${FRAME} ${
        dockChrome
          ? selected
            ? "bg-white/15 text-white after:border-indigo-300"
            : "bg-white/5 text-white after:border-white/15 hover:bg-white/10 hover:after:border-white/30"
          : selected
            ? "bg-indigo-50 text-zinc-900 after:border-indigo-500"
            : "bg-zinc-100 text-zinc-900 after:border-zinc-200 hover:bg-zinc-200 hover:after:border-zinc-300"
      } ${unaffordable ? "opacity-90" : ""} disabled:opacity-50`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
          dockChrome ? "bg-white/90" : "bg-white"
        }`}
      >
        <GenerationModelIcon modelId={modelId} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
            {label}
          </span>
          <GenerationCreditCostBadge
            cost={cost}
            unaffordable={unaffordable}
            className="shrink-0"
          />
        </span>
        <span
          className={`mt-0.5 block truncate text-[13px] font-medium leading-tight ${
            unaffordable
              ? dockChrome
                ? "text-rose-400"
                : "text-rose-600"
              : dockChrome
                ? "text-white/60"
                : "text-zinc-500"
          }`}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}
