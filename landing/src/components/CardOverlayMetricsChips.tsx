import { formatCompactCount } from "@/lib/format-view-count";
import { CARD_OVERLAY_ACTION_PILL } from "@/lib/card-overlay-action-pill";

/** Same glass pill as like/dislike/favorite (`CARD_OVERLAY_ACTION_PILL`); non-interactive. */
const VIEWS_CHIP = `${CARD_OVERLAY_ACTION_PILL} min-w-[2.75rem] text-[10px] font-medium text-white/90 tabular-nums`;

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type Props = {
  viewCount: number;
};

/** Top-right: view count only. Omitted when `viewCount === 0`. */
export function CardOverlayMetricsChips({ viewCount }: Props) {
  if (viewCount <= 0) return null;

  return (
    <div className="pointer-events-none flex justify-end">
      <span
        role="img"
        className={VIEWS_CHIP}
        aria-label={`${formatCompactCount(viewCount)} просмотров`}
      >
        <EyeIcon className="shrink-0 text-white/70" />
        <span aria-hidden>{formatCompactCount(viewCount)}</span>
      </span>
    </div>
  );
}
