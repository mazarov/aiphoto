"use client";

import type { ReactNode } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { GenerationModelIcon } from "@/components/generate/GenerationModelIcon";
import {
  composePreviewImageUrls,
  composeTileMosaicGrid,
} from "@/lib/compose-tile-mosaic";
import {
  COMPOSE_MODEL_TOOL_EDGE_LABEL,
  COMPOSE_TOOL_EDGE_LABEL,
  COMPOSE_TOOL_TILE_UNSET_LABEL,
  composeModeTileLabel,
  type GenerateComposeMode,
} from "@/lib/generate-compose-mode";

type DockTileProps = {
  edgeLabel: string;
  bodyLabel?: string | null;
  previewUrls?: string[] | null;
  /** Sticker previews are transparent PNGs — do not plate them on black. */
  previewPlate?: "photo" | "clear";
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

export function ComposeTilePhotoMosaic({
  urls,
  plate = "photo",
}: {
  urls: string[];
  /** `photo` fills the tile and paints zinc-950 behind opaque shots. `clear` keeps PNG alpha, same as the sticker style sheet. */
  plate?: "photo" | "clear";
}) {
  const clear = plate === "clear";
  const { columns, rows } = composeTileMosaicGrid(urls.length);
  const basis = `${100 / columns}%`;
  const height = `${100 / rows}%`;
  return (
    <span
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] ${
        clear ? "flex items-center justify-center bg-transparent" : "flex flex-wrap content-start gap-px bg-zinc-950"
      }`}
    >
      {urls.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${url}-${index}`}
          src={url}
          alt=""
          className={clear ? "h-full w-full object-contain p-1.5" : "min-h-0 min-w-0 object-cover"}
          style={
            clear
              ? undefined
              : {
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: `calc(${basis} - 1px)`,
                  height,
                  maxHeight: height,
                  width: basis,
                }
          }
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
  previewPlate = "photo",
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
      {filled ? <ComposeTilePhotoMosaic urls={mosaicUrls} plate={previewPlate} /> : null}
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
  colorClass = "text-zinc-800",
}: {
  mode: GenerateComposeMode;
  modelId?: string | null;
  className?: string;
  /** Tool chips pass `text-current` so the icon follows the chip. */
  colorClass?: string;
}) {
  if ((mode === "image" || mode === "video") && modelId) {
    return <GenerationModelIcon modelId={modelId} className={className} />;
  }
  if (mode === "photoshoot") {
    return (
      <svg
        className={`${className} ${colorClass}`}
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
  if (mode === "sticker") {
    return (
      <svg
        className={`${className} ${colorClass}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path
          d="M12 3.5c2.6 0 4.4 2.1 4.4 4.7 0 1.2-.4 2.2-.9 3 1.7.5 3 1.8 3 3.5 0 2.2-2.2 3.6-4.8 3.6h-.2l.6 2.2c.2.7-.4 1.4-1.1 1.2l-2.4-.6-1.6 1.8c-.5.6-1.5.3-1.6-.5l-.3-2.3-2.4.4c-.7.1-1.3-.6-1-1.3l1-2.1c-1.2-.7-2-1.8-2-3.2 0-1.7 1.3-3 3-3.5-.5-.8-.9-1.8-.9-3C6.8 5.6 8.8 3.5 12 3.5Z"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (mode === "photo_prompt") {
    return (
      <svg
        className={`${className} ${colorClass}`}
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
  if (mode === "video") {
    return (
      <svg
        className={`${className} ${colorClass}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <path d="m10.25 9.25 4.5 2.75-4.5 2.75Z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg
      className={`${className} ${colorClass}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M8.5 5.5 9.75 3.75h4.5L15.5 5.5" strokeLinejoin="round" />
    </svg>
  );
}

type ToolTileProps = {
  composeMode: GenerateComposeMode;
  /** Caption under the icon — the picked tool («Фото», «Стикер пак», …). */
  bodyLabel: string;
  selected: boolean;
  expanded: boolean;
  disabled?: boolean;
  glassChrome: boolean;
  className: string;
  controlsId: string;
  onClick: () => void;
};

/** «Инструмент»: opens the tool sheet; shows the current tool. */
export function ComposeToolPickerTile({
  composeMode,
  bodyLabel,
  selected,
  expanded,
  disabled = false,
  glassChrome,
  className,
  controlsId,
  onClick,
}: ToolTileProps) {
  return (
    <ComposeDockToolTile
      edgeLabel={COMPOSE_TOOL_EDGE_LABEL}
      bodyLabel={bodyLabel}
      icon={<ComposeModeToolIcon mode={composeMode} className="h-3.5 w-3.5" />}
      selected={selected}
      expanded={expanded}
      disabled={disabled}
      glassChrome={glassChrome}
      className={className}
      controlsId={controlsId}
      ariaLabel={`${COMPOSE_TOOL_EDGE_LABEL}, ${bodyLabel}`}
      onClick={onClick}
    />
  );
}

type ChoiceTileProps = {
  mode: GenerateComposeMode;
  selected: boolean;
  disabled?: boolean;
  glassChrome: boolean;
  className: string;
  onClick: () => void;
};

/** Tool chooser in the «Инструмент» sheet — same square tile as the modal row, mode name on the edge. */
export function ComposeToolChoiceTile({
  mode,
  selected,
  disabled = false,
  glassChrome,
  className,
  onClick,
}: ChoiceTileProps) {
  const label = composeModeTileLabel(mode);
  return (
    <ComposeDockToolTile
      edgeLabel={label}
      icon={<ComposeModeToolIcon mode={mode} className="h-5 w-5" />}
      selected={selected}
      disabled={disabled}
      glassChrome={glassChrome}
      className={className}
      ariaLabel={label}
      onClick={onClick}
    />
  );
}

type ModelTileProps = {
  mode: Extract<GenerateComposeMode, "image" | "video">;
  modelId: string | null;
  tileLabel: string | null;
  fullLabel: string | null;
  selected: boolean;
  expanded: boolean;
  disabled?: boolean;
  glassChrome: boolean;
  className: string;
  controlsId: string;
  onClick: () => void;
};

/** «Модель»: photo or video model of the picked tool; opens the model sheet. */
export function ComposeModelToolTile({
  mode,
  modelId,
  tileLabel,
  fullLabel,
  selected,
  expanded,
  disabled = false,
  glassChrome,
  className,
  controlsId,
  onClick,
}: ModelTileProps) {
  const bodyLabel = tileLabel || COMPOSE_TOOL_TILE_UNSET_LABEL;
  const ariaLabel = tileLabel
    ? `${COMPOSE_MODEL_TOOL_EDGE_LABEL}, ${tileLabel}`
    : `${COMPOSE_MODEL_TOOL_EDGE_LABEL}, выбрать`;
  return (
    <ComposeDockToolTile
      edgeLabel={COMPOSE_MODEL_TOOL_EDGE_LABEL}
      bodyLabel={bodyLabel}
      icon={<ComposeModeToolIcon mode={mode} modelId={modelId} className="h-3.5 w-3.5" />}
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
