"use client";

import { useGeneration } from "@/context/GenerationContext";
import { useDebug } from "./DebugFAB";

function toAbsoluteImageUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (typeof window !== "undefined" && t.startsWith("/")) {
    return `${window.location.origin}${t}`;
  }
  return t;
}

/** Same star as extension floating button / `.stv-brand-mark` (Heroicons solid star). */
function StvStarIcon({ className = "h-[17px] w-[17px]" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.656-1.077 2.104 0l2.052 4.96 5.35.434c1.161.094 1.548 1.603.748 2.384l-4.09 3.941 1.14 5.348c.25 1.17-1.036 2.017-2.1 1.51l-4.828-2.29-4.827 2.29c-1.064.507-2.35-.34-2.1-1.51l1.14-5.348-4.09-3.941c-.8-.781-.413-2.384.748-2.384l5.35-.434 2.052-4.96Z"
        clipRule="evenodd"
      />
    </svg>
  );
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
  const debug = useDebug();
  const allowPublicTryLook = process.env.NEXT_PUBLIC_ENABLE_TRY_THIS_LOOK === "true";
  const showGeneration = allowPublicTryLook || (debug?.debugOpen ?? false);

  if (!showGeneration) return null;

  const handleClick = () => {
    generation?.openGenerationModal({
      cardId,
      initialPrompt,
      sourceImageUrl: sourceImageUrl ? toAbsoluteImageUrl(sourceImageUrl) : undefined,
    });
  };
  const ctaLabel = "Steal the vibe";

  /** Matches extension `.stv-ob-mark` / `.stv-brand-mark` (gradient tile + star). */
  const mark = (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-500 text-white shadow-[0_2px_12px_rgba(99,102,241,0.35)]">
      <StvStarIcon />
    </span>
  );

  const baseBtn =
    "inline-flex items-center justify-center gap-2.5 rounded-[12px] border-0 bg-gradient-to-br from-indigo-500 via-[#5b5cf0] to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_14px_rgba(99,102,241,0.35)] transition-[filter,box-shadow,transform] hover:brightness-[1.06] hover:shadow-[0_4px_20px_rgba(99,102,241,0.45)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  if (variant === "mobile") {
    return (
      <button type="button" onClick={handleClick} className={`${baseBtn} flex-1 ${className}`}>
        {mark}
        {ctaLabel}
      </button>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={`${baseBtn} px-5 py-2.5 ${className}`}>
      {mark}
      {ctaLabel}
    </button>
  );
}
