/** Light-theme tokens for /foto-v-promt/ widget and sections. */

export const FVP_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/** Dark immersive shell (mobile soft-modal / extension-lite parity). */
export const FVP_IMMERSIVE_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]";

/** Full-width mobile action stack after prompt result (tap targets ≥ 48px). */
export const FVP_IMMERSIVE_ACTION =
  "inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 active:scale-[0.99]";

export const FVP_IMMERSIVE_ACTION_PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 active:scale-[0.99]";

export const FVP_IMMERSIVE_ACTION_BRAND =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-indigo-500 via-[#5b5cf0] to-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-[1.06] active:scale-[0.99] disabled:opacity-50";

export const FVP_BORDER_CARD = "border border-zinc-200";
export const FVP_BORDER_INPUT = "border border-zinc-200";
export const FVP_RING_INSET_SOFT = "ring-1 ring-inset ring-zinc-100";

export const FVP_SURFACE_WIDGET_OUTER = "bg-white";
export const FVP_SURFACE_WIDGET_INSET = "bg-zinc-50";
export const FVP_SURFACE_IMAGE_FRAME = "bg-zinc-100";

export const FVP_SECTION_CONTAINER = "mx-auto max-w-6xl px-4 sm:px-6";
export const FVP_SECTION_PY = "py-12 sm:py-14";
export const FVP_SECTION_TITLE =
  "text-center text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl text-balance";
export const FVP_SECTION_SUBTITLE = "mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600 sm:text-base";

export const FVP_VISUAL_SHELL =
  "rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-white to-white p-6 shadow-sm sm:p-8";
