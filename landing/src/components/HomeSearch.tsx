"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  "портрет", "чёрно-белое", "GTA", "на море", "аниме", "с котом", "3D",
];

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(
    (q: string) => {
      if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
    },
    [router]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigate(query.trim());
    },
    [query, navigate]
  );

  return (
    <div className="mx-auto w-full max-w-xl">
      <form onSubmit={handleSubmit}>
        <div className="group relative">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-indigo-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти промт — например, «портрет» или «на море»"
            enterKeyHint="search"
            className="w-full rounded-2xl border border-zinc-200/80 bg-white py-3.5 pl-12 pr-4 text-[16px] text-zinc-700 shadow-sm shadow-zinc-900/[0.03] ring-1 ring-transparent placeholder:text-zinc-400 transition-all duration-200 focus:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:shadow-lg focus:shadow-indigo-500/5 sm:py-3.5 sm:text-[15px]"
          />
        </div>
      </form>

      {/* Quick suggestion pills */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-[11px] text-zinc-400 mr-0.5">Популярное:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => navigate(s)}
            className="rounded-full border border-zinc-150 bg-zinc-50/80 px-3 py-1 text-[12px] font-medium text-zinc-500 transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-700 hover:shadow-sm active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
