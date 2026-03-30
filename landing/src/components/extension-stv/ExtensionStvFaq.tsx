import type { ReactNode } from "react";
import Link from "next/link";

/**
 * FAQ для маркетинговой страницы /extension-stv (без client JS — нативные <details>).
 */

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: "What does Image To Prompt do?",
    a: "It turns a reference image on the page into structured prompt language you can copy — so your AI photo tool gets a real brief (light, palette, composition, style cues), not a guess.",
  },
  {
    q: "Where does it work?",
    a: "On sites where you browse images (grids, feeds, articles). Hover an image, use the overlay, then refine or generate in PromptShot when you connect your account.",
  },
  {
    q: "Do I need a PromptShot account?",
    a: "Browsing and copying a draft may work without signing in; running the full extract → expand pipeline and generation uses your PromptShot session (cookies on promptshot.ru), same as the web panel.",
  },
  {
    q: "Does the extension read all my browsing?",
    a: (
      <>
        It only activates when you use it on a page — for example when you trigger the overlay on an image. See our{" "}
        <Link href="/privacy" className="text-indigo-300 underline-offset-2 hover:underline">
          Privacy
        </Link>{" "}
        page for what the site and extension store.
      </>
    ),
  },
  {
    q: "Will my result look identical to the reference?",
    a: "No tool can guarantee a pixel-perfect copy. Output depends on the model, your source photo, and settings. The goal is a stronger starting prompt so you iterate less.",
  },
];

export function ExtensionStvFaq() {
  return (
    <section className="py-20" aria-labelledby="extension-stv-faq-heading">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2
          id="extension-stv-faq-heading"
          className="text-center text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl"
        >
          Questions &amp; answers
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-zinc-500">
          Short answers about the Chrome extension and how it fits PromptShot.
        </p>

        <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-white/[0.08] bg-[rgb(24_24_27/0.35)] transition-colors open:bg-[rgb(24_24_27/0.5)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-zinc-100 sm:text-[15px] [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span
                  className="shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-current">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-4 pt-0">
                <p className="pt-2 text-sm leading-relaxed text-zinc-400">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
