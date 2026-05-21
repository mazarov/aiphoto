import Link from "next/link";
import { SiteLogoMark } from "@/components/SiteLogoMark";
import { STV_CHROME_STORE_URL, STV_FOCUS_RING } from "./stv-marketing-shared";

export function ExtensionStvMarketingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/extension-stv"
          className={`flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-zinc-50 transition-opacity hover:opacity-90 sm:text-lg ${STV_FOCUS_RING} rounded-md`}
        >
          <SiteLogoMark size={28} className="h-7 w-7 shrink-0 rounded-lg" />
          <span className="truncate">Image to prompt</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-5">
          <Link
            href="/extension-stv/pricing"
            className={`text-sm text-zinc-400 transition-colors hover:text-zinc-100 ${STV_FOCUS_RING} rounded-md px-1 py-1`}
          >
            Pricing
          </Link>
          <a
            href={STV_CHROME_STORE_URL}
            className={`whitespace-nowrap text-sm text-zinc-400 transition-colors hover:text-zinc-100 ${STV_FOCUS_RING} rounded-md px-1 py-1`}
          >
            <span className="hidden sm:inline">Chrome Web Store</span>
            <span className="sm:hidden">Store</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
