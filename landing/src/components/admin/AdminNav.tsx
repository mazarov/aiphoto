"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/analyze-history", label: "История" },
  { href: "/admin/payments", label: "Оплаты" },
  { href: "/admin/finance", label: "Финансы" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/mail", label: "Почта" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы админ-панели" className="mx-auto mb-3 flex max-w-7xl flex-wrap gap-1.5 sm:mb-6 sm:gap-2">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:rounded-xl sm:px-3 sm:py-2 ${
            active
              ? "bg-indigo-600 text-white"
              : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}>
          {item.label}
        </Link>;
      })}
    </nav>
  );
}
