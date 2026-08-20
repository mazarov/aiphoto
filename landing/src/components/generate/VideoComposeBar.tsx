"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";

type Props = {
  previewUrl: string | null;
  onClearPreview?: () => void;
  modelId?: string | null;
  modelLabel: string;
  settingsOpen?: boolean;
  onOpenSettings: () => void;
  glass?: boolean;
  disabled?: boolean;
};

function PreviewTile({
  url,
  label,
  glass,
  onClear,
}: {
  url: string | null;
  label: string;
  glass: boolean;
  onClear?: () => void;
}) {
  return (
    <div
      className={`relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-xl ring-2 ${
        glass ? "bg-black/20 ring-white/10" : "bg-zinc-100 ring-zinc-200"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-zinc-300">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
            <path d="m5 17 4.5-4 3.2 2.7 2.5-2.2L19 17" />
          </svg>
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
      <span className="absolute inset-x-2 bottom-1.5 text-[13px] font-semibold leading-tight text-white">
        {label}
      </span>
      {url && onClear ? (
        <button
          type="button"
          aria-label="Убрать фото"
          onClick={onClear}
          className={`${OVERLAY_BUTTON_UA_RESET} absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/90 text-white`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function VideoComposeBar({
  previewUrl,
  onClearPreview,
  modelId = null,
  modelLabel,
  settingsOpen = false,
  onOpenSettings,
  glass = true,
  disabled = false,
}: Props) {
  return (
    <div className="flex items-start gap-2">
      <PreviewTile
        url={previewUrl}
        label="Кадр"
        glass={glass}
        onClear={onClearPreview}
      />
      <button
        type="button"
        aria-expanded={settingsOpen}
        aria-controls="inline-generation-models"
        disabled={disabled}
        onClick={onOpenSettings}
        className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl p-2 text-center ring-2 transition ${
          glass
            ? settingsOpen
              ? "bg-white/10 text-white ring-indigo-300"
              : "bg-white/5 text-white ring-white/10 hover:bg-white/10 hover:ring-white/25"
            : settingsOpen
              ? "bg-indigo-50 text-zinc-900 ring-indigo-500"
              : "bg-indigo-50 text-zinc-900 ring-indigo-200 hover:bg-indigo-100 hover:ring-indigo-400"
        } disabled:opacity-50`}
      >
        <span
          className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full shadow-sm ${
            glass ? "bg-white/90" : "bg-white"
          }`}
        >
          <GenerationModelIcon modelId={modelId} />
        </span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
          {modelLabel}
        </span>
      </button>
      <div className="min-w-0 flex-1 self-center">
        <p
          className={`text-[13px] font-medium leading-snug ${
            glass ? "text-white/70" : "text-zinc-500"
          }`}
        >
          Нажмите на квадрат, чтобы изменить модель, формат и длительность.
        </p>
      </div>
    </div>
  );
}
