"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { uniqueListingChipsByHref } from "@/lib/listing-cluster-chips";

export type ListingClusterChipItem = {
  label: string;
  href: string;
  active?: boolean;
  count?: number;
};

const MAX_COLLAPSED_ROWS = 3;
const CLUSTER_GAP_PX = 6; // gap-1.5
const NAV_GAP_PX = 8; // gap-2, same as /generaciya-foto chips

const NAV_CHIP =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition";
const NAV_CHIP_ACTIVE =
  "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/20";
const NAV_CHIP_IDLE =
  "border-indigo-100 bg-white/80 text-zinc-600 hover:border-indigo-300 hover:bg-white hover:text-indigo-700";
const CLUSTER_CHIP_ACTIVE =
  "border-indigo-300 bg-indigo-50 text-indigo-700";
const CLUSTER_CHIP_IDLE =
  "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700";

export function ListingClusterChipGroup({
  label,
  items,
  leading,
  showLabel = true,
  variant = "cluster",
}: {
  label: string;
  items: ListingClusterChipItem[];
  leading?: ReactNode;
  showLabel?: boolean;
  /** `nav` = same chip row as `/generaciya-foto/[scenario]`. */
  variant?: "cluster" | "nav";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsMore, setNeedsMore] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState<number | null>(
    null
  );

  useLayoutEffect(() => {
    setExpanded(false);
  }, [items]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const chip = wrap.querySelector<HTMLElement>("[data-cluster-chip]");
      if (!chip) {
        setNeedsMore(false);
        setCollapsedMaxHeight(null);
        return;
      }

      const prevMaxHeight = wrap.style.maxHeight;
      const prevOverflow = wrap.style.overflow;
      wrap.style.maxHeight = "";
      wrap.style.overflow = "visible";
      const gapPx = variant === "nav" ? NAV_GAP_PX : CLUSTER_GAP_PX;
      const maxH =
        chip.offsetHeight * MAX_COLLAPSED_ROWS +
        gapPx * (MAX_COLLAPSED_ROWS - 1);
      const overflowed = wrap.scrollHeight > maxH + 1;
      wrap.style.maxHeight = prevMaxHeight;
      wrap.style.overflow = prevOverflow;
      setNeedsMore(overflowed);
      setCollapsedMaxHeight(overflowed ? maxH : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [items, expanded, variant]);

  const uniqueItems = uniqueListingChipsByHref(items);
  if (uniqueItems.length === 0 && !leading) return null;

  const clipped = !expanded && collapsedMaxHeight != null;
  const isNav = variant === "nav";

  return (
    <div>
      {showLabel && label ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
          {label}
        </p>
      ) : null}
      <div
        ref={wrapRef}
        className={`relative flex flex-wrap ${isNav ? "gap-2" : "gap-1.5"}${clipped ? " overflow-hidden" : ""}`}
        style={clipped ? { maxHeight: collapsedMaxHeight } : undefined}
      >
        {leading}
        {uniqueItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            data-cluster-chip=""
            aria-current={item.active ? "page" : undefined}
            className={
              isNav
                ? `${NAV_CHIP} ${item.active ? NAV_CHIP_ACTIVE : NAV_CHIP_IDLE}`
                : `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    item.active ? CLUSTER_CHIP_ACTIVE : CLUSTER_CHIP_IDLE
                  }`
            }
          >
            {item.label}
            {item.count != null && item.count > 0 ? (
              <span className="text-xs tabular-nums text-zinc-500">
                {item.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      {needsMore ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        >
          {expanded ? "Свернуть" : "Ещё"}
        </button>
      ) : null}
    </div>
  );
}
