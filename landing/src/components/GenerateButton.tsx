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

/** “AI sparkle” mark (Heroicons solid sparkles) — inline on the button, no nested logo tile. */
function AiSparklesIcon({ className = "h-5 w-5 shrink-0" }: { className?: string }) {
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
        d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z"
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

  const baseBtn =
    "inline-flex items-center justify-center gap-2 rounded-[12px] border-0 bg-gradient-to-br from-indigo-500 via-[#5b5cf0] to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_14px_rgba(99,102,241,0.35)] transition-[filter,box-shadow,transform] hover:brightness-[1.06] hover:shadow-[0_4px_20px_rgba(99,102,241,0.45)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  if (variant === "mobile") {
    return (
      <button type="button" onClick={handleClick} className={`${baseBtn} flex-1 ${className}`}>
        <AiSparklesIcon />
        Steal This Vibe
      </button>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={`${baseBtn} px-5 py-2.5 ${className}`}>
      <AiSparklesIcon />
      Steal This Vibe
    </button>
  );
}
