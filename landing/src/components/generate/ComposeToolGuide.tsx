"use client";

import { useEffect, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  COMPOSE_STICKER_PICKER_GUIDE,
  composeToolGuideCopy,
} from "@/lib/compose-tool-guide";
import {
  STICKER_TOOL_KINDS,
  stickerToolKindLabel,
  type GenerateComposeMode,
  type StickerToolKind,
} from "@/lib/generate-compose-mode";
import { PHOTO_GUIDE_PORTRAIT_SRC } from "@/lib/user-generation-photos-cache";
import {
  PHOTOSHOOT_TILE_INDEXES,
  PHOTOSHOOT_TILE_OBJECT_POSITION,
} from "@/lib/photoshoot";
import {
  PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_SOURCE,
  PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_TILES,
  PHOTOSHOOT_GUIDE_SOURCE_MS,
  PHOTOSHOOT_GUIDE_TILES_MS,
  type PhotoshootGuideExample,
} from "@/lib/photoshoot-compose-example";
import {
  FotoVPromtEmptyGuidance,
  FotoVPromtEmptyIllustration,
} from "@/components/foto-v-promt/FotoVPromtEmptyState";

type Props = {
  mode: GenerateComposeMode;
  glassChrome: boolean;
  className?: string;
  photoshootExample?: PhotoshootGuideExample | null;
  /** Real example sticker of the selected style — the accent of the sticker and pack guides. */
  stickerExampleUrl?: string | null;
  /** «Стикер» / «Стикер пак» toggle at the top of the sticker guide. */
  stickerKind?: StickerToolKind;
  onStickerKindChange?: (kind: StickerToolKind) => void;
  /** Frame for the photo / video guide: picked catalog example or the guide portrait. */
  photoExampleUrl?: string | null;
};

function SourceToTilesVisual({
  example,
  glassChrome,
}: {
  example: PhotoshootGuideExample;
  glassChrome: boolean;
}) {
  const [showTiles, setShowTiles] = useState(false);

  useEffect(() => {
    const urls = [example.sourceUrl, ...example.tileUrls];
    for (const src of urls) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [example.sourceUrl, example.tileUrls]);

  useEffect(() => {
    let timer = 0;
    let tiles = false;
    const tick = () => {
      tiles = !tiles;
      setShowTiles(tiles);
      timer = window.setTimeout(
        tick,
        tiles ? PHOTOSHOOT_GUIDE_TILES_MS : PHOTOSHOOT_GUIDE_SOURCE_MS,
      );
    };
    timer = window.setTimeout(tick, PHOTOSHOOT_GUIDE_SOURCE_MS);
    return () => window.clearTimeout(timer);
  }, [example.sourceUrl]);

  const frame = `relative mt-3 aspect-square w-full overflow-hidden rounded-2xl ring-1 ${
    glassChrome ? "ring-white/15" : "ring-zinc-200"
  }`;

  return (
    <div
      role="img"
      aria-label={
        showTiles
          ? PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_TILES
          : PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_SOURCE
      }
      className={frame}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={example.sourceUrl}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          showTiles ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        className={`absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 bg-zinc-950 transition-opacity duration-300 ${
          showTiles ? "opacity-100" : "opacity-0"
        }`}
      >
        {PHOTOSHOOT_TILE_INDEXES.map((tile, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile}
            src={example.tileUrls[index]}
            alt=""
            className="h-full w-full object-cover"
            style={
              example.cropTiles
                ? { objectPosition: PHOTOSHOOT_TILE_OBJECT_POSITION[tile] }
                : undefined
            }
          />
        ))}
      </div>
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-zinc-900/85 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
        {showTiles ? "4 кадра" : "1 фото"}
      </span>
    </div>
  );
}

