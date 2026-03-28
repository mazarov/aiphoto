import type { Metadata } from "next";
import Link from "next/link";
import { SiteLogoMark } from "@/components/SiteLogoMark";
import { PinterestOverlayMock } from "@/components/extension-stv/PinterestOverlayMock";
import { PainReferenceVsDraftMock } from "@/components/extension-stv/PainReferenceVsDraftMock";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

const TITLE = "Steal the Vibe – AI Photo Prompt Generator";
const DESCRIPTION = "Recreate any image with AI. Image to prompt + style transfer.";

const storeUrl = process.env.NEXT_PUBLIC_STV_CHROME_STORE_URL || "#stv-chrome-store";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/extension-stv` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/extension-stv`,
    type: "website",
  },
};

/** Единственная CTA на странице — плавающая (как FAB). */
function FloatingAddToChrome() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:pb-[max(2rem,env(safe-area-inset-bottom))]">
      <a
        href={storeUrl}
        className="pointer-events-auto inline-flex items-center justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_14px_rgba(99,102,241,0.5)] ring-1 ring-inset ring-white/20 transition hover:bg-indigo-600 hover:shadow-[0_12px_40px_rgba(0,0,0,0.55),0_4px_18px_rgba(99,102,241,0.55)]"
      >
        Add to Chrome
      </a>
    </div>
  );
}

function ChromeBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-300 ${className ?? ""}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.12)" />
        <circle cx="12" cy="12" r="4" fill="#6366f1" />
      </svg>
      Chrome
    </span>
  );
}

export default function ExtensionStvPreviewPage() {
  return (
    <div className="pb-28">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#09090b]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-50 transition-opacity hover:opacity-90"
          >
            <SiteLogoMark size={28} className="h-7 w-7 rounded-lg" />
            <span>PromptShot</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-25%,rgba(99,102,241,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_20%,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-16">
          <ChromeBadge className="mx-auto mb-6" />
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {TITLE}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-zinc-400 sm:text-lg">
            Recreate any image with AI. Image to prompt + style transfer.
          </p>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm text-zinc-500">
            You love a look online — but you can’t describe it well enough for your AI tool.
          </p>

          <PinterestOverlayMock />

          <p className="mx-auto mt-10 max-w-lg border-t border-white/[0.06] pt-6 text-[11px] leading-relaxed text-zinc-600">
            Dev preview: set{" "}
            <code className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              NEXT_PUBLIC_STV_CHROME_STORE_URL
            </code>{" "}
            for a real Chrome Web Store link on the floating button.
          </p>
        </div>
      </section>

      {/* Pain */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              You don’t need &quot;a prompt.&quot; You need the same vibe.
            </h2>
            <ul className="mt-8 space-y-4 text-zinc-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" />
                <span>
                  You see a reference — it’s unclear <strong className="text-zinc-100">what</strong> to copy: light,
                  palette, composition, texture.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" />
                <span>
                  You write from scratch — results are{" "}
                  <strong className="text-zinc-100">close but not it</strong>, many iterations.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" />
                <span>
                  Tab hopping, screenshots, paste — <strong className="text-zinc-100">friction</strong>, not flow.
                </span>
              </li>
            </ul>
          </div>
          <PainReferenceVsDraftMock />
        </div>
      </section>

      {/* More pain — --stv-bg-elevated */}
      <section className="border-y border-white/[0.08] bg-[#0c0c0f] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Guessing prompts is expensive.
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                t: "Credits & time",
                d: "Burned on trial-and-error phrasing instead of creating.",
              },
              {
                t: "Style drift",
                d: "The same look doesn’t reproduce across sessions.",
              },
              {
                t: "No shared language",
                d: "The image in the browser and the prompt box live in different worlds.",
              },
            ].map((item) => (
              <div
                key={item.t}
                className="rounded-[12px] border border-white/[0.08] bg-[rgb(24_24_27/0.4)] p-6"
              >
                <h3 className="font-semibold text-zinc-50">{item.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-xl text-sm text-zinc-500">
            It’s not laziness — it’s the <span className="text-zinc-300">gap between pixels and words</span>.
          </p>
        </div>
      </section>

      {/* Hope */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            What if the image{" "}
            <em className="not-italic bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">is</em>{" "}
            the brief?
          </h2>
          <p className="mt-6 text-zinc-400">
            Point at what you see → get structured language for your pipeline. Drop in your photo → keep the mood and
            style. Stay on the site you’re already browsing — no tab orchestra.
          </p>
        </div>
        <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            "Image → structured prompt",
            "Your photo + reference style",
            "Works beside the page you’re on",
          ].map((text) => (
            <li
              key={text}
              className="rounded-[10px] border border-white/[0.08] bg-[rgb(24_24_27/0.35)] px-4 py-3 text-center text-sm font-medium text-zinc-200"
            >
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Solution */}
      <section className="border-t border-white/[0.08] bg-[#0c0c0f] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Steal the Vibe — in one flow.
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Capture", desc: "Select the image on the page." },
              { step: "2", title: "Extract", desc: "AI pulls the prompt and style cues." },
              { step: "3", title: "Recreate", desc: "Use your photo — same vibe, your subject." },
            ].map((s) => (
              <div
                key={s.step}
                className="relative rounded-[12px] border border-white/[0.08] bg-[rgb(24_24_27/0.4)] p-6 text-center"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Step {s.step}</span>
                <h3 className="mt-2 text-lg font-semibold text-zinc-50">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
          <ul className="mx-auto mt-12 max-w-2xl space-y-2 text-center text-sm text-zinc-500">
            <li>Overlay on top of sites you already use</li>
            <li>Copy prompt, connect account when needed</li>
          </ul>
          <p className="mt-10 text-center text-xs text-zinc-500">
            <Link href="/privacy" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
              Privacy
            </Link>
            {" · "}
            <span>Support — coming soon</span>
          </p>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-white/[0.08] py-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm text-zinc-400">
            For designers, content creators, and anyone iterating with AI photos.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-500">
            Results depend on the model and your source image — the extension helps you start from the right brief.
          </p>
          <div className="mt-6 flex justify-center">
            <ChromeBadge />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#09090b] py-10">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold text-zinc-50">{TITLE}</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">
            Recreate any image with AI. Image to prompt + style transfer.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-zinc-500">
            <Link href="/" className="hover:text-zinc-300">
              PromptShot home
            </Link>
            <a href={storeUrl} className="hover:text-zinc-300">
              Chrome Web Store
            </a>
            <Link href="/privacy" className="hover:text-zinc-300">
              Privacy
            </Link>
          </div>
        </div>
      </footer>

      <FloatingAddToChrome />
    </div>
  );
}
