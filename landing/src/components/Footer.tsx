"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { SiteLogoMark } from "./SiteLogoMark";
import { useDebug } from "./DebugFAB";

export function Footer() {
  const debug = useDebug();
  const clickCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    clickCount.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      debug?.toggleDebug();
    } else {
      timer.current = setTimeout(() => { clickCount.current = 0; }, 1500);
    }
  }, [debug]);

  return (
    <footer className="mt-auto border-t border-zinc-100 bg-zinc-50/50">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 select-none"
            >
              <SiteLogoMark
                size={24}
                className={`h-6 w-6 rounded-md ${debug?.debugOpen ? "ring-2 ring-amber-400/70" : ""}`}
              />
              PromptShot
            </button>
            <p className="mt-2 max-w-xs text-sm text-zinc-500">
              Готовые промпты для создания фото с помощью нейросетей. Копируй и используй.
            </p>
          </div>
          <nav className="flex gap-12">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Навигация</div>
              <ul className="space-y-2">
                <li><Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">Главная</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-zinc-200/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} PromptShot. Все права защищены.
          </p>
          <Link href="/privacy" className="text-xs text-zinc-400 transition-colors hover:text-zinc-600">
            Политика конфиденциальности
          </Link>
        </div>
      </div>
    </footer>
  );
}
