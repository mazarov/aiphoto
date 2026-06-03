"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SiteLogoMark } from "./SiteLogoMark";
import { ListingChromeButton, ListingMenuIcon } from "./ListingChromeButton";
import { useAuth } from "@/context/AuthContext";
import { useListingMobileChromeOptional } from "@/context/ListingMobileChromeContext";
import { isSameNavPath, scrollCatalogToTop } from "@/lib/scroll-preservation";

function MobileCatalogMenuButton() {
  const chrome = useListingMobileChromeOptional();
  void chrome?.menuRevision;
  const openMenu = chrome?.menuOpenRef.current;

  if (!openMenu) return null;

  return (
    <ListingChromeButton variant="icon-sm" onClick={openMenu} aria-label="Каталог">
      <ListingMenuIcon />
    </ListingChromeButton>
  );
}

function UserMenu() {
  const { user, loading, openAuthModal, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-xl border border-indigo-200/40 bg-white/60" />
    );
  }

  if (!user) {
    return (
      <ListingChromeButton variant="pill" onClick={openAuthModal}>
        Войти
      </ListingChromeButton>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="relative">
      <ListingChromeButton
        variant="pill"
        onClick={() => setOpen((v) => !v)}
        className="gap-2 px-2"
        aria-expanded={open}
        aria-haspopup="menu"
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
        <span className="hidden text-[13px] font-medium text-zinc-800 sm:block">
          {displayName}
        </span>
      </ListingChromeButton>
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
            <Link
              href="/generations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <span aria-hidden>🚀</span>
              Мои генерации
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

export function HeaderClient() {
  const pathname = usePathname();

  const handleHomeLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSameNavPath(pathname, "/")) {
      e.preventDefault();
      scrollCatalogToTop();
    }
  };

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-indigo-100/50 bg-white/80 backdrop-blur-xl">
      {/* Mobile: menu + logo + auth */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:hidden">
        <div className="flex shrink-0 justify-start">
          <MobileCatalogMenuButton />
        </div>
        <Link
          href="/"
          scroll={false}
          onClick={handleHomeLogoClick}
          className="flex min-w-0 items-center justify-center gap-1.5 text-lg font-bold tracking-tight text-zinc-900"
        >
          <SiteLogoMark size={28} className="h-7 w-7 shrink-0 rounded-lg" />
          <span className="truncate">PromptShot</span>
        </Link>
        <div className="flex shrink-0 items-center justify-end">
          <UserMenu />
        </div>
      </div>

      {/* Desktop: logo + user menu */}
      <div className="hidden items-center justify-between gap-4 px-5 py-3 lg:flex">
        <Link
          href="/"
          scroll={false}
          onClick={handleHomeLogoClick}
          className="flex flex-shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-zinc-900"
        >
          <SiteLogoMark size={28} className="h-7 w-7 rounded-lg" />
          <span>PromptShot</span>
        </Link>

        <UserMenu />
      </div>
    </header>
  );
}
