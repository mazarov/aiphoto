"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function CyclingPreviewImage({
  images,
  alt = "",
  sizes,
  priority = false,
  quality,
  containWithBackdrop = false,
  coverOnMobile = false,
  paused = false,
  onFrameChange,
  className = "",
}: {
  images: string[];
  alt?: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
  containWithBackdrop?: boolean;
  coverOnMobile?: boolean;
  paused?: boolean;
  onFrameChange?: (index: number) => void;
  className?: string;
}) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [images]);

  useEffect(() => {
    if (images.length < 2 || paused) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (reducedMotion.matches) return;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % images.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [images, paused]);

  useEffect(() => {
    onFrameChange?.(frameIndex);
  }, [frameIndex, onFrameChange]);

  const imageUrl = images[frameIndex % Math.max(1, images.length)];
  if (!imageUrl) return null;

  return (
    <>
      {containWithBackdrop ? (
        <Image
          key={`backdrop-${imageUrl}`}
          src={imageUrl}
          alt=""
          fill
          sizes={sizes}
          quality={quality}
          className={`scale-110 object-cover opacity-60 blur-2xl ${
            coverOnMobile ? "hidden lg:block" : ""
          }`}
          aria-hidden
        />
      ) : null}
      <Image
        key={imageUrl}
        src={imageUrl}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority && frameIndex === 0}
        quality={quality}
        className={`generation-preview-enter ${
          containWithBackdrop
            ? coverOnMobile
              ? "z-[1] object-cover lg:object-contain"
              : "z-[1] object-contain"
            : ""
        } ${className}`}
      />
    </>
  );
}
