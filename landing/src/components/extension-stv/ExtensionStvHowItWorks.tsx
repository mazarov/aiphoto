import Image from "next/image";
import { PAIN_REFERENCE_IMAGE_SRC } from "./stv-mock-shared";
import {
  STV_SECTION_BG_MUTED,
  STV_SECTION_CONTAINER,
  STV_SECTION_DIVIDER,
  STV_SECTION_PY,
  STV_SECTION_SUBTITLE,
  STV_SECTION_TITLE,
  STV_VISUAL_SHELL,
} from "./stv-marketing-shared";

const HOW_PROMPT_SNIPPET =
  "A close-up portrait with soft window light, warm skin tones, shallow depth of field, natural texture in fabric and hair, editorial color grade, calm confident expression.";

/**
 * «How to use» — единый блок с визуалом слева и нумерованными шагами справа (как imageprompt.org).
 */
export function ExtensionStvHowItWorks() {
  const steps = [
    {
      title: "Install the extension",
      body: "Add Image To Prompt from the Chrome Web Store and pin it for one-click access.",
    },
    {
      title: "Hover the reference you want",
      body: "On feeds, shops, or articles—open the overlay when the frame matches the look you want.",
    },
    {
      title: "Generate or copy the draft",
      body: "Get structured language, then refine in PromptShot or paste into another image model.",
    },
    {
      title: "Iterate with confidence",
      body: "Edit keywords, rerun, or use your own photo—the same extract → refine loop every time.",
    },
  ];

  return (
    <section
      className={`${STV_SECTION_DIVIDER} ${STV_SECTION_BG_MUTED} ${STV_SECTION_PY}`}
      aria-labelledby="extension-stv-how-heading"
    >
      <div className={STV_SECTION_CONTAINER}>
        <h2 id="extension-stv-how-heading" className={STV_SECTION_TITLE}>
          How to use Image to Prompt
        </h2>
        <p className={STV_SECTION_SUBTITLE}>
          From install to a prompt you can ship—four quick steps, no tab circus.
        </p>

        <div className={`mt-10 sm:mt-12 ${STV_VISUAL_SHELL}`}>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            {/* Left: image → prompt (как в референсе) */}
            <div className="relative mx-auto w-full max-w-md lg:mx-0">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-lg ring-1 ring-white/[0.06]">
                <div className="relative aspect-[4/5] w-full">
                  <Image
                    src={PAIN_REFERENCE_IMAGE_SRC}
                    alt="Reference photo used in the how-to example"
                    fill
                    unoptimized
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 400px"
                    quality={60}
                  />
                </div>
              </div>

              {/* Стрелка image → prompt */}
              <div className="relative z-[1] -mt-2 flex justify-center sm:-mt-3" aria-hidden>
                <svg
                  width="120"
                  height="48"
                  viewBox="0 0 120 48"
                  fill="none"
                  className="text-violet-400"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M60 4C60 4 24 8 20 28C16 44 32 44 60 44"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.9"
                  />
                  <path
                    d="M52 38L60 44L68 38"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="relative z-[2] -mt-2 rounded-2xl border-2 border-violet-400/45 bg-zinc-950/95 p-4 shadow-[0_12px_40px_-16px_rgba(139,92,246,0.45)] sm:p-5">
                <p className="text-[11px] font-medium italic tracking-wide text-violet-300/90">prompt</p>
                <p className="mt-2 text-left text-sm leading-relaxed text-zinc-300">{HOW_PROMPT_SNIPPET}</p>
              </div>
            </div>

            {/* Right: шаги с фиолетовыми кругами */}
            <ol className="list-none space-y-6 p-0">
              {steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white shadow-md shadow-violet-500/25"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-base font-semibold tracking-tight text-zinc-100">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
