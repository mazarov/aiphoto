"use client";

import type { TagEntry } from "@/lib/tag-registry";
import {
  FILTER_CHIP,
  FILTER_CHIP_COUNT,
  FILTER_CHIP_SELECTED,
  FILTER_SEARCH_INPUT,
} from "@/lib/listing-filter-styles";

type Props = {
  tags: TagEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  countBySlug?: Record<string, number>;
  searchMinCount?: number;
};

export function FilterChips({
  tags,
  selectedSlug,
  onSelect,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Найти...",
  countBySlug,
  searchMinCount = 20,
}: Props) {
  const filtered = searchQuery.trim()
    ? tags.filter(
        (t) =>
          t.labelRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tags;

  const displayTags = filtered.slice(0, 50);

  return (
    <div className="space-y-3">
      {tags.length > searchMinCount && onSearchChange && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={FILTER_SEARCH_INPUT}
        />
      )}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={!selectedSlug ? FILTER_CHIP_SELECTED : FILTER_CHIP}
        >
          Все
        </button>
        {displayTags.map((tag) => {
          const count = countBySlug?.[tag.slug];
          const isSelected = selectedSlug === tag.slug;
          return (
            <button
              key={tag.slug}
              type="button"
              onClick={() => onSelect(isSelected ? null : tag.slug)}
              className={isSelected ? FILTER_CHIP_SELECTED : FILTER_CHIP}
            >
              <span>{tag.labelRu}</span>
              {count != null && (
                <span className={isSelected ? FILTER_CHIP_COUNT : "text-xs tabular-nums text-zinc-400"}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
