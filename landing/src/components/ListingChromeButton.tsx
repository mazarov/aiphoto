"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Semi-transparent glass surface — search field, chrome buttons, Foto-v-promt banner. */
export const LISTING_CHROME_SURFACE =
  "border border-indigo-200/70 bg-white/82 shadow-sm shadow-indigo-500/[0.08] backdrop-blur-xl transition-[background,border-color,box-shadow] hover:border-indigo-200 hover:bg-white/90";

const SHELL =
  `listing-chrome-btn inline-flex shrink-0 items-center justify-center font-inherit active:bg-white focus:outline-none focus:ring-0 ${LISTING_CHROME_SURFACE}`;

const VARIANTS = {
  "icon-sm": "h-10 w-10 rounded-xl text-indigo-500",
  "icon-md": "h-11 w-11 rounded-xl text-indigo-500",
  "icon-lg": "h-12 w-12 rounded-2xl text-indigo-500",
  pill: "h-10 rounded-xl px-3.5 text-[13px] font-medium leading-normal text-zinc-800 antialiased",
} as const;

type Variant = keyof typeof VARIANTS;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Active filters / selected state */
  active?: boolean;
  children: ReactNode;
};

export function ListingChromeButton({
  variant = "icon-md",
  active = false,
  className = "",
  children,
  ...props
}: Props) {
  const activeClass =
    active && variant !== "pill"
      ? "border-indigo-300/80 bg-indigo-50/90 text-indigo-600 shadow-indigo-500/[0.12]"
      : "";

  return (
    <button
      type="button"
      className={`${SHELL} ${VARIANTS[variant]} ${activeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function ListingFilterIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export function ListingMenuIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
