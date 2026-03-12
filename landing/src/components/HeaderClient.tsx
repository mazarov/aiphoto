"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { MenuSectionWithCounts, MenuGroupWithCounts, MenuItemWithCount } from "@/lib/menu";

function CountBadge({ count }: { count?: number }) {
  if (count === undefined) return null;
  return (
    <span
      className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none tabular-nums ${
        count > 0
          ? "bg-indigo-50 text-indigo-600"
          : "bg-zinc-100 text-zinc-400"
      }`}
    >
      {count}
    </span>
  );
}

function DropdownPanel({ section }: { section: MenuSectionWithCounts }) {
  return (
    <>
      {/* Invisible bridge — covers the gap between button and dropdown */}
      <div className="absolute left-0 right-0 top-full z-40 h-3" />
      <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 min-w-[320px] rounded-2xl border border-zinc-200/80 bg-white/95 p-5 shadow-2xl shadow-zinc-900/10 backdrop-blur-xl">
        <div className="flex gap-6">
          {section.groups.map((group) => (
            <div key={group.title} className="min-w-[130px]">
              <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {group.title}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      {item.label}
                      <CountBadge count={item.count} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const CLOSE_DELAY = 150;

function NavItem({ section }: { section: MenuSectionWithCounts }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  const totalCount = section.groups.reduce(
    (sum, g) => sum + g.items.reduce((s, i) => s + (i.count ?? 0), 0),
    0
  );

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
          open ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        {section.label}
        {totalCount > 0 && (
          <span className="text-[10px] tabular-nums text-zinc-400">{totalCount}</span>
        )}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <DropdownPanel section={section} />}
    </div>
  );
}

function MobileMenu({
  open,
  onClose,
  menu,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuSectionWithCounts[];
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <Link href="/" className="text-lg font-bold text-zinc-900" onClick={onClose}>
          PromptShot
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="p-4">
        <Link
          href="/"
          onClick={onClose}
          className="block rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          Главная
        </Link>
        {menu.map((section, idx) => {
          const totalCount = section.groups.reduce(
            (sum, g) => sum + g.items.reduce((s, i) => s + (i.count ?? 0), 0),
            0
          );
          return (
            <div key={section.label}>
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                <span className="flex items-center gap-2">
                  {section.label}
                  {totalCount > 0 && (
                    <span className="text-xs tabular-nums text-zinc-400">{totalCount}</span>
                  )}
                </span>
                <svg
                  className={`h-4 w-4 text-zinc-400 transition-transform ${expandedIdx === idx ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedIdx === idx && (
                <div className="mb-2 ml-4 border-l-2 border-zinc-100 pl-4">
                  {section.groups.map((group) => (
                    <div key={group.title} className="mb-3">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                        {group.title}
                      </div>
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className="flex items-center rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                        >
                          {item.label}
                          <CountBadge count={item.count} />
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function HeaderClient({ menu }: { menu: MenuSectionWithCounts[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-black text-white">P</span>
            PromptShot
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {menu.map((section) => (
              <NavItem key={section.label} section={section} />
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} menu={menu} />
    </>
  );
}
