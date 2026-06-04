"use client";

import { useEffect, useRef, useState } from "react";
import { FotoVPromtMiniBanner } from "./FotoVPromtMiniBanner";
import { trackFotoVPromtBannerImpressionOnce } from "@/lib/foto-v-promt-banner-metrics";
import { LISTING_SCROLL_ROOT_ID } from "@/lib/scroll-preservation";

/**
 * Sticky promo for first screen of listing; unmounts after user scrolls past (IntersectionObserver).
 */
export function ListingFotoVPromtBanner() {
  const [visible, setVisible] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackFotoVPromtBannerImpressionOnce("listing");
  }, []);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el || !visible) return;

    const mq = window.matchMedia("(max-width: 1023px)");

    const getRoot = (): Element | null =>
      mq.matches ? document.getElementById(LISTING_SCROLL_ROOT_ID) : null;

    let observer: IntersectionObserver | null = null;

    const attach = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            setVisible(false);
          }
        },
        { root: getRoot(), threshold: 0 },
      );
      observer.observe(el);
    };

    attach();
    mq.addEventListener("change", attach);

    return () => {
      mq.removeEventListener("change", attach);
      observer?.disconnect();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      className="sticky z-30 -mx-2 mb-2 contain-layout max-lg:top-0 sm:-mx-5 lg:top-[var(--ps-header-height,57px)] [transition:none] motion-reduce:transition-none"
    >
      <FotoVPromtMiniBanner variant="listing" />
    </div>
  );
}
