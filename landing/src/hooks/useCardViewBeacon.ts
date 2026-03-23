"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "promptshot_view_";

type ApiOk = { ok: true; viewCount: number };
type ApiErr = { ok: false; error?: string };

/**
 * One POST /api/card-view per browser tab session per slug (sessionStorage).
 * Returns live view count (updates after successful beacon).
 */
export function useCardViewBeacon(slug: string, initialViewCount: number): number {
  const [viewCount, setViewCount] = useState(initialViewCount);

  useEffect(() => {
    setViewCount(initialViewCount);
  }, [slug, initialViewCount]);

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;

    const key = `${STORAGE_PREFIX}${slug}`;
    if (sessionStorage.getItem(key)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/card-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
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
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return viewCount;
}
