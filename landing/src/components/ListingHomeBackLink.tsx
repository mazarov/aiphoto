import Link from "next/link";

/** Hub-back chip in the explorer row under search. */
export function ListingHomeBackLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Назад на главную"
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200 ${className}`}
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Назад
    </Link>
  );
}
