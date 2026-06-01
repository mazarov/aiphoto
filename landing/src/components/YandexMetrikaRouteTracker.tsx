"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackVirtualPageView } from "@/lib/yandex-metrika";

function pageTitle(pathname: string, searchParams: URLSearchParams): string | undefined {
  if (pathname !== "/search") return undefined;
  const q = searchParams.get("q")?.trim();
  return q ? `Поиск: ${q} — PromptShot` : "Поиск промптов — PromptShot";
}

/**
 * Sends ym('hit') on Next.js client navigations (pathname / query changes).
 * Initial full page load is already counted by ym('init') in layout.tsx.
 */
export function YandexMetrikaRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevUrlRef = useRef<string | null>(null);
  const skipInitialRef = useRef(true);

  useEffect(() => {
    const qs = searchParams.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

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
      title: pageTitle(pathname, searchParams),
    });
  }, [pathname, searchParams]);

  return null;
}
