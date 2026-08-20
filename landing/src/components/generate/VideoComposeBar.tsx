"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";

type Props = {
  previewUrl: string | null;
  onClearPreview?: () => void;
  modelLabel: string;
  settingsOpen?: boolean;
  onOpenSettings: () => void;
  glass?: boolean;
  disabled?: boolean;
};

function GoogleGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

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
          <GoogleGenerationModelIcon />
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
          Нажмите на квадрат, чтобы изменить формат и длительность.
        </p>
      </div>
    </div>
  );
}
