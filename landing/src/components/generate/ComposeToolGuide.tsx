"use client";

import { useEffect } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  COMPOSE_STICKER_PICKER_GUIDE,
  composePhotoPickerGuideCopy,
  composeToolGuideCopy,
  type ComposeToolGuideChip,
  type ComposeToolGuideCopy,
} from "@/lib/compose-tool-guide";
import {
  STICKER_TOOL_KINDS,
  stickerToolKindLabel,
  type GenerateComposeMode,
  type StickerToolKind,
} from "@/lib/generate-compose-mode";
import { stickerExampleThumbUrl } from "@/lib/sticker-examples";
import { PHOTO_GUIDE_PORTRAIT_SRC } from "@/lib/user-generation-photos-cache";
import {
  PHOTOSHOOT_TILE_INDEXES,
  PHOTOSHOOT_TILE_OBJECT_POSITION,
} from "@/lib/photoshoot";
import {
  PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_TILES,
  PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC,
  PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS,
  type PhotoshootGuideExample,
} from "@/lib/photoshoot-compose-example";

type Props = {
  mode: GenerateComposeMode;
  glassChrome: boolean;
  compact?: boolean;
  className?: string;
  photoshootExample?: PhotoshootGuideExample | null;
  /** Real example sticker of the selected style — the accent of the sticker and pack guides. */
  stickerExampleUrl?: string | null;
  /** «Стикер» / «Стикер пак» toggle at the top of the sticker guide. */
  stickerKind?: StickerToolKind;
  onStickerKindChange?: (kind: StickerToolKind) => void;
  /** Frame for the photo / video guide: picked catalog example or default styled frame. */
  photoExampleUrl?: string | null;
};

const GUIDE_TITLE_ID: Record<GenerateComposeMode, string> = {
  image: "generation-photo-guide-title",
  video: "generation-video-guide-title",
  photoshoot: "generation-photoshoot-guide-title",
  sticker: "generation-sticker-guide-title",
  photo_prompt: "generation-photo-prompt-guide-title",
};

/**
 * Real die-cut sticker preview of the chosen style.
 */
export function StickerHeroVisual({
  exampleUrl,
  size = "lg",
  className = "",
}: {
  exampleUrl: string | null | undefined;
  size?: "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  if (!exampleUrl) {
    return (
      <div
        aria-hidden
        className={`relative flex ${box} items-center justify-center ${className}`.trim()}
      >
        <div className="relative h-[86%] w-[86%] -rotate-3 overflow-hidden rounded-[1.35rem] border-[3px] border-white bg-indigo-500 shadow-[0_8px_18px_rgba(0,0,0,0.42)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS[1]}
            alt=""
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label="Пример стикера"
      className={`relative flex ${box} items-center justify-center ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={stickerExampleThumbUrl(exampleUrl, size === "lg" ? "lg" : "md")}
        alt=""
        decoding="async"
        draggable={false}
        className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.38)]"
      />
    </div>
  );
}

/** Segmented «Стикер | Стикер пак» — one tool, two kinds. */
export function StickerKindToggle({
  kind,
  onChange,
  glassChrome,
  className = "",
}: {
  kind: StickerToolKind;
  onChange: (kind: StickerToolKind) => void;
  glassChrome: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Вид стикера"
      className={`inline-flex rounded-full p-0.5 ${
        glassChrome
          ? "bg-zinc-950/35 ring-1 ring-white/15"
          : "bg-zinc-100 ring-1 ring-zinc-200"
      } ${className}`.trim()}
    >
      {STICKER_TOOL_KINDS.map((item) => {
        const active = item === kind;
        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item)}
            className={`${OVERLAY_BUTTON_UA_RESET} min-h-8 rounded-full px-3.5 text-[12px] font-semibold transition ${
              active
                ? glassChrome
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "bg-zinc-900 text-white shadow-sm"
                : glassChrome
                  ? "text-white/75 hover:text-white"
                  : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {stickerToolKindLabel(item)}
          </button>
        );
      })}
    </div>
  );
}

function StageCornerBadge({
  children,
  accent = false,
}: {
  children: string;
  accent?: boolean;
}) {
  return (
    <span
      className={`pointer-events-none inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none tracking-tight backdrop-blur-md ${
        accent
          ? "bg-indigo-500/90 text-white shadow-sm ring-1 ring-white/25"
          : "bg-zinc-950/75 text-white/95 ring-1 ring-white/15"
      }`}
    >
      {children}
    </span>
  );
}

