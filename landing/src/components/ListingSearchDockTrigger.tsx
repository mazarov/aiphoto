"use client";

import { ListingSearchIcon } from "./ListingSearchField";

type Props = {
  value: string;
  placeholder: string;
  onOpen: () => void;
  onClear?: () => void;
  className?: string;
};

export function ListingSearchDockTrigger({
  value,
  placeholder,
  onOpen,
  onClear,
  className = "",
}: Props) {
  const hasValue = value.length > 0;

  return (
    <div className={`listing-search-compact-shell relative min-w-0 flex-1 rounded-xl ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-indigo-500">
        <ListingSearchIcon className="h-[18px] w-[18px]" />
      </span>
      <button
        type="button"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="listing-search-input relative w-full rounded-xl border border-indigo-200/70 bg-white/82 py-2.5 pl-10 text-left text-[16px] text-zinc-900 shadow-sm shadow-indigo-500/[0.08] backdrop-blur-xl transition-[background,border-color,color] focus:border-indigo-200/70 focus:bg-white focus:outline-none focus:ring-0"
      >
        <span className={hasValue ? "block truncate text-zinc-900" : "block truncate text-indigo-400/70"}>
          {hasValue ? value : placeholder}
        </span>
      </button>
      {hasValue && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Очистить"
          className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-900/[0.06] hover:text-zinc-600 active:bg-zinc-900/10"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
