"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuSectionWithCounts } from "@/lib/menu";

function enrichMenuWithCounts(
  menu: MenuSectionWithCounts[],
  counts: Record<string, number>,
): MenuSectionWithCounts[] {
  if (Object.keys(counts).length === 0) return menu;
  return menu.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        count: counts[item.href] ?? item.count ?? 0,
      })),
    })),
  }));
}

const EXPANDED_SECTION_STORAGE_KEY = "sidebar_expanded_section_idx";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function isHrefActive(href: string, pathname: string): boolean {
  const pn = normalizePath(pathname);
  const hn = normalizePath(href);
  return pn === hn || pn.startsWith(`${hn}/`);
}

function getActiveSectionIdx(menu: MenuSectionWithCounts[], pathname: string): number {
  return menu.findIndex((s) =>
    s.groups.some((g) => g.items.some((i) => isHrefActive(i.href, pathname)))
  );
}

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto tabular-nums text-[11px] text-zinc-400">
      {count}
    </span>
  );
}

function SidebarContent({
  menu,
  pathname,
  expandedIdx,
  onToggle,
  onItemClick,
}: {
  menu: MenuSectionWithCounts[];
  pathname: string;
  expandedIdx: number | null;
  onToggle: (idx: number) => void;
  onItemClick?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      <Link
        href="/"
        onClick={onItemClick}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
          pathname === "/"
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Главная
      </Link>

      <div className="my-2 h-px bg-zinc-100" />

      {menu.map((section, idx) => {
        const isExpanded = expandedIdx === idx;
        const sectionActive = section.groups.some((g) =>
          g.items.some((i) => isHrefActive(i.href, pathname))
        );
        const total = section.groups.reduce(
          (sum, g) => sum + g.items.reduce((s, i) => s + (i.count ?? 0), 0),
          0,
        );

        return (
          <div key={section.label}>
            <button
              type="button"
              onClick={() => onToggle(idx)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                sectionActive
                  ? "bg-indigo-50 text-indigo-700"
                  : isExpanded
                    ? "bg-zinc-50 text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <span className="flex-1 text-left">{section.label}</span>
              {total > 0 && (
                <span className={`tabular-nums text-[11px] ${sectionActive ? "text-indigo-400" : "text-zinc-400"}`}>
                  {total}
                </span>
              )}
              <svg
                className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""} ${sectionActive ? "text-indigo-400" : "text-zinc-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="ml-2 border-l-2 border-zinc-100 pl-2 pb-1">
                {section.groups.map((group) => (
                  <div key={group.title} className="mt-1.5">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const active = isHrefActive(item.href, pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onItemClick}
                          className={`flex items-center rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                            active
                              ? "bg-indigo-50 font-medium text-indigo-700"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                          }`}
                        >
                          <span className="flex-1 truncate">{item.label}</span>
                          <CountBadge count={item.count} />
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function SidebarNav({ menu }: { menu: MenuSectionWithCounts[] }) {
  const pathname = usePathname();
  const normalizedPath = normalizePath(pathname || "/");

  const [counts, setCounts] = useState<Record<string, number>>({});
  const enrichedMenu = useMemo(() => enrichMenuWithCounts(menu, counts), [menu, counts]);
  const activeIdx = getActiveSectionIdx(enrichedMenu, normalizedPath);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/menu-counts")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, number>) => {
        if (!cancelled) setCounts(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(() => {
    if (activeIdx >= 0) return activeIdx;
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(EXPANDED_SECTION_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= menu.length) return null;
    return parsed;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (activeIdx >= 0) setExpandedIdx(activeIdx);
  }, [activeIdx]);

  useEffect(() => {
    if (expandedIdx === null) {
      window.localStorage.removeItem(EXPANDED_SECTION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(EXPANDED_SECTION_STORAGE_KEY, String(expandedIdx));
  }, [expandedIdx]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  const handleToggle = useCallback((idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 lg:block">
        <div className="sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto border-r border-zinc-100 bg-white">
          <SidebarContent
            menu={enrichedMenu}
            pathname={normalizedPath}
            expandedIdx={expandedIdx}
            onToggle={handleToggle}
          />
        </div>
      </aside>

      {/* Mobile FAB + overlay via portal */}
      {mounted && createPortal(
        <>
          {!mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="fixed bottom-20 left-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-all hover:bg-zinc-800 active:scale-95 sm:bottom-6 sm:left-6 lg:hidden"
              aria-label="Каталог"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {mobileOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
              <div className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <span className="text-sm font-semibold text-zinc-900">Каталог</span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  <SidebarContent
                    menu={enrichedMenu}
                    pathname={normalizedPath}
                    expandedIdx={expandedIdx}
                    onToggle={handleToggle}
                    onItemClick={() => setMobileOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
