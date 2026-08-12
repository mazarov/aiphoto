"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import { markGenerateEntrySource } from "@/context/GenerateMobileModalContext";
import type { MenuSectionWithCounts } from "@/lib/menu";
import { getAiImageDescriberChromeUrl } from "@/lib/foto-v-promt-config";
import { trackDesktopSidebarAddToChromeClick } from "@/lib/yandex-metrika";
import { isSameNavPath, scrollCatalogToTop } from "@/lib/scroll-preservation";
import { ChromeMark } from "./foto-v-promt/ChromeMark";
import { SidebarAccountPanel } from "./AccountControls";

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
  showGenerateCta,
}: {
  menu: MenuSectionWithCounts[];
  pathname: string;
  expandedIdx: number | null;
  onToggle: (idx: number) => void;
  onItemClick?: () => void;
  showGenerateCta: boolean;
}) {
  const generateActive = isHrefActive("/generate", pathname);

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4">
      <a
        href={getAiImageDescriberChromeUrl("desktop_sidebar")}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackDesktopSidebarAddToChromeClick();
          onItemClick?.();
        }}
        className="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <ChromeMark className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-zinc-900">
            Добавить в Chrome
          </span>
          <span className="mt-0.5 block text-xs font-normal leading-snug text-zinc-500 line-clamp-2">
            Преврати фото с любого сайта в готовый промт
          </span>
        </span>
      </a>

      {showGenerateCta ? (
        <Link
          href="/generate"
          scroll={false}
          onClick={() => {
            markGenerateEntrySource("sidebar");
            onItemClick?.();
          }}
          className={`mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-indigo-500/25 transition ${
            generateActive
              ? "bg-indigo-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
            />
          </svg>
          Генерация фото
        </Link>
      ) : null}

      <Link
        href="/"
        scroll={false}
        onClick={(e) => {
          onItemClick?.();
          if (isSameNavPath(pathname, "/")) {
            e.preventDefault();
            scrollCatalogToTop();
          }
        }}
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

      <Link
        href="/trends"
        scroll={false}
        onClick={(e) => {
          onItemClick?.();
          if (isSameNavPath(pathname, "/trends")) {
            e.preventDefault();
            scrollCatalogToTop();
          }
        }}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
          isHrefActive("/trends", pathname)
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.5 14.5l.75 2.25L21.5 17.5l-2.25.75L18.5 20.5l-.75-2.25L15.5 17.5l2.25-.75.75-2.25z"
          />
        </svg>
        Тренды
      </Link>

      {showGenerateCta ? (
        <Link
          href="/generaciya-foto"
          scroll={false}
          onClick={onItemClick}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
            isHrefActive("/generaciya-foto", pathname)
              ? "bg-indigo-50 text-indigo-700"
              : "text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5 8.5 12l3 3 3-3 5.5 5.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 6 .75 2.25L18 9l-2.25.75L15 12l-.75-2.25L12 9l2.25-.75L15 6Z" />
          </svg>
          Генерация фото
        </Link>
      ) : null}

      <Link
        href="/search"
        scroll={false}
        onClick={onItemClick}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
          isHrefActive("/search", pathname)
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        Поиск
      </Link>

      <Link
        href="/foto-v-promt"
        scroll={false}
        onClick={(e) => {
          onItemClick?.();
          if (isSameNavPath(pathname, "/foto-v-promt")) {
            e.preventDefault();
            scrollCatalogToTop();
          }
        }}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
          isHrefActive("/foto-v-promt", pathname)
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Фото в промт
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
                          scroll={false}
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
  const registerMenu = useListingMobileChromeOptional()?.registerMenu;
  const { promptCardGenerationEnabled, loading: featureLoading } =
    useFeatureAccess();
  const showGenerateCta = !featureLoading && promptCardGenerationEnabled;
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

  const [expandedIdx, setExpandedIdx] = useState<number | null>(
    activeIdx >= 0 ? activeIdx : null,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Sync with active route; restore persisted expansion only after hydration.
  useEffect(() => {
    if (activeIdx >= 0) {
      setExpandedIdx(activeIdx);
      return;
    }
    const raw = window.localStorage.getItem(EXPANDED_SECTION_STORAGE_KEY);
    if (raw === null) return;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= menu.length) return;
    setExpandedIdx(parsed);
  }, [activeIdx, menu.length]);

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

  useEffect(() => {
    if (!registerMenu) return;
    registerMenu({ open: () => setMobileOpen(true) });
    return () => registerMenu(null);
  }, [registerMenu]);

  const handleToggle = useCallback((idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-72 flex-shrink-0 lg:block">
        <div className="sticky top-0 flex h-screen flex-col border-r border-zinc-100 bg-white">
          <SidebarAccountPanel />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SidebarContent
              menu={enrichedMenu}
              pathname={normalizedPath}
              expandedIdx={expandedIdx}
              onToggle={handleToggle}
              showGenerateCta={showGenerateCta}
            />
          </div>
        </div>
      </aside>

      {/* Mobile drawer via portal */}
      {mounted && mobileOpen && createPortal(
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
                showGenerateCta={showGenerateCta}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
