"use client";

import { useEffect, useState } from "react";
import { composeToolGuideCopy } from "@/lib/compose-tool-guide";
import type { GenerateComposeMode } from "@/lib/generate-compose-mode";
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
  mode: Extract<GenerateComposeMode, "photoshoot" | "photo_prompt">;
  glassChrome: boolean;
  className?: string;
  photoshootExample?: PhotoshootGuideExample | null;
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

export function ComposeToolGuide({
  mode,
  glassChrome,
  className = "",
  photoshootExample = null,
}: Props) {
  const copy = composeToolGuideCopy(mode);
  if (!copy) return null;
  const titleId =
    mode === "photoshoot"
      ? "generation-photoshoot-guide-title"
      : "generation-photo-prompt-guide-title";
  const photoPrompt = copy.visual === "prompt-from-photo";

  return (
    <section
      aria-labelledby={titleId}
      className={`flex min-h-0 flex-col items-center justify-center ${className}`.trim()}
    >
      <div
        className={`flex w-full flex-col items-center text-center ${
          photoPrompt ? "max-w-[18rem]" : "max-w-[13.5rem]"
        }`}
      >
        <h3
          id={titleId}
          className={`text-[13px] font-semibold ${
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
        ) : (
          <PromptFromPhotoVisual glassChrome={glassChrome} />
        )}
      </div>
    </section>
  );
}
