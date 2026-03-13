"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { MenuSectionWithCounts } from "@/lib/menu";
import { SearchBar } from "./SearchBar";
import { useAuth } from "@/context/AuthContext";

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

function UserMenu() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  if (loading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={openAuthModal}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Войти
      </button>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-100"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden text-[13px] font-medium text-zinc-700 sm:block">
          {displayName}
        </span>
      </button>
      {open && (
        <>
          <div className="absolute left-0 right-0 top-full z-40 h-2" />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-zinc-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Избранное
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); signOut(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Выйти
            </button>
          </div>
        </>
      )}
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

          <div className="flex items-center gap-2">
            <SearchBar />
            <UserMenu />
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
        </div>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} menu={menu} />
    </>
  );
}
