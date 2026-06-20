/**
 * Listing filter UI — aligned with ListingChromeButton, ListingSearchField, L2 chips.
 * @see ListingChromeButton LISTING_CHROME_SURFACE
 * @see SearchEmptyState SuggestionChips
 */

/** Same frost as search field / chrome buttons. */
export const FILTER_CHROME_SURFACE =
  "border border-indigo-200/70 bg-white/82 shadow-sm shadow-indigo-500/[0.08] backdrop-blur-xl";

export const FILTER_TRIGGER =
  `inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium text-zinc-700 transition-[background,border-color,box-shadow,color] ${FILTER_CHROME_SURFACE} hover:border-indigo-200 hover:bg-white/90`;

export const FILTER_TRIGGER_ACTIVE =
  "border-indigo-300/80 bg-indigo-50/90 text-indigo-700 shadow-indigo-500/[0.12]";

export const FILTER_CHIP =
  "inline-flex items-center gap-1 rounded-full border border-indigo-100/90 bg-white/80 px-3 py-1.5 text-sm font-medium text-zinc-600 shadow-sm shadow-indigo-500/[0.06] transition-all hover:border-indigo-200 hover:bg-indigo-50/70 hover:text-indigo-700 active:scale-[0.98] whitespace-nowrap";

export const FILTER_CHIP_SELECTED =
  "inline-flex items-center gap-1 rounded-full border border-indigo-300/80 bg-indigo-50/90 px-3 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm shadow-indigo-500/[0.1] whitespace-nowrap";

export const FILTER_CHIP_COUNT = "text-xs font-normal tabular-nums text-indigo-400/90";

export const FILTER_MODAL_BACKDROP = "bg-zinc-900/30 backdrop-blur-[2px]";

export const FILTER_MODAL_SHELL =
  "flex flex-col overflow-hidden rounded-2xl border border-indigo-100/80 bg-white/95 shadow-2xl shadow-indigo-500/[0.12] backdrop-blur-xl";

export const FILTER_MODAL_HEADER =
  "flex shrink-0 items-center justify-between border-b border-indigo-100/60 bg-white/90 px-4 py-3";

export const FILTER_MODAL_BODY =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]";

export const FILTER_MODAL_FOOTER =
  "shrink-0 border-t border-indigo-100/60 bg-white/90 px-4 py-3";

export const FILTER_SECTION_LABEL =
  "mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500";

export const FILTER_SEARCH_INPUT =
  "w-full rounded-xl border border-indigo-100/90 bg-white/82 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-indigo-400/70 shadow-sm shadow-indigo-500/[0.06] backdrop-blur-xl transition-[background,border-color,box-shadow] focus:border-indigo-200/90 focus:bg-white focus:outline-none focus:ring-0 focus:shadow-md focus:shadow-indigo-500/[0.08]";

export const FILTER_PRIMARY_BTN =
  "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-[background,transform] hover:bg-indigo-700 active:scale-[0.98]";

export const FILTER_SECONDARY_BTN =
  `flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition-[background,border-color,color] ${FILTER_CHROME_SURFACE} hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700`;

export const FILTER_RESET_LINK =
  "text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700";

export const FILTER_ICON_BTN =
  "rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-indigo-50/80 hover:text-indigo-600";
