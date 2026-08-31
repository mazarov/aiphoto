import { PHOTOSHOOT_CTA_LABEL } from "@/lib/photoshoot";

/** Compact label, not a 44px action pill — sits on the 2×2 without covering a tile. */
export function PhotoshootListingBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold leading-none text-white backdrop-blur-md ${
        className || "bottom-1.5"
      }`.trim()}
    >
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="2.5" y="2.5" width="8" height="8" rx="1.75" />
        <rect x="13.5" y="2.5" width="8" height="8" rx="1.75" />
        <rect x="2.5" y="13.5" width="8" height="8" rx="1.75" />
        <rect x="13.5" y="13.5" width="8" height="8" rx="1.75" />
      </svg>
      {PHOTOSHOOT_CTA_LABEL}
    </span>
  );
}
