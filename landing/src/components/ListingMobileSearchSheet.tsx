"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ListingSearchField } from "./ListingSearchField";
import { ListingChromeButton, ListingFilterIcon } from "./ListingChromeButton";
import type { SearchMobileRegistration } from "@/context/ListingMobileChromeContext";

type Props = {
  open: boolean;
  onClose: () => void;
  search: SearchMobileRegistration;
  filterOpen: (() => void) | null;
  filterActiveCount: number;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function focusMobileSearchInput(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  input.focus({ preventScroll: true });
  try {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  } catch {
    // detached or unsupported input type
  }
}

export function ListingMobileSearchSheet({
  open,
  onClose,
  search,
  filterOpen,
  filterActiveCount,
  inputRef: inputRefProp,
}: Props) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = inputRefProp ?? localInputRef;

  useLayoutEffect(() => {
    if (!open) return;
    focusMobileSearchInput(inputRef.current);
    const raf = requestAnimationFrame(() => focusMobileSearchInput(inputRef.current));
    const t1 = window.setTimeout(() => focusMobileSearchInput(inputRef.current), 50);
    const t2 = window.setTimeout(() => focusMobileSearchInput(inputRef.current), 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, inputRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    search.onKeyDown(e);
    if (e.key === "Enter" || e.key === "Escape") {
      onClose();
    }
  };

  return createPortal(
    <div
      className="listing-mobile-search-sheet fixed inset-0 z-[100] flex flex-col lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Поиск"
    >
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]"
        aria-label="Закрыть поиск"
        onClick={onClose}
      />

      <div className="relative z-10 border-b border-indigo-100/80 bg-white/95 px-3 pb-3 pt-[max(0.625rem,env(safe-area-inset-top))] shadow-lg shadow-indigo-500/[0.06] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Назад"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <ListingSearchField
            className="min-w-0 flex-1"
            size="compact"
            accent="compact"
            value={search.value}
            onChange={search.onChange}
            onClear={search.onClear}
            onKeyDown={handleKeyDown}
            placeholder={search.placeholder}
            inputRef={inputRef}
            loading={search.loading}
            enterKeyHint="search"
            inputMode="search"
            mobileSearch
            autoFocus
          />

          {filterOpen && (
            <ListingChromeButton
              variant="icon-md"
              active={filterActiveCount > 0}
              onClick={() => {
                filterOpen();
                onClose();
              }}
              aria-label={
                filterActiveCount > 0
                  ? `Фильтры (${filterActiveCount})`
                  : "Фильтры"
              }
            >
              {filterActiveCount > 0 ? (
                <span className="text-sm font-semibold tabular-nums">{filterActiveCount}</span>
              ) : (
                <ListingFilterIcon />
              )}
            </ListingChromeButton>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