function GuideSpecChip({
  chip,
  glassChrome,
}: {
  chip: ComposeToolGuideChip;
  glassChrome: boolean;
}) {
  const tone = chip.tone ?? "default";
  if (tone === "positive") {
    return (
      <span
        className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium ${
          glassChrome
            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-400/25"
            : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
        }`}
      >
        <svg
          className="h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {chip.label}
      </span>
    );
  }
  if (tone === "muted") {
    return (
      <span
        className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium ${
          glassChrome
            ? "bg-zinc-950/30 text-white/60 ring-1 ring-inset ring-white/12"
            : "bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200"
        }`}
      >
        <svg
          className="h-3.5 w-3.5 shrink-0 opacity-80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
        {chip.label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[12px] font-medium ${
        glassChrome
          ? "bg-zinc-950/35 text-white/80 ring-1 ring-inset ring-white/15"
          : "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200"
      }`}
    >
      {chip.label}
    </span>
  );
}

/**
 * Unified Input -> Output visual stage (`132px` fixed height across all 5 tools so
 * switching tools inside «Инструмент» never jumps by a single pixel).
 */
function ToolTransformationStage({
  copy,
  glassChrome,
  photoshootExample,
  stickerExampleUrl,
  photoExampleUrl,
}: {
  copy: ComposeToolGuideCopy;
  glassChrome: boolean;
  photoshootExample?: PhotoshootGuideExample | null;
  stickerExampleUrl?: string | null;
  photoExampleUrl?: string | null;
}) {
  useEffect(() => {
    if (!photoshootExample) return;
    const urls = [photoshootExample.sourceUrl, ...photoshootExample.tileUrls];
    for (const src of urls) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [photoshootExample]);

  const inputSrc =
    copy.visual === "source-to-tiles" && photoshootExample
      ? photoshootExample.sourceUrl
      : copy.visual === "prompt-from-photo"
        ? PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS[2]
        : PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC;

  const defaultStyledPhoto =
    photoExampleUrl && photoExampleUrl !== PHOTO_GUIDE_PORTRAIT_SRC
      ? photoExampleUrl
      : PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS[1];

  const defaultVideoPhoto =
    photoExampleUrl && photoExampleUrl !== PHOTO_GUIDE_PORTRAIT_SRC
      ? photoExampleUrl
      : PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS[0];

  const cardRing = glassChrome ? "ring-white/20" : "ring-zinc-200";
  const outputShadow = glassChrome
    ? "shadow-[0_14px_34px_-10px_rgba(79,70,229,0.45)]"
    : "shadow-[0_12px_28px_-10px_rgba(79,70,229,0.28)]";

  const tilesExample: PhotoshootGuideExample = photoshootExample ?? {
    sourceUrl: PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC,
    tileUrls: PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS,
    cropTiles: false,
  };

  return (
    <div className="relative flex h-[7.75rem] w-full items-center justify-center gap-2.5">
      <div
        aria-hidden
        className={`pointer-events-none absolute h-28 w-48 rounded-full blur-2xl ${
          glassChrome
            ? "bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.28),transparent_70%)]"
            : "bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.16),transparent_70%)]"
        }`}
      />

      {/* Left: Input card */}
      <div
        className={`relative h-[6.5rem] w-[5rem] shrink-0 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ${cardRing}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inputSrc}
          alt=""
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-1.5 left-1.5">
          <StageCornerBadge>{copy.inputBadge}</StageCornerBadge>
        </span>
      </div>

      {/* Center: Transformation arrow */}
      <span
        aria-hidden
        className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${
          glassChrome
            ? "bg-zinc-950/55 text-indigo-300 ring-white/15"
            : "bg-indigo-50 text-indigo-600 ring-indigo-200/80"
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path
            d="M5 12h14m-4.5-4.5L19 12l-4.5 4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* Right: Output card */}
      {copy.visual === "source-to-tiles" ? (
        <div
          role="img"
          aria-label={PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_TILES}
          className={`relative h-[7.75rem] w-[7.75rem] shrink-0 overflow-hidden rounded-2xl bg-zinc-950 ring-1 ${cardRing} ${outputShadow}`}
        >
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-zinc-950">
            {PHOTOSHOOT_TILE_INDEXES.map((tile, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={tile}
                src={tilesExample.tileUrls[index]}
                alt=""
                decoding="async"
                draggable={false}
                className="h-full w-full object-cover"
                style={
                  tilesExample.cropTiles
                    ? { objectPosition: PHOTOSHOOT_TILE_OBJECT_POSITION[tile] }
                    : undefined
                }
              />
            ))}
          </div>
          <span className="absolute right-1.5 top-1.5">
            <StageCornerBadge accent>{copy.outputBadge}</StageCornerBadge>
          </span>
        </div>
      ) : copy.visual === "prompt-from-photo" ? (
        <div
          role="img"
          aria-label="Готовый текст промта"
          className={`relative flex h-[7.75rem] w-[7.75rem] shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-2.5 text-left ring-1 ${
            glassChrome
              ? "bg-gradient-to-br from-indigo-950/90 via-zinc-900/95 to-zinc-950 ring-indigo-300/35"
              : "bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950 ring-indigo-300/50"
          } ${outputShadow}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-indigo-300 uppercase">
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 1.5l1.2 3.3L12.5 6 9.2 7.2 8 10.5 6.8 7.2 3.5 6l3.3-1.2L8 1.5z" />
              </svg>
              Prompt
            </span>
            <StageCornerBadge accent>{copy.outputBadge}</StageCornerBadge>
          </div>
          <div className="space-y-1.5" aria-hidden>
            <p className="line-clamp-3 text-[10px] font-medium leading-[1.35] text-white/90">
              Кинематографичный портрет, мягкий боковой свет, плёночное зерно 35 мм…
            </p>
            <div className="flex gap-1">
              <span className="h-1 flex-1 rounded-full bg-indigo-400/70" />
              <span className="h-1 w-6 rounded-full bg-violet-400/55" />
            </div>
          </div>
        </div>
      ) : copy.visual === "sticker-cutout" || copy.visual === "sticker-pack" ? (
        <div
          className={`relative flex h-[7.75rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ${
            glassChrome
              ? "bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:10px_10px] bg-zinc-950/55 ring-white/20"
              : "bg-[radial-gradient(rgba(24,24,27,0.1)_1px,transparent_1px)] [background-size:10px_10px] bg-zinc-100 ring-zinc-200"
          } ${outputShadow}`}
        >
          {copy.visual === "sticker-pack" ? (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute h-16 w-16 -translate-x-2.5 translate-y-1 -rotate-12 rounded-2xl bg-white/12 ring-1 ring-white/20"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute h-16 w-16 translate-x-2.5 translate-y-1 rotate-12 rounded-2xl bg-indigo-400/15 ring-1 ring-indigo-300/25"
              />
            </>
          ) : null}
          <StickerHeroVisual
            exampleUrl={stickerExampleUrl}
            size="lg"
            className="!h-[5.5rem] !w-[5.5rem]"
          />
          <span className="absolute right-1.5 top-1.5">
            <StageCornerBadge accent>{copy.outputBadge}</StageCornerBadge>
          </span>
        </div>
      ) : (
        <div
          role="img"
          aria-label={
            copy.visual === "video-frame"
              ? "Пример: фото становится живым видео"
              : "Пример готового фото в образе"
          }
          className={`relative h-[7.75rem] w-[6.5rem] shrink-0 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ${cardRing} ${outputShadow}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              copy.visual === "video-frame"
                ? defaultVideoPhoto
                : defaultStyledPhoto
            }
            alt=""
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
          {copy.visual === "video-frame" ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/70 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-md">
                <svg
                  className="ml-0.5 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 6.5v11l9-5.5Z" />
                </svg>
              </span>
            </span>
          ) : null}
          <span className="absolute right-1.5 top-1.5">
            <StageCornerBadge accent>{copy.outputBadge}</StageCornerBadge>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Unified horizontal upload-guidance banner inside the «Ваши фото» step for ALL tools
 * (`Фото`, `Видео`, `Фотосессии`, `Стикер`, `Промт по фото`).
 */
export function ComposePhotoUploadGuide({
  mode,
  glassChrome,
  isDock = true,
  stickerKind = "single",
  stickerExampleUrl = null,
}: {
  mode: GenerateComposeMode;
  glassChrome: boolean;
  isDock?: boolean;
  stickerKind?: StickerToolKind;
  stickerExampleUrl?: string | null;
}) {
  const copy = composePhotoPickerGuideCopy(mode, { stickerKind, isDock });
  const titleId =
    mode === "photo_prompt"
      ? "generation-photo-prompt-guide-title"
      : mode === "sticker"
        ? "generation-sticker-picker-guide-title"
        : "generation-photo-guide-title";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-inset ${
        glassChrome
          ? "bg-zinc-950/35 ring-white/15"
          : "bg-zinc-50 ring-zinc-200"
      }`}
    >
      {mode === "sticker" ? (
        <StickerHeroVisual
          exampleUrl={stickerExampleUrl}
          size="md"
          className="!h-14 !w-14 shrink-0"
        />
      ) : mode === "photo_prompt" ? (
        <div
          aria-hidden
          className="relative flex h-14 w-12 shrink-0 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950 p-1.5 ring-1 ring-indigo-300/35"
        >
          <span className="text-[9px] font-bold tracking-wider text-indigo-300 uppercase">
            AI
          </span>
          <div className="space-y-1">
            <span className="block h-0.5 w-full rounded-full bg-white/80" />
            <span className="block h-0.5 w-4/5 rounded-full bg-white/65" />
            <span className="block h-0.5 w-3/5 rounded-full bg-indigo-300/80" />
          </div>
        </div>
      ) : (
        <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              mode === "video"
                ? PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS[0]
                : PHOTO_GUIDE_PORTRAIT_SRC
            }
            alt=""
            decoding="async"
            className="h-full w-full object-cover"
          />
          {mode === "video" ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/70 text-white backdrop-blur-sm">
                <svg
                  className="ml-0.5 h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M8 6.5v11l9-5.5Z" />
                </svg>
              </span>
            </span>
          ) : null}
        </div>
      )}

      <div className="min-w-0 flex-1 text-left">
        <h3
          id={titleId}
          className={`text-[13px] font-semibold ${
            glassChrome ? "text-white" : "text-zinc-900"
          }`}
        >
          {copy.title}
        </h3>
        <p
          className={`mt-0.5 text-[12px] font-medium leading-snug ${
            glassChrome ? "text-white/75" : "text-zinc-600"
          }`}
        >
          {copy.lead}
        </p>
      </div>
    </div>
  );
}

/** Backwards-compatible export for non-dock sticker photo sheet. */
export function StickerPickerGuide({
  glassChrome,
  centered,
  exampleUrl,
}: {
  glassChrome: boolean;
  centered: boolean;
  exampleUrl?: string | null;
}) {
  return (
    <div
      className={`flex w-full ${
        centered
          ? "flex-col items-center text-center"
          : "flex-row items-center gap-4"
      }`}
    >
      <StickerHeroVisual
        exampleUrl={exampleUrl}
        size="md"
        className={centered ? "" : "shrink-0"}
      />
      <div
        className={`flex flex-col ${
          centered ? "mt-3 items-center" : "items-start"
        }`}
      >
        <h3
          id="generation-sticker-picker-guide-title"
          className={`text-[15px] font-semibold ${
            glassChrome ? "text-white" : "text-zinc-900"
          }`}
        >
          {COMPOSE_STICKER_PICKER_GUIDE.title}
        </h3>
        <p
          className={`mt-1 text-[13px] font-medium leading-relaxed ${
            glassChrome ? "text-white/70" : "text-zinc-600"
          }`}
        >
          {COMPOSE_STICKER_PICKER_GUIDE.lead}
        </p>
      </div>
    </div>
  );
}

export function ComposeToolGuide({
  mode,
  glassChrome,
  compact = false,
  className = "",
  photoshootExample = null,
  stickerExampleUrl = null,
  stickerKind = "single",
  onStickerKindChange,
  photoExampleUrl = null,
}: Props) {
  const copy = composeToolGuideCopy(mode, { stickerKind });
  const titleId = GUIDE_TITLE_ID[mode];

  if (compact) {
    return (
      <ComposePhotoUploadGuide
        mode={mode}
        glassChrome={glassChrome}
        stickerKind={stickerKind}
        stickerExampleUrl={stickerExampleUrl}
      />
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={`flex min-h-0 w-full flex-col items-center justify-center ${className}`.trim()}
    >
      <div className="flex w-full max-w-[22rem] flex-col items-center gap-3 text-center">
        {mode === "sticker" && onStickerKindChange ? (
          <StickerKindToggle
            kind={stickerKind}
            onChange={onStickerKindChange}
            glassChrome={glassChrome}
          />
        ) : null}

        <ToolTransformationStage
          copy={copy}
          glassChrome={glassChrome}
          photoshootExample={photoshootExample}
          stickerExampleUrl={stickerExampleUrl}
          photoExampleUrl={photoExampleUrl}
        />

        <div className="flex w-full flex-col items-center">
          <h3
            id={titleId}
            className={`text-[15px] font-semibold tracking-tight ${
              glassChrome ? "text-white" : "text-zinc-900"
            }`}
          >
            {copy.title}
          </h3>

          <p
            className={`mt-1 max-w-[20.5rem] text-[13px] font-medium leading-relaxed ${
              glassChrome ? "text-white/75" : "text-zinc-600"
            }`}
          >
            {copy.lead}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {copy.chips.map((chip) => (
            <GuideSpecChip
              key={chip.label}
              chip={chip}
              glassChrome={glassChrome}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
