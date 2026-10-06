"use client";

import { useEffect, useState } from "react";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import { StickerStylePicker } from "@/components/sticker/StickerStylePicker";
import type { StickerStyle } from "@/lib/sticker";
import {
  STICKER_FROM_RESULT_CLOSE,
  STICKER_FROM_RESULT_LEAD,
  STICKER_FROM_RESULT_TITLE,
  stickerFromResultCtaLabel,
} from "@/lib/sticker-action-sheet";

type Props = {
  styles: readonly StickerStyle[];
  loading?: boolean;
  selectedId: string;
  onSelect: (style: StickerStyle) => void;
  creditCost: number | null;
  creditUnaffordable?: boolean;
  hideCreditCost?: boolean;
  busy: boolean;
  progress?: number;
  error?: string | null;
  onClose: () => void;
  onSubmit: () => Promise<boolean> | boolean | void;
};

/**
 * Overlay on a finished photo: style list fills the left side of the result frame,
 * «Закрыть» sits above the generate button on the right — same rail as emotion / motion.
 */
export function StickerFromResultSheet({
  styles,
  loading = false,
  selectedId,
  onSelect,
  creditCost,
  creditUnaffordable = false,
  hideCreditCost = false,
  busy,
  progress = 0,
  error = null,
  onClose,
  onSubmit,
}: Props) {
  const [starting, setStarting] = useState(false);
  const submitting = busy || starting;
  const canSubmit = Boolean(selectedId) && !submitting && !loading;

  useEffect(() => {
    if (submitting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStarting(true);
    try {
      await onSubmit();
    } finally {
      setStarting(false);
    }
  };

  const ctaLabel = stickerFromResultCtaLabel({
    busy: submitting,
    progress,
    creditCost,
    hideCreditCost,
  });
  const exitAction: GenerationResultAction = {
    id: "exit",
    label: STICKER_FROM_RESULT_CLOSE,
    disabled: submitting,
    onClick: onClose,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    ),
  };
  const submitAction: GenerationResultAction = {
    id: "submit",
    label: submitting ? ctaLabel : "Сделать стикер",
    ariaLabel: ctaLabel,
    primary: true,
    wrap: true,
    creditCost: hideCreditCost || submitting ? undefined : creditCost ?? undefined,
    creditUnaffordable,
    disabled: !canSubmit,
    onClick: () => void handleSubmit(),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 12 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return (
    <div
      className="absolute inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label={STICKER_FROM_RESULT_TITLE}
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-[11rem] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex min-h-0 flex-col overflow-hidden rounded-2xl bg-black/55 p-3 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md">
        <h3 className="shrink-0 text-[15px] font-semibold">{STICKER_FROM_RESULT_TITLE}</h3>
        <p className="mt-0.5 shrink-0 text-[13px] text-white/75">{STICKER_FROM_RESULT_LEAD}</p>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <StickerStylePicker
            embedded
            tone="dark"
            styles={styles}
            loading={loading}
            selectedId={selectedId}
            confirmCtaClassName=""
            onSelect={onSelect}
          />
        </div>
        {error ? (
          <p className="mt-2 shrink-0 text-[13px] font-medium text-rose-200" role="status">
            {error}
          </p>
        ) : null}
      </div>

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 z-30 flex w-[9.5rem] flex-col gap-2">
        <GenerationResultActionRail className="w-full" actions={[exitAction]} />
        <GenerationResultActionRail className="w-full" actions={[submitAction]} />
      </div>
    </div>
  );
}
