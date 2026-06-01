"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { ListingSearchField } from "./ListingSearchField";
import { SEARCH_PLACEHOLDERS, SEARCH_SUGGESTIONS } from "@/lib/search-suggestions";

const MIN_QUERY = 2;

const PLACEHOLDERS = SEARCH_PLACEHOLDERS;

type Variant = keyof typeof PLACEHOLDERS;

type Props = {
  variant?: Variant;
  className?: string;
  autoFocus?: boolean;
};

function ListingSearchHero({ className = "", autoFocus }: Omit<Props, "variant">) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const navigateToSearch = useCallback(() => {
    const q = query.trim();
    if (q.length >= MIN_QUERY) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }, [query, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateToSearch();
      }
    },
    [navigateToSearch],
  );

  return (
    <div className={`mx-auto w-full max-w-2xl ${className}`}>
      <ListingSearchField
        value={query}
        onChange={setQuery}
        onClear={() => setQuery("")}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDERS.hero}
        size="hero"
        accent="hero"
        loading={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
      />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-0.5 text-[11px] text-indigo-400/80">Часто ищут:</span>
        {SEARCH_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => router.push(`/search?q=${encodeURIComponent(s)}`)}
            className="rounded-full border border-indigo-100/90 bg-white/80 px-3 py-1 text-[12px] font-medium text-zinc-500 shadow-sm shadow-indigo-500/[0.06] transition-all hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-700 hover:shadow-sm active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListingSearchHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const registerSearchMobile = useListingMobileChromeOptional()?.registerSearchMobile;
  const openMobileSearch = useListingMobileChromeOptional()?.openMobileSearch;

  const onSearchPage = pathname.startsWith("/search");
  const urlQuery = onSearchPage ? (searchParams.get("q")?.trim() ?? "") : "";
  const hideBottomBar = pathname === "/" || pathname.startsWith("/p/");

  const [query, setQuery] = useState(urlQuery);
  const barInputRef = useRef<HTMLInputElement>(null);
  const handleChangeRef = useRef<(value: string) => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});
  const handleKeyDownRef = useRef<(e: React.KeyboardEvent<HTMLInputElement>) => void>(() => {});
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    if (!onSearchPage) return;
    if (urlQuery === queryRef.current) return;
    setQuery(urlQuery);
  }, [onSearchPage, urlQuery]);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    if (onSearchPage) {
      router.replace("/search", { scroll: false });
    }
  }, [onSearchPage, router]);

  const navigateToSearch = useCallback(() => {
    const q = query.trim();
    if (q.length >= MIN_QUERY) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }, [query, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateToSearch();
      }
      if (e.key === "Escape") {
        barInputRef.current?.blur();
      }
    },
    [navigateToSearch],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (window.matchMedia("(max-width: 1023px)").matches) {
          openMobileSearch?.();
        } else {
          barInputRef.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openMobileSearch]);

  handleChangeRef.current = handleChange;
  handleClearRef.current = handleClear;
  handleKeyDownRef.current = handleKeyDown;

  useEffect(() => {
    if (!registerSearchMobile) return;

    registerSearchMobile({
      hideMobileBar: hideBottomBar,
      value: query,
      onChange: (value) => handleChangeRef.current(value),
      onClear: () => handleClearRef.current(),
      onKeyDown: (e) => handleKeyDownRef.current(e),
      onFocus: () => {},
      placeholder: PLACEHOLDERS.header,
      inputRef: barInputRef,
      loading: false,
    });
  }, [registerSearchMobile, hideBottomBar, query]);

  useEffect(() => {
    if (!registerSearchMobile) return;
    return () => registerSearchMobile(null);
  }, [registerSearchMobile]);

  return null;
}

export function ListingSearch({ variant = "header", className = "", autoFocus }: Props) {
  if (variant === "hero") {
    return <ListingSearchHero className={className} autoFocus={autoFocus} />;
  }
  return <ListingSearchHeader />;
}

/** @deprecated Use ListingSearch variant="header" */
export function SearchBar() {
  return <ListingSearch variant="header" />;
}
