"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getTagsByDimension, findTagBySlug, type Dimension } from "@/lib/tag-registry";
import type { PromptCardFull } from "@/lib/supabase";

export type FilterCountRow = { dimension: string; slug: string; cards_count: number };

function aggregateCountsFromCards(cards: PromptCardFull[]): FilterCountRow[] {
  const byDim: Record<string, Record<string, number>> = {};
  const dims = ["audience_tag", "style_tag", "occasion_tag", "object_tag"] as const;
  for (const card of cards) {
    const tags = (card.seo_tags || {}) as Record<string, string[]>;
    for (const dim of dims) {
      const arr = tags[dim] || [];
      for (const slug of arr) {
        if (!slug || slug === "") continue;
        if (!byDim[dim]) byDim[dim] = {};
        byDim[dim][slug] = (byDim[dim][slug] || 0) + 1;
      }
    }
  }
  const result: FilterCountRow[] = [];
  for (const [dim, slugs] of Object.entries(byDim)) {
    for (const [slug, count] of Object.entries(slugs)) {
      if (count > 0) result.push({ dimension: dim, slug, cards_count: count });
    }
  }
  return result;
}

type Options = {
  /** Catalog: fetch counts from API */
  rpcParams?: Record<string, string | null>;
  /** Search: compute counts from loaded cards */
  cardsForCounts?: PromptCardFull[];
};

export function useListingFilterCounts({ rpcParams, cardsForCounts }: Options) {
  const [apiCounts, setApiCounts] = useState<FilterCountRow[]>([]);

  const countsFromCards = useMemo(
    () => (cardsForCounts?.length ? aggregateCountsFromCards(cardsForCounts) : []),
    [cardsForCounts]
  );

  const fetchCounts = useCallback(async () => {
    if (!rpcParams) return;
    try {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(rpcParams)) {
        if (v) sp.set(k, v);
      }
      sp.set("site_lang", "ru");
      const res = await fetch(`/api/filter-counts?${sp.toString()}`);
      const data = (await res.json()) as FilterCountRow[];
      setApiCounts(data);
    } catch {
      setApiCounts([]);
    }
  }, [rpcParams]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const counts = rpcParams ? apiCounts : countsFromCards;

  const getTagsWithCounts = useCallback(
    (dim: Dimension, selectedSlug: string | null) => {
      const allTags = getTagsByDimension(dim);
      const hasCounts = rpcParams || cardsForCounts?.length;
      if (!hasCounts || counts.length === 0) {
        return { tags: allTags, countBySlug: {} as Record<string, number> };
      }
      const dimCounts = counts.filter((r) => r.dimension === dim);
      const countBySlug: Record<string, number> = {};
      for (const r of dimCounts) {
        countBySlug[r.slug] = r.cards_count;
      }
      const applicable = allTags
        .filter((t) => (countBySlug[t.slug] ?? 0) > 0)
        .sort((a, b) => (countBySlug[b.slug] ?? 0) - (countBySlug[a.slug] ?? 0));
      const selectedTag = selectedSlug ? findTagBySlug(dim, selectedSlug) : null;
      const missingSelected =
        selectedTag && !applicable.some((a) => a.slug === selectedTag.slug) ? [selectedTag] : [];
      const tags = [...missingSelected, ...applicable];
      return { tags, countBySlug };
    },
    [rpcParams, cardsForCounts, counts]
  );

  return { getTagsWithCounts };
}
