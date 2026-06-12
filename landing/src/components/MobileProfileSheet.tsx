"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileProfileSheet({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Профиль";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Профиль"
    >
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
        aria-label="Закрыть"
        onClick={onClose}
      />

      <div className="relative z-10 rounded-t-2xl bg-white shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* User header */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-600">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[15px] font-semibold text-zinc-900">{displayName}</p>
            {user?.email && (
              <p className="text-[13px] text-zinc-400">{user.email}</p>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="px-2 py-2">
          <Link
            href="/favorites"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <svg
              className="h-5 w-5 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Избранное
          </Link>

          <Link
            href="/generations"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <svg
              className="h-5 w-5 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Мои генерации
          </Link>

          <button
            type="button"
            onClick={() => {
              onClose();
              void signOut();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <svg
              className="h-5 w-5 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Выйти
          </button>
        </nav>

        {/* Safe area spacer */}
        <div className="h-[max(1rem,env(safe-area-inset-bottom,1rem))]" />
      </div>
    </div>,
    document.body,
  );
}
