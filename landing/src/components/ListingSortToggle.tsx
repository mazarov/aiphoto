"use client";

import type { ListingSort } from "@/lib/listing-sort";
import { FILTER_CHROME_SURFACE } from "@/lib/listing-filter-styles";

type Props = {
  sort: ListingSort;
  onSortChange: (sort: ListingSort) => void;
  /** Inside unified toolbar — no outer chrome border. */
  embedded?: boolean;
};

const OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "popular", label: "Популярное" },
  { value: "new", label: "Новое" },
];

export function ListingSortToggle({ sort, onSortChange, embedded = false }: Props) {
  const shell = embedded
    ? "inline-flex h-9 items-center rounded-lg bg-indigo-50/70 p-0.5"
    : `inline-flex h-10 items-center rounded-xl p-1 ${FILTER_CHROME_SURFACE}`;

  return (
    <div className={shell} role="group" aria-label="Сортировка каталога">
      {OPTIONS.map((opt) => {
        const active = sort === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSortChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-sm font-medium transition-[background,color,box-shadow] sm:px-3 ${
              active
                ? "bg-white text-indigo-700 shadow-sm shadow-indigo-500/10 ring-1 ring-indigo-200/80"
                : "text-zinc-600 hover:text-indigo-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
