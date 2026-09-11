"use client";

import type { ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import {
  composePreviewImageUrls,
  composeTileMosaicGrid,
} from "@/lib/compose-tile-mosaic";
import {
  COMPOSE_TOOL_TILE_UNSET_LABEL,
  composeModeTileLabel,
  type GenerateComposeMode,
} from "@/lib/generate-compose-mode";

type DockTileProps = {
  edgeLabel: string;
  bodyLabel?: string | null;
  previewUrls?: string[] | null;
  countBadge?: string | null;
  icon: ReactNode;
  selected: boolean;
  expanded?: boolean;
  disabled?: boolean;
  glassChrome: boolean;
  className: string;
  controlsId?: string;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
};

export function ComposeTilePhotoMosaic({ urls }: { urls: string[] }) {
  const { columns, rows } = composeTileMosaicGrid(urls.length);
  const basis = `${100 / columns}%`;
  const height = `${100 / rows}%`;
  return (
    <span className="pointer-events-none absolute inset-0 z-0 flex flex-wrap content-start gap-px overflow-hidden rounded-[inherit] bg-zinc-950">
      {urls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${index}`}
          src={url}
          alt=""
          className="min-h-0 min-w-0 object-cover"
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: `calc(${basis} - 1px)`,
            height,
            maxHeight: height,
            width: basis,
          }}
        />
      ))}
    </span>
  );
}

export function ComposeLibraryPhotosIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-zinc-800`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5 17 4.5-4 3.2 2.7 2.5-2.2L19 17" />
    </svg>
  );
}

export function ComposeExampleToolIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-zinc-800`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="4" y="6.5" width="11" height="14" rx="2" />
      <rect x="8.5" y="3.5" width="11" height="14" rx="2" />
    </svg>
  );
}

export function ComposeDockToolTile({
  edgeLabel,
  bodyLabel = null,
  previewUrls = null,
  countBadge = null,
  icon,
  selected,
  expanded = false,
  disabled = false,
  glassChrome,
  className,
  controlsId,
  ariaLabel,
  title,
  onClick,
}: DockTileProps) {
  const mosaicUrls = composePreviewImageUrls(previewUrls ?? []);
  const filled = mosaicUrls.length > 0;
  const hasBody = Boolean(bodyLabel) && !filled;
  const logoWrap = `flex items-center justify-center overflow-hidden rounded-full shadow-sm ${
    hasBody ? "h-5 w-5" : "h-8 w-8"
  } ${glassChrome ? "bg-white/90" : "bg-white"}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      aria-expanded={controlsId ? expanded : undefined}
      aria-controls={controlsId}
      disabled={disabled}
      title={title || ariaLabel}
      onClick={onClick}
      className={`${OVERLAY_BUTTON_UA_RESET} relative flex shrink-0 flex-col items-center justify-center overflow-visible px-1 pb-1.5 pt-2.5 text-center transition ${className} disabled:opacity-50`}
    >
      {filled ? <ComposeTilePhotoMosaic urls={mosaicUrls} /> : null}
      <span
        className={`pointer-events-none absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-1/2 inline-flex max-w-[calc(100%+0.5rem)] items-center justify-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm ${
          glassChrome ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
        }`}
      >
        {edgeLabel}
      </span>
      {filled ? (
        countBadge ? (
          <span className="pointer-events-none absolute bottom-1 right-1 z-[2] rounded-full bg-zinc-900/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {countBadge}
          </span>
        ) : null
      ) : (
        <>
          <span className={logoWrap}>{icon}</span>
          {hasBody ? (
            <span className="mt-0.5 line-clamp-2 w-full px-0.5 text-xs font-semibold leading-tight">
              {bodyLabel}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}

export function ComposeModeToolIcon({
  mode,
  modelId = null,
  className = "h-3.5 w-3.5",
}: {
  mode: GenerateComposeMode;
  modelId?: string | null;
  className?: string;
}) {
  if ((mode === "image" || mode === "video") && modelId) {
    return <GenerationModelIcon modelId={modelId} className={className} />;
  }
  if (mode === "photoshoot") {
    return (
      <svg
        className={`${className} text-zinc-800`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <rect x="3" y="3" width="8" height="8" rx="1.75" />
        <rect x="13" y="3" width="8" height="8" rx="1.75" />
        <rect x="3" y="13" width="8" height="8" rx="1.75" />
        <rect x="13" y="13" width="8" height="8" rx="1.75" />
      </svg>
    );
  }
  if (mode === "photo_prompt") {
    return (
      <svg
        className={`${className} text-zinc-800`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <rect x="3" y="4.5" width="9.5" height="15" rx="2" />
        <circle cx="6.8" cy="9.2" r="1.35" />
        <path d="m4.3 17 2.1-2.1 1.5 1.25 1.25-1.1 2.4 2" />
        <path d="M15.25 8.25h5.5M15.25 12h5.5M15.25 15.75h3.75" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      className={`${className} text-zinc-500`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  mode: GenerateComposeMode;
  modelId?: string | null;
  tileLabel?: string | null;
  fullLabel?: string | null;
  selected: boolean;
  expanded?: boolean;
  disabled?: boolean;
  glassChrome: boolean;
  className: string;
  controlsId?: string;
  onClick: () => void;
};

export function ComposeModeToolTile({
  mode,
  modelId = null,
  tileLabel = null,
  fullLabel,
  selected,
  expanded = false,
  disabled = false,
  glassChrome,
  className,
  controlsId,
  onClick,
}: Props) {
  const modeLabel = composeModeTileLabel(mode);
  const isModelTool = mode === "image" || mode === "video";
  const bodyLabel = isModelTool
    ? tileLabel || COMPOSE_TOOL_TILE_UNSET_LABEL
    : null;
  const ariaLabel = isModelTool
    ? tileLabel
      ? `${modeLabel}, ${tileLabel}`
      : `${modeLabel}, выбрать модель`
    : modeLabel;

  return (
    <ComposeDockToolTile
      edgeLabel={modeLabel}
      bodyLabel={bodyLabel}
      icon={
        <ComposeModeToolIcon
          mode={mode}
          modelId={modelId}
          className={isModelTool ? "h-3.5 w-3.5" : "h-5 w-5"}
        />
      }
      selected={selected}
      expanded={expanded}
      disabled={disabled}
      glassChrome={glassChrome}
      className={className}
      controlsId={controlsId}
      ariaLabel={ariaLabel}
      title={fullLabel?.trim() || ariaLabel}
      onClick={onClick}
    />
  );
}
