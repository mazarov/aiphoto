"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVirtualPageView } from "@/lib/yandex-metrika";

function pageTitleFromUrl(url: string): string | undefined {
  if (!url.startsWith("/search")) return undefined;
  try {
    const q = new URL(url, "http://local").searchParams.get("q")?.trim();
    return q ? `Поиск: ${q} — PromptShot` : "Поиск промптов — PromptShot";
  } catch {
    return undefined;
  }
}

function currentUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

/**
 * Sends ym('hit') on Next.js client navigations (pathname / query changes).
 * Initial full page load is already counted by ym('init') in layout.tsx.
 */
export function YandexMetrikaRouteTracker() {
  const pathname = usePathname();
  const prevUrlRef = useRef<string | null>(null);
  const skipInitialRef = useRef(true);

  useEffect(() => {
    const url = currentUrl();

    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      prevUrlRef.current = url;
      return;
    }

    if (prevUrlRef.current === url) return;

    const referer = prevUrlRef.current ?? undefined;
    prevUrlRef.current = url;

    trackVirtualPageView(url, {
      referer,
      title: pageTitleFromUrl(url),
    });
  }, [pathname]);

  return null;
}

/** Track /search?q= changes when pathname stays /search (client query updates). */
export function SearchMetrikaTracker({ query }: { query: string }) {
  const prevQueryRef = useRef<string | null>(null);
  const skipInitialRef = useRef(true);

  useEffect(() => {
    const normalized = query.trim();
    const url = normalized
      ? `/search?q=${encodeURIComponent(normalized)}`
      : "/search";

    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      prevQueryRef.current = url;
      return;
    }

    if (prevQueryRef.current === url) return;

    const referer = prevQueryRef.current ?? undefined;
    prevQueryRef.current = url;

    trackVirtualPageView(url, {
      referer,
      title: pageTitleFromUrl(url),
    });
  }, [query]);

  return null;
}
