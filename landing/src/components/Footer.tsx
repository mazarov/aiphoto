"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteLogoMark } from "./SiteLogoMark";
import { useFeatureAccess } from "@/context/FeatureAccessContext";

export function Footer() {
  const pathname = usePathname();
  const { promptCardGenerationEnabled: hasPricingAccess } =
    useFeatureAccess();

  // Pricing keeps its own compact legal footer so the mobile layout fits one viewport.
  if (pathname === "/pricing") return null;

  return (
    <footer className="mt-auto border-t border-zinc-100 bg-zinc-50/50">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 select-none">
              <SiteLogoMark size={24} className="h-6 w-6 rounded-md" />
              PromptShot
            </div>
            <p className="mt-2 max-w-xs text-sm text-zinc-500">
              Готовые промпты для создания фото с помощью нейросетей. Копируй и используй.
            </p>
          </div>
          <nav className="flex gap-12">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Навигация</div>
              <ul className="space-y-2">
                <li><Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">Главная</Link></li>
                <li><Link href="/foto-v-promt" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">Фото в промт</Link></li>
                {hasPricingAccess && (
                  <li><Link href="/pricing" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">Тарифы</Link></li>
                )}
              </ul>
            </div>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Support</div>
              <ul className="space-y-2">
                <li>
                  <a
                    href="mailto:support_ru@promptshot.ru"
                    className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
                  >
                    support_ru@promptshot.ru
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-zinc-200/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} PromptShot. Все права защищены.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms" className="text-xs text-zinc-400 transition-colors hover:text-zinc-600">
              Публичная оферта
            </Link>
            <Link href="/policy" className="text-xs text-zinc-400 transition-colors hover:text-zinc-600">
              Политика обработки данных
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
