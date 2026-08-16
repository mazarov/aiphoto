"use client";

import { useState, type ReactNode } from "react";

const card = "rounded-2xl border border-zinc-200 bg-white shadow-sm";

export function AdminExpandableCard({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className={card}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-zinc-900">{title}</span>
          {summary ? <span className="mt-1 block text-sm text-zinc-500">{summary}</span> : null}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fill="currentColor"
            d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z"
          />
        </svg>
      </button>
      {open ? <div className="border-t border-zinc-100 px-5 pb-5 pt-4">{children}</div> : null}
    </section>
  );
}
