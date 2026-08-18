"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export type ListingClusterChipItem = {
  label: string;
  href: string;
  active?: boolean;
  count?: number;
};

const MAX_COLLAPSED_ROWS = 3;
const GAP_PX = 6; // gap-1.5

export function ListingClusterChipGroup({
  label,
  items,
}: {
  label: string;
  items: ListingClusterChipItem[];
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
      const maxH =
        chip.offsetHeight * MAX_COLLAPSED_ROWS +
        GAP_PX * (MAX_COLLAPSED_ROWS - 1);
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
  }, [items, expanded]);

  if (items.length === 0) return null;

  const clipped = !expanded && collapsedMaxHeight != null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <div
        ref={wrapRef}
        className={`relative flex flex-wrap gap-1.5${clipped ? " overflow-hidden" : ""}`}
        style={clipped ? { maxHeight: collapsedMaxHeight } : undefined}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            data-cluster-chip=""
            aria-current={item.active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              item.active
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
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
