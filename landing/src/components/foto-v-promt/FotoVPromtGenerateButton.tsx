"use client";

import { useGenerateDock, type GenerateDockEntrySource } from "@/context/GenerateDockContext";
import {
  FVP_FOCUS_RING,
  FVP_IMMERSIVE_ACTION_BRAND,
  FVP_IMMERSIVE_FOCUS_RING,
} from "./foto-v-promt-tokens";

function SparkleIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M18.5 14.5l.7 2.2 2.3.7-2.3.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2z" opacity="0.85" />
    </svg>
  );
}

const VARIANT_CLASS = {
  sm: `inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-500 via-[#5b5cf0] to-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-50 ${FVP_FOCUS_RING}`,
  md: `inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/70 transition hover:brightness-[1.06] active:scale-[0.98] disabled:opacity-50 sm:w-auto sm:min-w-[10rem] ${FVP_FOCUS_RING}`,
  immersive: `${FVP_IMMERSIVE_ACTION_BRAND} ${FVP_IMMERSIVE_FOCUS_RING}`,
} as const;

export function FotoVPromtGenerateButton({
  promptText,
  label,
  variant,
  entrySource = "foto_v_promt",
  className = "",
}: {
  promptText: string;
  label: string;
  variant: keyof typeof VARIANT_CLASS;
  entrySource?: GenerateDockEntrySource;
  className?: string;
}) {
  const { seedBlankPrompt } = useGenerateDock();
  const trimmed = promptText.trim();

  const onClick = () => {
    if (!trimmed) return;
    try {
      void navigator.clipboard.writeText(trimmed);
    } catch {
      /* ignore */
    }
    seedBlankPrompt(trimmed, {
      entrySource,
      intent: "photo_prompt",
      dockSurface: "prompt",
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!trimmed}
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
    >
      <SparkleIcon className={variant === "sm" ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
      {label}
    </button>
  );
}
