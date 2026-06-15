"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FVP_BORDER_CARD,
  FVP_RING_INSET_SOFT,
  FVP_SURFACE_WIDGET_INSET,
  FVP_SURFACE_WIDGET_OUTER,
} from "./foto-v-promt-tokens";

const PromptRemixWidget = dynamic(
  () => import("./PromptRemixWidget").then((m) => ({ default: m.PromptRemixWidget })),
  { ssr: false, loading: () => <PromptSceneLiteSkeleton /> },
);

/** Static placeholder while the widget chunk loads or section is off-screen. */
export function PromptSceneLiteSkeleton() {
  return (
    <div
      className={`mx-auto w-full max-w-3xl rounded-2xl ${FVP_BORDER_CARD} ${FVP_SURFACE_WIDGET_OUTER} p-4 shadow-md shadow-zinc-200/60 sm:p-5`}
      aria-hidden
    >
      <div className="space-y-4">
        <div className="h-3 w-24 rounded bg-zinc-200" />
        <div
          className={`h-10 w-full max-w-xs rounded-lg ${FVP_SURFACE_WIDGET_INSET} p-1 ${FVP_RING_INSET_SOFT}`}
          aria-hidden
        >
          <div className="flex h-full gap-0.5">
            <div className="flex-1 rounded-md bg-indigo-600/70" />
            <div className="flex-1 rounded-md bg-zinc-200" />
          </div>
        </div>
        <div className="h-36 w-full rounded-xl bg-zinc-100" />
        <div className="h-11 w-full rounded-lg bg-zinc-200 sm:max-w-[12rem]" />
      </div>
    </div>
  );
}

const PromptSceneLiteWidget = dynamic(
  () => import("./PromptSceneLiteWidget").then((m) => ({ default: m.PromptSceneLiteWidget })),
  { ssr: false, loading: () => <PromptSceneLiteSkeleton /> },
);

/**
 * Defers mounting the heavy client widget until the section is near the viewport.
 * If ?card=<slug> is present in the URL, renders PromptRemixWidget immediately instead.
 */
export function PromptSceneLiteWidgetGate() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mountWidget, setMountWidget] = useState(false);
  const [cardSlug, setCardSlug] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState(false);

  // Resolve ?card query param on the client (avoids useSearchParams + Suspense on SSR page)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("card");
      setCardSlug(c && c.trim() ? c.trim() : null);
    } finally {
      setResolvedParams(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#foto-v-promt-widget") {
      setMountWidget(true);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === "#foto-v-promt-widget") setMountWidget(true);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // IntersectionObserver only for the regular analyze mode (no ?card)
  useEffect(() => {
    if (mountWidget || cardSlug) return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setMountWidget(true);
      },
      { root: null, rootMargin: "240px 0px 240px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mountWidget, cardSlug]);

  return (
    <div ref={hostRef} className="mx-auto w-full max-w-3xl">
      {!resolvedParams ? (
        <PromptSceneLiteSkeleton />
      ) : cardSlug ? (
        <PromptRemixWidget cardSlug={cardSlug} />
      ) : mountWidget ? (
        <PromptSceneLiteWidget />
      ) : (
        <PromptSceneLiteSkeleton />
      )}
    </div>
  );
}
