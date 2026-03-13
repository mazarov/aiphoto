"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (q.length >= 2) {
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }
    },
    [query, router]
  );

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти промт — например, «портрет» или «на море»"
          enterKeyHint="search"
          className="w-full rounded-2xl border border-zinc-200/80 bg-white/80 py-3.5 pl-12 pr-4 text-[16px] text-zinc-700 shadow-sm shadow-zinc-900/5 backdrop-blur-sm placeholder:text-zinc-400 transition-all focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:shadow-md sm:text-sm sm:py-3"
        />
      </div>
    </form>
  );
}
