"use client";

import { useEffect, useState } from "react";

export const LISTING_MOBILE_MQ = "(max-width: 1023px)";
const LISTING_DESKTOP_MQ = "(min-width: 1024px)";

/** Client-only: false until mounted, then tracks `max-width: 1023px`. */
export function useListingIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LISTING_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

/** Client-only: false until mounted, then tracks `min-width: 1024px`. */
export function useListingIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LISTING_DESKTOP_MQ);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}
