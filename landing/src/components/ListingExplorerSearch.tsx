"use client";

import { useState, type ReactNode, type Ref } from "react";
import { LISTING_EXPLORER_SEARCH_SHELL_CLASS } from "@/lib/listing-explorer";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  loading?: boolean;
  label?: string;
  autoFocus?: boolean;
  sentinelRef?: Ref<HTMLDivElement>;
};

export function ListingExplorerSearch({
  id,
  value,
  onChange,
  onClear,
  onSubmit,
  placeholder = "Найти промт, стиль или сюжет",
  loading = false,
  label = "Найти промт для фото",
  autoFocus = false,
  sentinelRef,
}: Props) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div ref={sentinelRef} className={LISTING_EXPLORER_SEARCH_SHELL_CLASS}>
        <ListingExplorerSearchIcon />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onSubmit?.();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-zinc-900 outline-none placeholder:text-zinc-400 sm:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          inputMode="search"
          autoFocus={autoFocus}
        />
        {loading ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-500"
            aria-label="Ищем"
          />
        ) : value ? (
          <button
            type="button"
            onClick={onClear}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-indigo-50 hover:text-indigo-700"
            aria-label="Очистить поиск"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        ) : null}
      </div>
    </>
  );
}

function ListingExplorerSearchIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-zinc-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ListingExplorerHeading({
  eyebrow,
  title,
  titleAs = "h2",
  titleId,
  intro,
  introSecondary,
  countBadge,
  collapseIntroOnMobile = false,
  afterIntro,
}: {
  eyebrow?: string;
  title: string;
  titleAs?: "h1" | "h2";
  titleId?: string;
  intro?: string;
  introSecondary?: string;
  countBadge?: ReactNode;
  collapseIntroOnMobile?: boolean;
  afterIntro?: ReactNode;
}) {
  const TitleTag = titleAs;
  const [introExpanded, setIntroExpanded] = useState(false);
  const introId = titleId ? `${titleId}-intro` : undefined;
  return (
    <div className="w-full">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          {eyebrow}
        </p>
      ) : null}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${eyebrow ? "mt-2" : ""}`}>
        <TitleTag
          id={titleId}
          className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
        >
          {title}
        </TitleTag>
        {countBadge}
      </div>
      {intro ? (
        <>
          <p
            id={introId}
            className={`mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base ${
              collapseIntroOnMobile && !introExpanded
                ? "line-clamp-2 sm:line-clamp-none"
                : ""
            }`}
          >
            {intro}
          </p>
          {collapseIntroOnMobile ? (
            <button
              type="button"
              aria-expanded={introExpanded}
              aria-controls={introId}
              onClick={() => setIntroExpanded((current) => !current)}
              className="mt-1 inline-flex min-h-9 items-center text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 sm:hidden"
            >
              {introExpanded ? "Свернуть" : "Подробнее"}
            </button>
          ) : null}
        </>
      ) : null}
      {introSecondary ? (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
          {introSecondary}
        </p>
      ) : null}
      {afterIntro ? <div className="mt-4">{afterIntro}</div> : null}
    </div>
  );
}