/**
 * The one accent of both sticker guides: a real sticker of the chosen style, cut out.
 * No drawn placeholder — a generic figure reads as the product, and it isn't.
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
  if (!exampleUrl) return null;
  const box = size === "lg" ? "h-44 w-44" : "h-32 w-32";
  return (
    <div
      role="img"
      aria-label="Пример стикера"
      className={`relative flex ${box} items-center justify-center ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={exampleUrl}
        alt=""
        decoding="async"
        draggable={false}
        className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
      />
    </div>
  );
}

/** Empty plate: the sticker above the title, nothing else. */
function StickerCutoutVisual({ exampleUrl }: { exampleUrl?: string | null }) {
  return <StickerHeroVisual exampleUrl={exampleUrl} size="lg" />;
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
      className={`inline-flex rounded-full p-0.5 ${glassChrome ? "bg-white/10 ring-1 ring-white/15" : "bg-zinc-100 ring-1 ring-zinc-200"} ${className}`.trim()}
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
            className={`${OVERLAY_BUTTON_UA_RESET} min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition ${
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

/** Photo / video kind: one frame; video adds a play badge. */
function FrameVisual({
  src,
  video,
  glassChrome,
}: {
  src: string;
  video: boolean;
  glassChrome: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={video ? "Пример: фото становится видео" : "Пример фото"}
      className={`relative h-44 w-36 overflow-hidden rounded-2xl ring-1 ${glassChrome ? "ring-white/15" : "ring-zinc-200"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" decoding="async" draggable={false} className="h-full w-full object-cover" />
      {video ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/60 text-white shadow-lg backdrop-blur-sm">
            <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 6.5v11l9-5.5Z" />
            </svg>
          </span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Photo picker sheet guide for Стикер. Title is the action, one line of scope,
 * and the same sticker as the plate — not a studio portrait that reads as «people only».
 */
export function StickerPickerGuide({
  glassChrome,
  centered,
  exampleUrl,
}: {
  glassChrome: boolean;
  /** Mobile / expanded dock: centered column; desktop sheet: left-aligned. */
  centered: boolean;
  exampleUrl?: string | null;
}) {
  return (
    <div className={`flex w-full ${centered ? "flex-col items-center text-center" : "flex-row items-center gap-4"}`}>
      <StickerHeroVisual exampleUrl={exampleUrl} size="md" className={centered ? "" : "shrink-0"} />
      <div className={`flex flex-col ${centered ? "mt-4 items-center" : "items-start"}`}>
        <h3
          id="generation-sticker-picker-guide-title"
          className={`text-[15px] font-semibold ${glassChrome ? "text-white" : "text-zinc-900"}`}
        >
          {COMPOSE_STICKER_PICKER_GUIDE.title}
        </h3>
        <p className={`mt-1 text-[13px] font-medium leading-relaxed ${glassChrome ? "text-white/65" : "text-zinc-600"}`}>
          {COMPOSE_STICKER_PICKER_GUIDE.lead}
        </p>
      </div>
    </div>
  );
}

function PromptFromPhotoVisual({ glassChrome }: { glassChrome: boolean }) {
  return (
    <div
      role="img"
      aria-label="Пример: картинка превращается в текст промта"
      className="mt-3 flex w-full flex-col items-center"
    >
      <FotoVPromtEmptyIllustration immersive={glassChrome} />
      <FotoVPromtEmptyGuidance immersive={glassChrome} density="dock" />
    </div>
  );
}

const GUIDE_TITLE_ID: Record<GenerateComposeMode, string> = {
  image: "generation-photo-guide-title",
  video: "generation-video-guide-title",
  photoshoot: "generation-photoshoot-guide-title",
  sticker: "generation-sticker-guide-title",
  photo_prompt: "generation-photo-prompt-guide-title",
};

export function ComposeToolGuide({
  mode,
  glassChrome,
  className = "",
  photoshootExample = null,
  stickerExampleUrl = null,
  stickerKind = "single",
  onStickerKindChange,
  photoExampleUrl = null,
}: Props) {
  const copy = composeToolGuideCopy(mode, { stickerKind });
  const titleId = GUIDE_TITLE_ID[mode];
  const photoPrompt = copy.visual === "prompt-from-photo";
  const sticker = copy.visual === "sticker-cutout";
  const frame = copy.visual === "photo-frame" || copy.visual === "video-frame";
  /** Picture-first guides: hero above, one-line title under it. */
  const pictureFirst = sticker || frame;

  return (
    <section
      aria-labelledby={titleId}
      className={`flex min-h-0 flex-col items-center justify-center ${className}`.trim()}
    >
      <div
        className={`flex w-full flex-col items-center text-center ${
          photoPrompt ? "max-w-[18rem]" : pictureFirst ? "max-w-[15rem]" : "max-w-[13.5rem]"
        }`}
      >
        {mode === "sticker" && onStickerKindChange ? (
          <StickerKindToggle
            kind={stickerKind}
            onChange={onStickerKindChange}
            glassChrome={glassChrome}
            className="mb-4"
          />
        ) : null}
        {sticker ? <StickerCutoutVisual exampleUrl={stickerExampleUrl} /> : null}
        {frame ? (
          <FrameVisual
            src={photoExampleUrl || PHOTO_GUIDE_PORTRAIT_SRC}
            video={copy.visual === "video-frame"}
            glassChrome={glassChrome}
          />
        ) : null}
        <h3
          id={titleId}
          className={`${pictureFirst ? "mt-4 text-[15px]" : "text-[13px]"} font-semibold ${
            glassChrome ? "text-white" : "text-zinc-900"
          }`}
        >
          {copy.title}
        </h3>
        <p
          className={`mt-1 text-[13px] font-medium leading-relaxed ${
            glassChrome ? "text-white/65" : "text-zinc-600"
          }`}
        >
          {copy.lead}
        </p>
        {copy.visual === "source-to-tiles" && photoshootExample ? (
          <>
            <SourceToTilesVisual
              example={photoshootExample}
              glassChrome={glassChrome}
            />
            <p
              className={`mt-2 text-[13px] font-medium ${
                glassChrome ? "text-white/50" : "text-zinc-500"
              }`}
            >
              {copy.hint}
            </p>
          </>
        ) : photoPrompt ? (
          <PromptFromPhotoVisual glassChrome={glassChrome} />
        ) : null}
      </div>
    </section>
  );
}
