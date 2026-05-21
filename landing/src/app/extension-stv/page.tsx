import type { Metadata } from "next";
import { ExtensionStvAccuracySection } from "@/components/extension-stv/ExtensionStvAccuracySection";
import { ExtensionStvChromeBadge } from "@/components/extension-stv/ExtensionStvChromeBadge";
import { ExtensionStvFaq } from "@/components/extension-stv/ExtensionStvFaq";
import { ExtensionStvFloatingCta } from "@/components/extension-stv/ExtensionStvFloatingCta";
import { ExtensionStvHowItWorks } from "@/components/extension-stv/ExtensionStvHowItWorks";
import { ExtensionStvMarketingFooter } from "@/components/extension-stv/ExtensionStvMarketingFooter";
import { ExtensionStvMarketingHeader } from "@/components/extension-stv/ExtensionStvMarketingHeader";
import { ExtensionStvTestimonials } from "@/components/extension-stv/ExtensionStvTestimonials";
import { PainReferenceVsDraftMock } from "@/components/extension-stv/PainReferenceVsDraftMock";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

const TITLE = "Image to Prompt Chrome Tool — AI Photo Prompts | PromptShot";
const DESCRIPTION =
  "Turn browsing into detailed AI image prompts in Chrome: lighting, palette, composition, and style cues from any reference—then refine or generate in PromptShot.";

const HERO_HEADLINE = "Build better AI image prompts from any reference on the page";

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

export default function ExtensionStvPreviewPage() {
  return (
    <div className="pb-32">
      <ExtensionStvMarketingHeader />

      {/* 1. Hero — только заголовок + лид + бейдж (как на image-to-prompt: сверху текст) */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-25%,rgba(99,102,241,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_20%,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-8 text-center sm:px-6 sm:pb-10 sm:pt-10">
          <h1 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {HERO_HEADLINE}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
            Stop typing generic “4K cinematic” lines. Image To Prompt reads the reference in front of you and drafts
            descriptive cues—subject, backdrop, color story, light, texture—so your next generation starts closer to the
            look you want.
          </p>
          <ExtensionStvChromeBadge className="mx-auto mt-4 justify-center" />
        </div>
      </section>

      {/* 2. Боль + live demo */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              Great AI art starts with a prompt that actually describes the scene
            </h2>
            <ul className="mt-5 space-y-3 text-zinc-400">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" />
                <span>
                  Strong prompts spell out the <strong className="text-zinc-100">hero subject</strong>,{" "}
                  <strong className="text-zinc-100">environment</strong>, and{" "}
                  <strong className="text-zinc-100">art direction</strong>—yet most people only remember a few adjectives
                  when the tab is gone.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" />
                <span>
                  Guessing light direction, palette, lens feel, and mood burns time; models return{" "}
                  <strong className="text-zinc-100">almost-right</strong> frames until you luck into the magic phrase.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/80" />
                <span>
                  Manual screenshots and copy/paste across tools add <strong className="text-zinc-100">friction</strong>{" "}
                  right when you should be iterating on the idea—not the window layout.
                </span>
              </li>
            </ul>
          </div>
          <PainReferenceVsDraftMock />
        </div>
      </section>

      {/* 3. Точность / сравнение */}
      <ExtensionStvAccuracySection />

      {/* 4. Отзывы */}
      <ExtensionStvTestimonials />

      {/* 5. Как пользоваться + FAQ */}
      <ExtensionStvHowItWorks />

      <ExtensionStvFaq />

      <ExtensionStvMarketingFooter />

      <ExtensionStvFloatingCta />
    </div>
  );
}
