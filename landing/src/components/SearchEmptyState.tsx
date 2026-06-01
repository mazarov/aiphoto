"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SEARCH_SUGGESTIONS } from "@/lib/search-suggestions";
import { ListingSearchIcon } from "./ListingSearchField";

type Variant = "idle" | "no-results" | "filters-empty";

type Props = {
  variant: Variant;
  query?: string;
  onClearFilters?: () => void;
};

function SuggestionChips({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {SEARCH_SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="rounded-full border border-indigo-100/90 bg-white/80 px-3 py-1 text-[12px] font-medium text-zinc-500 shadow-sm shadow-indigo-500/[0.06] transition-all hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-700 active:scale-95"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function SearchEmptyState({ variant, query, onClearFilters }: Props) {
  const router = useRouter();

  const title =
    variant === "idle"
      ? "Опишите образ для фото"
      : variant === "filters-empty"
        ? "Фильтры скрыли все результаты"
        : query
          ? `«${query}» — ничего не найдено`
          : "Ничего не найдено";

  return (
    <div className="mx-auto w-full max-w-lg px-2 py-8 sm:py-12">
      <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-b from-indigo-50/40 via-white/90 to-white px-5 py-7 text-center shadow-sm shadow-indigo-500/[0.08] backdrop-blur-sm sm:px-8 sm:py-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100/80 bg-white/90 shadow-sm shadow-indigo-500/[0.08]">
          <ListingSearchIcon className="h-5 w-5 text-indigo-500" />
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>

        <div className="mt-5">
          <p className="mb-2.5 text-[11px] text-indigo-400/80">Часто ищут:</p>
          <SuggestionChips onSelect={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)} />
        </div>

        <div className="mt-5 flex items-center justify-center gap-4">
          {variant === "filters-empty" && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Сбросить фильтры
            </button>
          )}
          <Link
            href="/"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
