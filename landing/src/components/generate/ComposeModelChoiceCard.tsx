"use client";

import Link from "next/link";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";

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
  href?: string;
  onClick?: () => void;
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
  href,
  onClick,
}: Props) {
  const hint = unaffordable ? "Не хватает кредитов" : description;
  const className = `${OVERLAY_BUTTON_UA_RESET} relative flex min-h-[4.5rem] min-w-0 flex-col items-stretch overflow-visible rounded-xl px-2.5 pb-4 pt-2 text-left transition ${FRAME} ${
    dockChrome
      ? selected
        ? "bg-white/15 text-white after:border-indigo-300"
        : "bg-white/5 text-white after:border-white/15 hover:bg-white/10 hover:after:border-white/30"
      : selected
        ? "bg-indigo-50 text-zinc-900 after:border-indigo-500"
        : "bg-zinc-100 text-zinc-900 after:border-zinc-200 hover:bg-zinc-200 hover:after:border-zinc-300"
  } ${unaffordable ? "opacity-90" : ""} disabled:opacity-50`;
  const content = (
    <>
      <span className="line-clamp-2 text-xs font-semibold leading-snug">
        {label}
      </span>
      <span
        className={`mt-0.5 line-clamp-2 text-xs font-medium leading-snug ${
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
      <span className="absolute bottom-0 left-1/2 z-[2] -translate-x-1/2 translate-y-1/2">
        <GenerationCreditCostBadge cost={cost} unaffordable={unaffordable} />
      </span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        data-model-id={modelId}
        title={hint}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      data-model-id={modelId}
      aria-pressed={selected}
      aria-disabled={unaffordable || undefined}
      disabled={disabled}
      title={hint}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}
