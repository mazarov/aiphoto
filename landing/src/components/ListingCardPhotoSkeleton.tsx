/**
 * Placeholder only in the **photo** band — stops above the footer/CTA so the semi-transparent
 * gradient never reveals a second “gray rectangle” under the pills (no rect → pill sequence).
 *
 * @param overlay — `true` when stacked above `next/image` (z-[3]); `false` in `ListingGridLoadingSkeleton` (z-[1], chrome stays on top).
 */
export function ListingCardPhotoSkeleton({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden rounded-t-2xl bg-zinc-300/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] [bottom:32%] ${overlay ? "z-[3]" : "z-[1]"}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,255,255,0.48),transparent_50%),linear-gradient(165deg,rgba(255,255,255,0.2)_0%,transparent_50%,rgba(0,0,0,0.03)_100%)]"
        aria-hidden
      />
      <div className="listing-card-shimmer-bar absolute inset-y-0 -left-1/2 w-[65%] skew-x-[-12deg] bg-gradient-to-r from-transparent via-white/28 to-transparent" />
    </div>
  );
}

/** Bottom strip — title lines as pills; CTA as full-width capsule (not a sharp rectangle). */
export function ListingCardChromeSkeleton() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/78 via-black/38 to-transparent pt-20 pb-3.5 px-3.5"
      aria-hidden
    >
      <div className="mb-2 h-3 w-[88%] max-w-full rounded-full bg-white/18 ring-1 ring-white/[0.08]" />
      <div className="mb-1.5 h-2.5 w-[62%] rounded-full bg-white/12" />
      <div className="mb-1 h-2.5 w-[48%] rounded-full bg-white/10" />
      <div className="mt-2.5 flex h-10 w-full items-center justify-center overflow-hidden bg-white/16 ring-1 ring-white/14 shadow-sm backdrop-blur-[2px] [border-radius:9999px]" />
    </div>
  );
}
