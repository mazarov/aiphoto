"use client";

import Link from "next/link";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationCreditCostBadge } from "@/components/generate/GenerationCreditCostBadge";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";

type Props = {
  modelId: string;
  label: string;
  description: string;
  cost: number;
  selected: boolean;
  href?: string;
  onClick?: () => void;
};

/** Equal-height landing chip for Gemini / Nano Banana model pickers. */
export function GenerationModelShowcaseChip({
  modelId,
  label,
  description,
  cost,
  selected,
  href,
  onClick,
}: Props) {
  const className = `${OVERLAY_BUTTON_UA_RESET} flex h-[5rem] w-full flex-col justify-center gap-1 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
    selected
      ? "border-indigo-300 bg-indigo-50/90 shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
      : "border-zinc-200/90 bg-white/90 shadow-sm hover:border-indigo-200 hover:bg-white"
  }`;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80">
          <GenerationModelIcon modelId={modelId} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">
          {label}
        </span>
        <GenerationCreditCostBadge cost={cost} compact className="shrink-0" />
      </span>
      <span className="line-clamp-1 pl-10 text-xs leading-snug text-zinc-500">
        {description}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} data-model-id={modelId} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      data-model-id={modelId}
      aria-pressed={selected}
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}
