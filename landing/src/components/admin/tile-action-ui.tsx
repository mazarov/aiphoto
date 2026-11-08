/** Pointer devices reveal the control on hover; touch always shows it. */
export const REVEAL_ON_HOVER =
  "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 focus-visible:opacity-100";

export const TILE_BUTTON =
  "pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold shadow-md ring-1 backdrop-blur-md transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:scale-95 disabled:cursor-not-allowed";

const ICON = "h-4 w-4 shrink-0";

export function PlusIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.5 8 3.1 10.2 2.5 12c1 2.5 4.5 7 9.5 7 1.9 0 3.5-.6 4.9-1.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  );
}

export function SpinnerIcon() {
  return (
    <svg className={`${ICON} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Admin controls stack in the tile's top-right corner; gaps keep the card link clickable. */
export const TILE_ACTIONS =
  "pointer-events-none absolute right-2 top-2 z-40 flex flex-col items-end gap-1.5";
