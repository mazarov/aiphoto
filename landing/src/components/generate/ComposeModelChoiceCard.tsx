"use client";

import Link from "next/link";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import {
  COMPOSE_RU_TEXT_BADGE_HINT,
  composeImageModelRuTextBadge,
} from "@/lib/compose-image-model";

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
  const ruTextBadge = composeImageModelRuTextBadge(modelId);
  const title = ruTextBadge
    ? `${COMPOSE_RU_TEXT_BADGE_HINT}. ${hint}`
    : hint;
  const className = `${OVERLAY_BUTTON_UA_RESET} relative flex min-h-[5.25rem] min-w-0 flex-col items-stretch overflow-visible rounded-xl px-3 pb-4 pt-2.5 text-left transition ${FRAME} ${
    dockChrome
      ? selected
        ? "bg-indigo-500/30 text-white shadow-sm after:border-indigo-300"
        : "bg-zinc-950/35 text-white after:border-white/15 hover:bg-zinc-950/50 hover:after:border-white/30"
      : selected
        ? "bg-indigo-50 text-zinc-900 after:border-indigo-500"
        : "bg-zinc-100 text-zinc-900 after:border-zinc-200 hover:bg-zinc-200 hover:after:border-zinc-300"
  } ${unaffordable ? "opacity-90" : ""} disabled:opacity-50`;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ${
            dockChrome
              ? "bg-white/95 ring-white/20"
              : "bg-white ring-zinc-200/80"
          }`}
        >
          <GenerationModelIcon modelId={modelId} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 block text-[13px] font-semibold leading-snug">
            {label}
          </span>
          {ruTextBadge ? (
            <span className="mt-0.5 inline-flex w-fit max-w-full rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {ruTextBadge}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={`mt-1.5 line-clamp-2 text-xs font-medium leading-snug ${
          unaffordable
            ? dockChrome
              ? "text-rose-400"
              : "text-rose-600"
            : dockChrome
              ? "text-white/65"
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
        title={title}
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
      title={title}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}
