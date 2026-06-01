"use client";

import { useLayoutEffect, useRef, type ChangeEvent, type KeyboardEvent, type RefObject, type ReactNode } from "react";

export function ListingSearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

const SIZE_STYLES = {
  header: {
    field: "py-2.5 pl-11 text-[15px] sm:text-sm",
    icon: "left-3.5",
    iconSize: "h-4 w-4",
    rounded: "rounded-2xl",
  },
  compact: {
    field: "py-2.5 pl-10 text-[16px]",
    icon: "left-3",
    iconSize: "h-[18px] w-[18px]",
    rounded: "rounded-xl",
  },
  hero: {
    field: "py-3.5 pl-12 text-base sm:text-[17px]",
    icon: "left-4",
    iconSize: "h-[18px] w-[18px]",
    rounded: "rounded-[calc(1.25rem-1px)]",
  },
} as const;

const ACCENT_STYLES = {
  default: {
    shell: "",
    field:
      "listing-search-input border border-white/60 bg-white/55 text-zinc-900 placeholder:text-zinc-500 shadow-sm shadow-zinc-900/[0.04] backdrop-blur-xl backdrop-saturate-150 transition-[background,box-shadow,border-color] focus:border-white/80 focus:bg-white/75 focus:outline-none focus:ring-0 focus:shadow-md focus:shadow-zinc-900/[0.06]",
    icon: "text-zinc-500",
  },
  hero: {
    shell:
      "listing-search-hero-shell rounded-[1.25rem] p-px animate-pulse-glow transition-[box-shadow,transform] focus-within:scale-[1.005]",
    field:
      "listing-search-input border-0 bg-white/92 text-zinc-900 placeholder:text-indigo-400/75 placeholder:font-normal shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-[background,color] focus:border-0 focus:bg-white focus:text-zinc-900 focus:outline-none focus:ring-0 focus:shadow-none",
    icon: "text-indigo-500",
  },
  compact: {
    shell: "listing-search-compact-shell rounded-xl transition-[box-shadow]",
    field:
      "listing-search-input border border-indigo-200/70 bg-white/82 text-zinc-900 placeholder:text-indigo-400/70 placeholder:font-normal shadow-sm shadow-indigo-500/[0.08] backdrop-blur-xl transition-[background,border-color,color] focus:border-indigo-200/70 focus:bg-white focus:text-zinc-900 focus:outline-none focus:ring-0 focus:shadow-none",
    icon: "text-indigo-500",
  },
} as const;

function ListingSearchClearIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  size?: keyof typeof SIZE_STYLES;
  accent?: keyof typeof ACCENT_STYLES;
  loading?: boolean;
  rightSlot?: ReactNode;
  enterKeyHint?: "search" | "done";
  autoComplete?: string;
  autoFocus?: boolean;
  className?: string;
};

export function ListingSearchField({
  value,
  onChange,
  onClear,
  onKeyDown,
  onFocus,
  placeholder,
  inputRef,
  size = "header",
  accent = "default",
  loading = false,
  rightSlot,
  enterKeyHint,
  autoComplete = "off",
  autoFocus,
  className = "",
}: Props) {
  const styles = SIZE_STYLES[size];
  const accentStyles = ACCENT_STYLES[accent];
  const showClear = value.length > 0 && !loading;
  const hasTrailing = loading || rightSlot || showClear;
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  let paddingRight = size === "header" ? "pr-4" : "pr-3";
  if (hasTrailing) {
    if (rightSlot && showClear) paddingRight = "pr-[6.75rem]";
    else if (rightSlot) paddingRight = "pr-[5.5rem]";
    else if (showClear && loading) paddingRight = "pr-[4.25rem]";
    else if (showClear) paddingRight = size === "header" ? "pr-10" : "pr-10";
    else paddingRight = size === "header" ? "pr-10" : "pr-10";
  }

  const spinner = (
    <span className="block h-4 w-4 animate-spin rounded-full border-[2px] border-zinc-200/80 border-t-zinc-500" />
  );

  const handleClear = () => {
    if (onClear) onClear();
    else onChange("");
    inputRef?.current?.focus();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    pendingSelectionRef.current = {
      start: e.target.selectionStart ?? e.target.value.length,
      end: e.target.selectionEnd ?? e.target.value.length,
    };
    onChange(e.target.value);
  };

  useLayoutEffect(() => {
    const input = inputRef?.current;
    const pending = pendingSelectionRef.current;
    if (!input || !pending) return;
    pendingSelectionRef.current = null;
    try {
      input.setSelectionRange(pending.start, pending.end);
    } catch {
      // input may be detached during unmount
    }
  }, [value, inputRef]);

  return (
    <div className={`relative ${accentStyles.shell} ${className}`}>
      <span
        className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 ${accentStyles.icon} ${styles.icon}`}
      >
        <ListingSearchIcon className={styles.iconSize} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        enterKeyHint={enterKeyHint}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        autoCorrect="off"
        className={`relative w-full ${accentStyles.field} ${styles.rounded} ${styles.field} ${paddingRight}`}
      />
      {hasTrailing && (
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {showClear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              aria-label="Очистить"
              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-900/[0.06] hover:text-zinc-600 active:bg-zinc-900/10"
            >
              <ListingSearchClearIcon />
            </button>
          )}
          {loading ? spinner : rightSlot}
        </span>
      )}
    </div>
  );
}
