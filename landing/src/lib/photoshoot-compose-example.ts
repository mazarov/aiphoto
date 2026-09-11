import { isInternalGenerateAllowlistedEmail } from "./internal-generate-allowlist";
import { PHOTO_GUIDE_PORTRAIT_SRC } from "./user-generation-photos-cache";
import { isVideoAnimateFlagOn } from "./video-generation-contract";

export const PHOTOSHOOT_COMPOSE_EXAMPLE_CONFIG_KEY =
  "photoshoot_compose_example_enabled";

/** Catalog card used as the empty-plate example inside the generate dock. */
export const PHOTOSHOOT_COMPOSE_EXAMPLE_SLUG =
  "photoshoot-plannertemperature200-four-frame-contact-sheet-from-the-attached-phot-c0b56";

export const PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC =
  "/generate/photoshoot-example-source.jpg";

export const PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS = [
  "/generate/photoshoot-example-1.jpg",
  "/generate/photoshoot-example-2.jpg",
  "/generate/photoshoot-example-3.jpg",
  "/generate/photoshoot-example-4.jpg",
] as const;

export const PHOTOSHOOT_GUIDE_SOURCE_MS = 1800;
export const PHOTOSHOOT_GUIDE_TILES_MS = 2600;

export const PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_SOURCE =
  "Одно исходное фото для фотосессии";
export const PHOTOSHOOT_COMPOSE_EXAMPLE_ARIA_TILES =
  "Четыре кадра, которые получились из этого фото";

export type PhotoshootGuideExample = {
  sourceUrl: string;
  tileUrls: readonly [string, string, string, string];
  cropTiles: boolean;
};

const CATALOG_GUIDE_EXAMPLE: PhotoshootGuideExample = {
  sourceUrl: PHOTOSHOOT_COMPOSE_EXAMPLE_SOURCE_SRC,
  tileUrls: PHOTOSHOOT_COMPOSE_EXAMPLE_TILE_SRCS,
  cropTiles: false,
};

const FALLBACK_GUIDE_EXAMPLE: PhotoshootGuideExample = {
  sourceUrl: PHOTO_GUIDE_PORTRAIT_SRC,
  tileUrls: [
    PHOTO_GUIDE_PORTRAIT_SRC,
    PHOTO_GUIDE_PORTRAIT_SRC,
    PHOTO_GUIDE_PORTRAIT_SRC,
    PHOTO_GUIDE_PORTRAIT_SRC,
  ] as const,
  cropTiles: true,
};

/**
 * Prod follows `photoshoot_compose_example_enabled`.
 * Allowlisted internals and local `next dev` stay unlocked — same as photoshoot.
 */
export function isPhotoshootComposeExampleUnlocked(
  value: string | undefined,
  userEmail?: string | null,
): boolean {
  if (isVideoAnimateFlagOn(value)) return true;
  if (isInternalGenerateAllowlistedEmail(userEmail)) return true;
  return process.env.NODE_ENV === "development";
}

export function composePhotoshootGuideExample(
  exampleEnabled: boolean,
): PhotoshootGuideExample {
  return exampleEnabled ? CATALOG_GUIDE_EXAMPLE : FALLBACK_GUIDE_EXAMPLE;
}
