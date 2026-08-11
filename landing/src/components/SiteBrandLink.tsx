"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSameNavPath, scrollCatalogToTop } from "@/lib/scroll-preservation";
import { SiteLogoMark } from "./SiteLogoMark";

export function SiteBrandLink({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <Link
      href="/"
      scroll={false}
      onClick={(event) => {
        if (isSameNavPath(pathname, "/")) {
          event.preventDefault();
          scrollCatalogToTop();
        }
      }}
      className={`flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 ${className}`}
      aria-label="PromptShot — на главную"
    >
      <SiteLogoMark size={28} className="h-7 w-7 shrink-0 rounded-lg" />
      <span className="truncate">PromptShot</span>
    </Link>
  );
}
