"use client";

import { useEffect, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  GenerationResultActionRail,
  type GenerationResultAction,
} from "@/components/generate/GenerationResultActionRail";
import {
  STICKER_CUSTOM_HINT_MAX,
  STICKER_TEXT_ACTION,
  STICKER_TEXT_MAX_CHARS,
  type StickerPreset,
} from "@/lib/sticker";
import {
  STICKER_ACTION_COPY,
  STICKER_ACTION_EXIT,
  stickerActionCanSubmit,
  stickerActionCtaLabel,
  type StickerResultAction,
} from "@/lib/sticker-action-sheet";

type Props = {
  action: StickerResultAction;
  presets: readonly StickerPreset[];
  loading?: boolean;
  creditCost: number | null;
  hideCreditCost?: boolean;
  /** Model job in flight (emotion / motion) or text overlay request in flight. */
  busy: boolean;
  progress?: number;
  /** Panel-level error (compose chrome is hidden under the overlay). */
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { presetId: string | null; customText: string }) => Promise<boolean> | boolean | void;
};

/**
 * Overlay on the sticker result plate: presets from the bot + a free-text field,
 * exit / primary CTA in the same rail as photoshoot / camera overlays.
 */
export function StickerActionSheet({
  action,
  presets,
  loading = false,
  creditCost,
  hideCreditCost = false,
  busy,
  progress = 0,
  error = null,
  onClose,
  onSubmit,
}: Props) {
  const copy = STICKER_ACTION_COPY[action];
  const isText = action === STICKER_TEXT_ACTION;
  const [presetId, setPresetId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setPresetId(null);
    setCustomText("");
  }, [action]);

  const submitting = busy || starting;
  const canSubmit = stickerActionCanSubmit({ action, presetId, customText, busy: submitting });

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStarting(true);
    try {
      await onSubmit({ presetId, customText });
    } finally {
      setStarting(false);
    }
  };

  const exitAction: GenerationResultAction = {
    id: "exit",
    label: STICKER_ACTION_EXIT,
    disabled: submitting,
    onClick: onClose,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    ),
  };
  const ctaLabel = stickerActionCtaLabel({ action, busy: submitting, progress, creditCost, hideCreditCost });
  const submitAction: GenerationResultAction = {
    id: "submit",
    label: ctaLabel,
    ariaLabel: ctaLabel,
    primary: true,
    wrap: true,
    disabled: !canSubmit,
    onClick: () => void handleSubmit(),
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m5 12 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  const chip = (active: boolean) =>
    `${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition disabled:opacity-50 ${
      active ? "bg-white text-zinc-900 ring-2 ring-indigo-300" : "bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25"
    }`;

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-label={copy.title}>
      <div className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[11rem] z-30 max-h-[70%] overflow-y-auto overscroll-contain rounded-2xl bg-black/55 p-3 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md">
        <h3 className="text-[15px] font-semibold">{copy.title}</h3>
        <p className="mt-0.5 text-[12px] text-white/75">{copy.lead}</p>

        {!isText ? (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={copy.title}>
            {loading && !presets.length
              ? Array.from({ length: 6 }).map((_, index) => (
                  <span key={index} className="h-10 w-24 animate-pulse rounded-full bg-white/10" aria-hidden />
                ))
              : presets.map((preset) => {
                  const active = presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={submitting}
                      title={preset.hint}
                      className={chip(active)}
                      onClick={() => {
                        setPresetId(active ? null : preset.id);
                        if (!active) setCustomText("");
                      }}
                    >
                      {preset.emoji ? <span aria-hidden>{preset.emoji}</span> : null}
                      {preset.label}
                    </button>
                  );
                })}
          </div>
        ) : null}

        <input
          type="text"
          value={customText}
          maxLength={isText ? STICKER_TEXT_MAX_CHARS : STICKER_CUSTOM_HINT_MAX}
          placeholder={copy.customPlaceholder}
          disabled={submitting}
          aria-label={copy.customPlaceholder}
          onChange={(event) => {
            setCustomText(event.target.value);
            if (event.target.value.trim()) setPresetId(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2.5 text-[14px] text-white placeholder:text-white/45 ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
        />
        {isText ? (
          <p className="mt-1 text-right text-[11px] text-white/55" aria-live="polite">
            {customText.length}/{STICKER_TEXT_MAX_CHARS}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[13px] font-medium text-rose-200" role="status">
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
