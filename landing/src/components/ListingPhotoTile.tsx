"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ListingCardVideo } from "@/components/ListingCardVideo";
import { PhotoshootListingBadge } from "@/components/PhotoshootListingBadge";
import { PhotoshootListingGrid } from "@/components/PhotoshootListingGrid";
import { SeoIndexableImage } from "@/components/generate/SeoIndexableImage";
import { usePromptCardModal } from "@/context/PromptCardModalContext";
import {
  CARD_IMAGE_LISTING_NEXT_QUALITY,
  SIZES_CARD_GRID,
} from "@/lib/card-image-presets";
import { buildCardImageAlt } from "@/lib/card-meta-title";
import { generaciyaLiveTileAlt } from "@/lib/generaciya-seo-alt";
import { buildGeneraciyaSeoImgAttrs } from "@/lib/generaciya-seo-image-url";
import type { GeneraciyaSeoFrameImage } from "@/lib/generaciya-seo-frame";
import type { GenerationExampleCard } from "@/lib/generation/example-card";

type Props = {
  card: GenerationExampleCard;
  aspectRatio: number;
  priority?: boolean;
  debugOverlay?: ReactNode;
  /**
   * Visual clone (marquee loop). Parent should be aria-hidden.
   * No link/button descendants — otherwise aria-hidden-focus fails.
   */
  decorative?: boolean;
  /** Hero strip: still poster only — never autoplay mp4 in the first viewport. */
  still?: boolean;
  sizes?: string;
  /** SEO img alt + link name (H1/H2 + hook on catalog hubs). */
  imageAlt?: string;
};

export function ListingPhotoTile({
  card,
  aspectRatio,
  priority = false,
  debugOverlay,
  decorative = false,
  still = false,
  sizes = SIZES_CARD_GRID,
  imageAlt: imageAltOverride,
}: Props) {
  const { open, prefetchCard } = usePromptCardModal();
  const [photoshootGridFailed, setPhotoshootGridFailed] = useState(false);
  const photoshootUrls =
    card.isPhotoshoot && card.photoUrls.length === 4 ? card.photoUrls : null;
  const frame = decorative ? undefined : card.seoFrame;
  const cardLabel = buildCardImageAlt(card.title);
  const imageAlt = generaciyaLiveTileAlt({
    decorative,
    frameAlts: frame?.alts,
    fallback: imageAltOverride || cardLabel,
  });
  const linkLabel = decorative ? "" : frame?.linkLabel || imageAlt;
  const showVideo = Boolean(card.videoUrl) && !decorative && !still;
  const seoMode = frame && frame.mode !== "current" ? frame.mode : null;

  function seoAttrs(image: GeneraciyaSeoFrameImage, alt: string) {
    if (!seoMode) return null;
    return buildGeneraciyaSeoImgAttrs({
      mode: seoMode,
      bucket: image.bucket,
      path: image.path,
      previewUrl: image.previewUrl,
      alt,
    });
  }

  const primarySeo = frame?.images[0] ? seoAttrs(frame.images[0], imageAlt) : null;
  const photoshootSeo = photoshootUrls
    ? frame?.images.slice(0, 4).map((image, index) => {
        const alt = frame.alts ? (frame.alts[index] ?? "") : index === 0 ? imageAlt : "";
        const attrs = seoAttrs(image, alt);
        if (!attrs) return null;
        return {
          ...attrs,
          width: image.width,
          height: image.height,
        };
      })
    : null;
  const photoshootSeoFrames =
    photoshootSeo && photoshootSeo.every((item) => item !== null)
      ? photoshootSeo
      : null;

  return (
    <article
      className="group relative isolate overflow-hidden rounded-2xl bg-zinc-100 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/10"
      style={{ aspectRatio }}
      aria-hidden={decorative || undefined}
    >
      {photoshootUrls && !photoshootGridFailed ? (
        <PhotoshootListingGrid
          urls={photoshootUrls}
          alt={imageAlt}
          alts={frame?.alts}
          frames={photoshootSeoFrames}
          priority={priority}
          onError={() => setPhotoshootGridFailed(true)}
          onPrefetch={decorative ? undefined : () => prefetchCard(card.slug)}
          onSelect={
            decorative
              ? undefined
              : (url, index) => {
                  open(card.slug, {
                    photoUrl: url,
                    photoIndex: index,
                    photoCount: card.photoCount,
                    hasPrompts: card.hasPrompt,
                  });
                }
          }
          sizes={sizes}
        />
      ) : photoshootGridFailed ? (
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-violet-100"
          aria-hidden
        />
      ) : showVideo ? (
        <ListingCardVideo src={card.videoUrl!} poster={card.photoUrl} />
      ) : primarySeo ? (
        <SeoIndexableImage
          src={primarySeo.src}
          srcSet={primarySeo.srcSet}
          alt={primarySeo.alt}
          sizes={sizes}
          priority={priority}
          width={frame?.images[0]?.width ?? card.photoWidth}
          height={frame?.images[0]?.height ?? card.photoHeight}
        />
      ) : card.photoUrl ? (
        <Image
          src={card.photoUrl}
          alt={imageAlt}
          fill
          sizes={sizes}
          quality={CARD_IMAGE_LISTING_NEXT_QUALITY}
          priority={priority}
          fetchPriority={priority ? "high" : undefined}
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-violet-100"
          aria-hidden
        />
      )}

      {debugOverlay}

      {card.isPhotoshoot ? <PhotoshootListingBadge /> : null}

      {decorative ? (
        <div
          className="absolute inset-0 z-10"
          onPointerEnter={() => prefetchCard(card.slug)}
          onClick={() => {
            open(card.slug, {
              photoUrl: card.photoUrl,
              photoCount: card.photoCount,
              hasPrompts: card.hasPrompt,
            });
          }}
        />
      ) : (
        <Link
          href={`/p/${card.slug}`}
          className={`absolute inset-0 z-10${
            photoshootUrls && !photoshootGridFailed ? " pointer-events-none" : ""
          }`}
          aria-label={linkLabel}
          prefetch
          onPointerEnter={() => prefetchCard(card.slug)}
          onTouchStart={() => prefetchCard(card.slug)}
          onClick={(event) => {
            event.preventDefault();
            open(card.slug, {
              photoUrl: card.photoUrl,
              photoCount: card.photoCount,
              hasPrompts: card.hasPrompt,
            });
          }}
        />
      )}
    </article>
  );
}
