"use client";

import type { TagEntry } from "@/lib/tag-registry";

type Props = {
  tags: TagEntry[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  /** When provided, shows count next to label e.g. "Портрет (42)" */
  countBySlug?: Record<string, number>;
};

export function FilterChips({
  tags,
  selectedSlug,
  onSelect,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Найти...",
  countBySlug,
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
    <div className="space-y-2">
      {tags.length > 20 && onSearchChange && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
          readOnly
        />
      )}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
            !selectedSlug
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          Все
        </button>
        {displayTags.map((tag) => {
          const count = countBySlug?.[tag.slug];
          const label = count != null ? `${tag.labelRu} (${count})` : tag.labelRu;
          return (
            <button
              key={tag.slug}
              type="button"
              onClick={() => onSelect(selectedSlug === tag.slug ? null : tag.slug)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                selectedSlug === tag.slug
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
