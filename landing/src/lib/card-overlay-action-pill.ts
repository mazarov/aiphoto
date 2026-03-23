/**
 * Strip UA `<button>` chrome (Safari/WebKit often paints a square briefly before `rounded-*`).
 * Use with `rounded-*` on overlay controls. Does not set `border-width` — safe with `border border-*`.
 */
export const OVERLAY_BUTTON_APPEARANCE_RESET = "appearance-none shadow-none";

/**
 * Full reset including `border-0` — use on pills/icon circles **without** a custom border.
 */
export const OVERLAY_BUTTON_UA_RESET = "appearance-none border-0 shadow-none";

/**
 * Chip for action buttons on dark photo hero — same glass as tag pills on the card
 * (`CardPageClient`: `bg-black/15`, `hover:bg-black/25`, `backdrop-blur-md`).
 */
/** `transform-gpu` + explicit radius hint — reduces WebKit’s square flash before `rounded-full` paints. */
export const CARD_OVERLAY_ACTION_PILL =
  "inline-flex h-7 shrink-0 items-center justify-center gap-1 appearance-none rounded-full border-0 bg-black/15 px-2 leading-none shadow-none backdrop-blur-md transition-colors hover:bg-black/25 transform-gpu overflow-hidden [border-radius:9999px]";
