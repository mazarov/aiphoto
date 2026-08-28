import { CARD_OVERLAY_ACTION_PILL } from "@/lib/card-overlay-action-pill";
import { PHOTOSHOOT_CTA_LABEL } from "@/lib/photoshoot";

/** Same glass pill as «Оживить» / photo counter. Bottom-center, clicks pass through. */
export function PhotoshootListingBadge() {
  return (
    <span
      className={`pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 ${CARD_OVERLAY_ACTION_PILL} px-3.5 text-[13px] font-semibold text-white`}
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="2.5" y="2.5" width="8" height="8" rx="1.75" />
        <rect x="13.5" y="2.5" width="8" height="8" rx="1.75" />
        <rect x="2.5" y="13.5" width="8" height="8" rx="1.75" />
        <rect x="13.5" y="13.5" width="8" height="8" rx="1.75" />
      </svg>
      {PHOTOSHOOT_CTA_LABEL}
    </span>
  );
}
