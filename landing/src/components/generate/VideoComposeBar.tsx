"use client";

import { useEffect, useId, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_DURATION_OPTIONS,
  VIDEO_RESOLUTION_OPTIONS,
} from "@/lib/generation/image-options";
import { videoDurationExtraCredits } from "@/lib/video-generation-contract";

type VideoParamKey = "format" | "duration" | "quality";

type Props = {
  generationPreviewUrl: string | null;
  referencePreviewUrl?: string | null;
  onClearPreview?: () => void;
  modelLabel: string;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  durationSeconds: number;
  onDurationChange: (value: number) => void;
  resolution: string;
  quantity: number;
  glass?: boolean;
  disabled?: boolean;
};

const CHIP =
  "inline-flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold";

function FormatIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="8" y="3.5" width="8" height="17" rx="1.8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.2L15 15" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m12 3.5 7.5 8.5L12 20.5 4.5 12z" />
    </svg>
  );
}

function PreviewThumb({
  url,
  label,
  emphasized,
  onClear,
}: {
  url: string | null;
  label: string;
  emphasized: boolean;
  onClear?: () => void;
}) {
  return (
    <div
      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/20 ring-2 ${
        emphasized ? "ring-white" : "ring-white/25"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-white/40">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
            <path d="m5 17 4.5-4 3.2 2.7 2.5-2.2L19 17" />
          </svg>
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center text-[10px] font-semibold leading-tight text-white">
        {label}
      </span>
      {url && onClear ? (
        <button
          type="button"
          aria-label="Убрать фото"
          onClick={onClear}
          className={`${OVERLAY_BUTTON_UA_RESET} absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white`}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function VideoComposeBar({
  generationPreviewUrl,
  referencePreviewUrl = null,
  onClearPreview,
  modelLabel,
  aspectRatio,
  onAspectRatioChange,
  durationSeconds,
  onDurationChange,
  resolution,
  quantity,
  glass = true,
  disabled = false,
}: Props) {
  const popoverId = useId();
  const [openParam, setOpenParam] = useState<VideoParamKey | null>(null);
  const showReference =
    Boolean(referencePreviewUrl) && referencePreviewUrl !== generationPreviewUrl;

  useEffect(() => {
    if (!openParam) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenParam(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openParam]);

  const chipClass = glass
    ? `${CHIP} bg-white/10 text-white ring-1 ring-white/15`
    : `${CHIP} bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200`;
  const chipButtonClass = `${OVERLAY_BUTTON_UA_RESET} ${chipClass} transition hover:brightness-110 disabled:opacity-50`;
  const popoverClass = glass
    ? "rounded-2xl bg-zinc-950 p-2 text-white ring-1 ring-white/12 shadow-2xl"
    : "rounded-2xl bg-white p-2 text-zinc-900 ring-1 ring-zinc-200 shadow-xl";
  const optionClass = glass
    ? "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-[13px] font-semibold text-white"
    : "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-[13px] font-semibold text-zinc-900";
  const optionActive = glass ? "bg-white/15" : "bg-zinc-100";
  const titleClass = glass
    ? "px-2 pb-1 pt-0.5 text-[13px] font-semibold tracking-wide text-white/55"
    : "px-2 pb-1 pt-0.5 text-[13px] font-semibold tracking-wide text-zinc-500";

  const toggle = (key: VideoParamKey) => {
    setOpenParam((current) => (current === key ? null : key));
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 items-start gap-1.5">
          <PreviewThumb
            url={generationPreviewUrl}
            label="Для генерации"
            emphasized
            onClear={onClearPreview}
          />
          {showReference ? (
            <PreviewThumb
              url={referencePreviewUrl}
              label="Референс"
              emphasized={false}
            />
          ) : null}
        </div>
        <div className="relative min-w-0 flex-1">
          {openParam ? (
            <>
              <button
                type="button"
                aria-label="Закрыть параметры"
                className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 z-10`}
                onClick={() => setOpenParam(null)}
              />
              <div
                id={popoverId}
                role="listbox"
                className={`relative z-20 ${popoverClass}`}
              >
                {openParam === "format" ? (
                  <>
                    <p className={titleClass}>ФОРМАТ</p>
                    {VIDEO_ASPECT_RATIO_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={aspectRatio === option.value}
                        className={`${OVERLAY_BUTTON_UA_RESET} ${optionClass} ${
                          aspectRatio === option.value ? optionActive : ""
                        }`}
                        onClick={() => {
                          onAspectRatioChange(option.value);
                          setOpenParam(null);
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {option.value === "16:9" ? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                              <rect x="3.5" y="8" width="17" height="8" rx="1.6" />
                            </svg>
                          ) : (
                            <FormatIcon />
                          )}
                          {option.value}
                        </span>
                      </button>
                    ))}
                  </>
                ) : null}
                {openParam === "duration" ? (
                  <>
                    <p className={titleClass}>ДЛИТЕЛЬНОСТЬ</p>
                    {VIDEO_DURATION_OPTIONS.map((option) => {
                      const extra = videoDurationExtraCredits(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={durationSeconds === option.value}
                          className={`${OVERLAY_BUTTON_UA_RESET} ${optionClass} ${
                            durationSeconds === option.value ? optionActive : ""
                          }`}
                          onClick={() => {
                            onDurationChange(option.value);
                            setOpenParam(null);
                          }}
                        >
                          <span>{option.label}</span>
                          {extra > 0 ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[13px] font-semibold text-zinc-900">
                              +{extra}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </>
                ) : null}
                {openParam === "quality" ? (
                  <>
                    <p className={titleClass}>РАЗРЕШЕНИЕ</p>
                    {VIDEO_RESOLUTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={resolution === option.value}
                        className={`${OVERLAY_BUTTON_UA_RESET} ${optionClass} ${
                          resolution === option.value ? optionActive : ""
                        }`}
                        onClick={() => setOpenParam(null)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              <span className={chipClass}>{modelLabel}</span>
              <button
                type="button"
                aria-expanded={false}
                aria-controls={popoverId}
                disabled={disabled}
                onClick={() => toggle("format")}
                className={chipButtonClass}
              >
                <FormatIcon />
                {aspectRatio}
              </button>
              <button
                type="button"
                aria-expanded={false}
                aria-controls={popoverId}
                disabled={disabled}
                onClick={() => toggle("duration")}
                className={chipButtonClass}
              >
                <ClockIcon />
                {durationSeconds} сек
              </button>
              <button
                type="button"
                aria-expanded={false}
                aria-controls={popoverId}
                disabled={disabled}
                onClick={() => toggle("quality")}
                className={chipButtonClass}
              >
                <DiamondIcon />
                {resolution}
              </button>
              <span className={`${chipClass} tabular-nums`}>
                <button type="button" disabled className="opacity-40" aria-label="Меньше">
                  −
                </button>
                {quantity}
                <button type="button" disabled className="opacity-40" aria-label="Больше">
                  +
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
