"use client";

import { useGeneration } from "@/context/GenerationContext";
import { useDebug } from "./DebugFAB";

type Props = {
  cardId: string;
  initialPrompt?: string;
  className?: string;
  variant?: "desktop" | "mobile";
};

export function GenerateButton({ cardId, initialPrompt, className = "", variant = "desktop" }: Props) {
  const generation = useGeneration();
  const debug = useDebug();
  const allowPublicTryLook = process.env.NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK === "true";
  const showGeneration = allowPublicTryLook || (debug?.debugOpen ?? false);

  if (!showGeneration) return null;

  const handleClick = () => {
    generation?.openGenerationModal({ cardId, initialPrompt });
  };
  const ctaLabel = "Попробовать этот стиль";

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-lg active:scale-[0.98] ${className}`}
      >
        <span>🚀</span>
        {ctaLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] ${className}`}
    >
      <span>🚀</span>
      {ctaLabel}
    </button>
  );
}
