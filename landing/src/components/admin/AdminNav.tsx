"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/analytics", label: "Аналитика" },
  { href: "/admin/analyze-history", label: "История" },
  { href: "/admin/payments", label: "Оплаты" },
  { href: "/admin/finance", label: "Финансы" },
  { href: "/admin/seo", label: "SEO" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы админ-панели" className="mx-auto mb-6 flex max-w-7xl flex-wrap gap-2">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
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
