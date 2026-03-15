"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PromptCardFull } from "@/lib/supabase";
import { FilterableGrid } from "./CardFilters";

const PAGE_SIZE = 48;

type Props = {
  initialCards: PromptCardFull[];
  totalCount: number;
  rpcParams: Record<string, string | null>;
};

export function InfiniteGrid({ initialCards, totalCount, rpcParams }: Props) {
  const [cards, setCards] = useState(initialCards);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialCards.length < totalCount);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const offsetRef = useRef(initialCards.length);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(PAGE_SIZE));
      sp.set("offset", String(offsetRef.current));
      for (const [k, v] of Object.entries(rpcParams)) {
        if (v) sp.set(k, v);
      }
      const res = await fetch(`/api/listing?${sp}`);
      const data = await res.json();
      const newCards = (data.cards || []) as PromptCardFull[];
      if (newCards.length > 0) {
        setCards((prev) => [...prev, ...newCards]);
        offsetRef.current += newCards.length;
      }
      setHasMore(newCards.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore, rpcParams]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current) {
          loadMore();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const countText = useMemo(() => {
    const n = totalCount;
    if (n === 1) return "1 промпт";
    if (n >= 2 && n <= 4) return `${n} промпта`;
    return `${n} промптов`;
  }, [totalCount]);

  return (
    <>
      <div className="mt-4 mb-8 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm tabular-nums text-zinc-600">
          {countText}
        </span>
      </div>

      <FilterableGrid cards={cards} />

      {hasMore && <div ref={sentinelRef} className="h-px" />}

      {loading && (
        <div className="flex justify-center py-12">
          <span className="block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" />
        </div>
      )}
    </>
  );
}
