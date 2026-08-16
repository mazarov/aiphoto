"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSameNavPath, scrollCatalogToTop } from "@/lib/scroll-preservation";
import { SiteLogoMark } from "./SiteLogoMark";

export function SiteBrandLink({
  className = "",
  markSize = 28,
}: {
  className?: string;
  markSize?: number;
}) {
  const pathname = usePathname();
  const compact = markSize <= 24;
  const markClass = compact ? "h-6 w-6" : "h-7 w-7";
  const textClass = compact ? "text-base" : "text-lg";

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
      className={`flex min-w-0 items-center gap-2 ${textClass} font-bold tracking-tight text-zinc-900 ${className}`}
      aria-label="PromptShot — на главную"
    >
      <SiteLogoMark size={markSize} className={`${markClass} shrink-0 rounded-lg`} />
      <span className="truncate">PromptShot</span>
    </Link>
  );
}
