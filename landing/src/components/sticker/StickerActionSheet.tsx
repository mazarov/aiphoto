"use client";

import { useEffect, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { ResultOverlayBottomSheet } from "@/components/generate/ComposeSheetShell";
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
  stickerActionHasPresets,
  type StickerResultAction,
} from "@/lib/sticker-action-sheet";

type Props = {
  action: StickerResultAction;
  presets: readonly StickerPreset[];
  loading?: boolean;
  creditCost: number | null;
  creditUnaffordable?: boolean;
  hideCreditCost?: boolean;
  /** Model job in flight (emotion / motion) or text overlay request in flight. */
  busy: boolean;
  progress?: number;
  /** Panel-level error (compose chrome is hidden under the overlay). */
  error?: string | null;
  v2Chrome?: boolean;
  onClose: () => void;
  onSubmit: (input: { presetId: string | null; customText: string }) => Promise<boolean> | boolean | void;
};

/**
 * Overlay on the sticker result plate: presets from the bot + a free-text field.
 */
export function StickerActionSheet({
  action,
  presets,
  loading = false,
  creditCost,
  creditUnaffordable = false,
  hideCreditCost = false,
  busy,
  progress = 0,
  error = null,
  v2Chrome = false,
  onClose,
  onSubmit,
}: Props) {
  const copy = STICKER_ACTION_COPY[action];
  const isText = action === STICKER_TEXT_ACTION;
  const hasPresets = stickerActionHasPresets(action);
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

  const ctaLabel = stickerActionCtaLabel({
    action,
    busy: submitting,
    progress,
    creditCost,
    hideCreditCost,
  });

  if (v2Chrome) {
    const chipV2 = (active: boolean) =>
      `${OVERLAY_BUTTON_UA_RESET} inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition disabled:opacity-50 ${
        active
          ? "bg-indigo-500 text-white ring-2 ring-inset ring-indigo-300 shadow-sm"
          : "bg-white/[0.08] text-white/90 ring-1 ring-inset ring-white/15 hover:bg-white/[0.14]"
      }`;

    return (
      <ResultOverlayBottomSheet
        title={copy.title}
        lead={copy.lead}
        closeDisabled={submitting}
        onClose={onClose}
        error={error}
        primaryCta={{
          label: submitting
            ? progress > 0
              ? `${copy.busy} ${Math.round(progress)}%`
              : copy.busy
            : copy.cta,
          ariaLabel: ctaLabel,
          disabled: !canSubmit,
          busy: submitting,
          creditCost:
            isText || hideCreditCost ? null : creditCost,
          creditUnaffordable,
          onClick: () => void handleSubmit(),
        }}
      >
        <div className="flex flex-col gap-3">
          {hasPresets ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.title}>
              {loading && !presets.length
                ? Array.from({ length: 6 }).map((_, index) => (
                    <span
                      key={index}
                      className="h-10 w-24 animate-pulse rounded-full bg-white/10"
                      aria-hidden
                    />
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
                        className={chipV2(active)}
                        onClick={() => {
                          setPresetId(active ? null : preset.id);
                          if (!active) setCustomText("");
                        }}
                      >
                        {preset.emoji ? <span aria-hidden>{preset.emoji}</span> : null}
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
            </div>
          ) : null}

          <div>
            <input
              type="text"
              value={customText}
              maxLength={isText ? STICKER_TEXT_MAX_CHARS : STICKER_CUSTOM_HINT_MAX}
              placeholder={copy.customPlaceholder}
              autoFocus={action === "revise" || isText}
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
              className="w-full rounded-2xl border border-white/15 bg-zinc-950/40 px-3.5 py-3 text-[13px] font-medium text-white outline-none transition placeholder:text-white/45 focus:border-indigo-300 focus:bg-zinc-950/55 focus:ring-2 focus:ring-indigo-400/25 disabled:opacity-60"
            />
            {isText ? (
              <p className="mt-1.5 text-right text-[12px] tabular-nums text-white/55" aria-live="polite">
                {customText.length}/{STICKER_TEXT_MAX_CHARS}
              </p>
            ) : null}
          </div>
        </div>
      </ResultOverlayBottomSheet>
    );
  }

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

        {hasPresets ? (
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
          autoFocus={action === "revise"}
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
