"use client";

import { useGeneration } from "@/context/GenerationContext";

function toAbsoluteImageUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (typeof window !== "undefined" && t.startsWith("/")) {
    return `${window.location.origin}${t}`;
  }
  return t;
}

type Props = {
  cardId: string;
  /** Absolute image URL for STV reference (same as card hero). */
  sourceImageUrl?: string;
  initialPrompt?: string;
  className?: string;
  variant?: "desktop" | "mobile";
};

export function GenerateButton({
  cardId,
  sourceImageUrl,
  initialPrompt,
  className = "",
  variant = "desktop",
}: Props) {
  const generation = useGeneration();
  const allowPublicTryLook = process.env.NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK === "true";
  const showGeneration = allowPublicTryLook;

  if (!showGeneration) return null;

  const handleClick = () => {
    generation?.openGenerationModal({
      cardId,
      initialPrompt,
      sourceImageUrl: sourceImageUrl ? toAbsoluteImageUrl(sourceImageUrl) : undefined,
    });
  };

  const baseBtn =
    "inline-flex items-center justify-center gap-2 rounded-[12px] border-0 bg-gradient-to-br from-indigo-500 via-[#5b5cf0] to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_14px_rgba(99,102,241,0.35)] transition-[filter,box-shadow,transform] hover:brightness-[1.06] hover:shadow-[0_4px_20px_rgba(99,102,241,0.45)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  if (variant === "mobile") {
    return (
      <button type="button" onClick={handleClick} className={`${baseBtn} flex-1 ${className}`}>
        Steal This Vibe
      </button>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={`${baseBtn} px-5 py-2.5 ${className}`}>
      Steal This Vibe
    </button>
  );
}
