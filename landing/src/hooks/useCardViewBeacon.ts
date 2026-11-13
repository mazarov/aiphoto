"use client";

import { useEffect, useRef, useState } from "react";
import { browserAcquisitionIds } from "@/lib/acquisition-client-events";
import { CARD_SNAP_ANALYTICS_DWELL_MS } from "@/lib/mobile-card-snap";

const STORAGE_PREFIX = "promptshot_view_";

type ApiOk = { ok: true; viewCount: number };
type ApiErr = { ok: false; error?: string };

/**
 * One POST /api/card-view per browser tab session per slug (sessionStorage).
 * Initial card opened fires immediately; subsequent neighbor swipes inside the
 * same viewer wait for `CARD_SNAP_ANALYTICS_DWELL_MS` so fast flicks don't spam API/DB.
 */
export function useCardViewBeacon(slug: string, initialViewCount: number): number {
  const [viewCount, setViewCount] = useState(initialViewCount);
  const initialMountSlugRef = useRef(slug);

  useEffect(() => {
    setViewCount(initialViewCount);
  }, [slug, initialViewCount]);

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;

    const key = `${STORAGE_PREFIX}${slug}`;
    if (sessionStorage.getItem(key)) return;

    let cancelled = false;
    const dwellMs =
      slug === initialMountSlugRef.current ? 0 : CARD_SNAP_ANALYTICS_DWELL_MS;

    const sendBeacon = async () => {
      try {
        const { visitorId, sessionId } = browserAcquisitionIds();
        const res = await fetch("/api/card-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, visitorId, sessionId }),
        });
        const data = (await res.json()) as ApiOk | ApiErr;
        if (cancelled) return;
        if (data.ok && typeof data.viewCount === "number") {
          sessionStorage.setItem(key, "1");
          setViewCount(data.viewCount);
        }
      } catch {
        /* best-effort — page already rendered */
      }
    };

    if (dwellMs <= 0) {
      void sendBeacon();
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      if (!cancelled) {
        void sendBeacon();
      }
    }, dwellMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  return viewCount;
}
