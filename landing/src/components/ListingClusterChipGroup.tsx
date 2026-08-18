"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

export type ListingClusterChipItem = {
  label: string;
  href: string;
  active?: boolean;
};

const MAX_COLLAPSED_ROWS = 3;

export function ListingClusterChipGroup({
  label,
  items,
}: {
  label: string;
  items: ListingClusterChipItem[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState<number | null>(
    null
  );

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const chips = [
        ...wrap.querySelectorAll<HTMLElement>("[data-cluster-chip]"),
      ];
      if (chips.length === 0) {
        setCollapsedMaxHeight(null);
        return;
      }

      const rowTops = [
        ...new Set(chips.map((chip) => Math.round(chip.offsetTop))),
      ].sort((a, b) => a - b);

      if (rowTops.length <= MAX_COLLAPSED_ROWS) {
        setCollapsedMaxHeight(null);
        return;
      }

      const thirdRowTop = rowTops[MAX_COLLAPSED_ROWS - 1];
      const thirdRowBottom = Math.max(
        ...chips
          .filter((chip) => Math.round(chip.offsetTop) === thirdRowTop)
          .map((chip) => chip.offsetTop + chip.offsetHeight)
      );
      setCollapsedMaxHeight(thirdRowBottom);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  const clipped = !expanded && collapsedMaxHeight != null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <div
        ref={wrapRef}
        className="flex flex-wrap gap-1.5"
        style={
          clipped
            ? { maxHeight: collapsedMaxHeight, overflow: "hidden" }
            : undefined
        }
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            data-cluster-chip=""
            aria-current={item.active ? "page" : undefined}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
              item.active
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {collapsedMaxHeight != null ? (
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
