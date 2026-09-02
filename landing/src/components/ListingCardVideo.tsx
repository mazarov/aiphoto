"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
};

/** Muted loop on listing tiles — fetch the mp4 only when the tile is near view. */
export function ListingCardVideo({ src, poster, className = "" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActive(true);
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={active ? src : undefined}
      poster={poster || undefined}
      muted
      loop
      playsInline
      autoPlay={active}
      preload={active ? "metadata" : "none"}
      className={`absolute inset-0 z-[2] h-full w-full object-cover ${className}`.trim()}
    />
  );
}
