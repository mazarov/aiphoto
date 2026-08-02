import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  documentHref: string;
  documentAvailable: boolean;
};

export function LegalDocumentPage({
  eyebrow,
  title,
  description,
  documentHref,
  documentAvailable,
}: Props) {
  return (
    <PageLayout>
      <main className="relative flex flex-1 items-center overflow-hidden bg-gradient-to-b from-indigo-50/60 via-white to-white px-5 py-16 sm:py-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(99,102,241,0.13),transparent)]"
          aria-hidden
        />
        <article className="relative mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-[0_24px_80px_-44px_rgba(39,39,42,0.35)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-600">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base">{description}</p>

          {documentAvailable ? (
            <a
              href={documentHref}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Открыть полный документ
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M7 5h8v8M15 5 6 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 11v4H5V7h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              Полный документ готовится к публикации.
            </div>
          )}

          <Link
            href="/"
            className="mt-8 inline-flex text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            Вернуться на главную
          </Link>
        </article>
      </main>
    </PageLayout>
  );
}
