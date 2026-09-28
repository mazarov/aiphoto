import type { GeneraciyaSeoFrame } from "./generaciya-seo-frame";
import {
  buildGeneraciyaPhotoshootAlts,
  generaciyaPromptLinkLabel,
  resolveGeneraciyaFrameAlt,
} from "./generaciya-seo-alt";
import {
  GENERACIYA_FIRST_SCREEN_TARGET,
  rankGeneraciyaFirstScreen,
  type GeneraciyaRankCandidate,
} from "./generaciya-first-screen-rank";
import {
  buildGeneraciyaSeoImagePath,
  type GeneraciyaSeoVariant,
} from "./generaciya-seo-image-url";
import {
  generaciyaSeoImageMode,
  type GeneraciyaSeoImageFlags,
} from "./generaciya-seo-image-flags";

export const GENERACIYA_SEO_GALLERY_LIMIT = GENERACIYA_FIRST_SCREEN_TARGET;

export type GeneraciyaSeoCardSlice = {
  id: string;
  title_ru: string | null;
  title_en: string | null;
  photoUrls: string[];
  photoMeta: {
    url: string;
    bucket: string;
    path: string;
    width: number | null;
    height: number | null;
    seoAltRu?: string | null;
  }[];
  sourceGroupKey: string | null;
  cardSplitTotal: number;
};

type ExampleLike = {
  id: string;
  title: string;
  isPhotoshoot: boolean;
};

export function generaciyaRankCandidate(card: GeneraciyaSeoCardSlice): GeneraciyaRankCandidate {
  const primary = card.photoMeta[0];
  return {
    id: card.id,
    sourceGroupKey: card.sourceGroupKey,
    cardSplitTotal: card.cardSplitTotal,
    mediaPath: primary?.path ?? null,
    width: primary?.width ?? null,
    height: primary?.height ?? null,
  };
}

export function applyGeneraciyaFirstScreenRank<T extends GeneraciyaSeoCardSlice>(
  cards: readonly T[],
  enabled: boolean,
): T[] {
  if (!enabled) return [...cards];
  return rankGeneraciyaFirstScreen(cards, generaciyaRankCandidate);
}

export function attachGeneraciyaSeoFrames<T extends ExampleLike>(
  fullCards: readonly GeneraciyaSeoCardSlice[],
  exampleCards: readonly T[],
  flags: GeneraciyaSeoImageFlags,
  headings: readonly string[],
): (T & { seoFrame?: GeneraciyaSeoFrame })[] {
  const mode = generaciyaSeoImageMode(flags);
  const imageOn = mode !== "current";
  const altOn = flags.descriptiveAlt;
  if (!imageOn && !altOn) return exampleCards.map((card) => ({ ...card }));

  return exampleCards.map((example, index) => {
    if (index >= GENERACIYA_SEO_GALLERY_LIMIT) return { ...example };
    const full = fullCards[index];
    if (!full || full.id !== example.id || full.photoMeta.length === 0) {
      return { ...example };
    }
    const photoshoot = example.isPhotoshoot && full.photoMeta.length === 4;
    const alts = altOn
      ? photoshoot
        ? buildGeneraciyaPhotoshootAlts(
            full.photoMeta.map((media) => ({ stored: media.seoAltRu })),
            example.title,
            headings,
          )
        : [
            resolveGeneraciyaFrameAlt({
              stored: full.photoMeta[0]?.seoAltRu,
              title: example.title,
              headings,
            }),
          ]
      : null;
    const seoFrame: GeneraciyaSeoFrame = {
      mode,
      alts,
      linkLabel: altOn ? generaciyaPromptLinkLabel(example.title) : null,
      images: full.photoMeta.map((media) => ({
        bucket: media.bucket,
        path: media.path,
        previewUrl: media.url,
        width: media.width,
        height: media.height,
      })),
    };
    return { ...example, seoFrame };
  });
}

export function generaciyaSeoRepresentativeImage(
  card: GeneraciyaSeoCardSlice | undefined,
  flags: GeneraciyaSeoImageFlags,
  siteUrl: string,
): string | null {
  const media = card?.photoMeta[0];
  const fallback = media?.url || card?.photoUrls[0] || null;
  if (!media) return fallback;
  const mode = generaciyaSeoImageMode(flags);
  if (mode === "current") return fallback;
  const variant: GeneraciyaSeoVariant = mode === "single512" ? "w512" : "w1080";
  const path = buildGeneraciyaSeoImagePath(variant, media.bucket, media.path);
  if (!path) return fallback;
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

export function generaciyaRepresentativeAlt(
  card: GeneraciyaSeoCardSlice | undefined,
  exampleTitle: string | undefined,
  flags: GeneraciyaSeoImageFlags,
  headings: readonly string[],
): string | null {
  if (!flags.descriptiveAlt || !card) return null;
  const alt = resolveGeneraciyaFrameAlt({
    stored: card.photoMeta[0]?.seoAltRu,
    title: exampleTitle || card.title_ru || card.title_en || "",
    headings,
  });
  return alt || null;
}

export function generaciyaJsonLdImage(
  url: string | null,
  caption: string | null,
): string | { "@type": "ImageObject"; url: string; caption: string } | undefined {
  if (!url) return undefined;
  if (!caption) return url;
  return { "@type": "ImageObject", url, caption };
}
