import Image from "next/image";
import { FOTO_V_PROMT_HOW } from "@/lib/foto-v-promt-copy";
import { LITE_FAB_STAR_PATH, PAIN_REFERENCE_IMAGE_SRC } from "./mock-shared";
import {
  FVP_SECTION_CONTAINER,
  FVP_SECTION_PY,
  FVP_SECTION_SUBTITLE,
  FVP_SECTION_TITLE,
  FVP_VISUAL_SHELL,
} from "./foto-v-promt-tokens";

export function FotoVPromtHowItWorks() {
  return (
    <section
      className={`border-t border-zinc-100 bg-zinc-50/50 ${FVP_SECTION_PY}`}
      aria-labelledby="foto-v-promt-how-heading"
    >
      <div className={FVP_SECTION_CONTAINER}>
        <h2 id="foto-v-promt-how-heading" className={FVP_SECTION_TITLE}>
          {FOTO_V_PROMT_HOW.title}
        </h2>
        <p className={FVP_SECTION_SUBTITLE}>{FOTO_V_PROMT_HOW.subtitle}</p>

        <div className={`mt-10 sm:mt-12 ${FVP_VISUAL_SHELL}`}>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative mx-auto w-full max-w-md lg:mx-0">
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-100">
                <div className="relative aspect-[4/5] w-full">
                  <Image
                    src={PAIN_REFERENCE_IMAGE_SRC}
                    alt="Пример фото для разбора в промпт"
                    fill
                    unoptimized
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 400px"
                    quality={60}
                  />
                </div>
              </div>

              <div className="absolute -bottom-3 -right-2 z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 shadow-lg shadow-indigo-500/30">
                <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d={LITE_FAB_STAR_PATH} />
                </svg>
              </div>

              <div className="relative z-[1] -mt-2 flex justify-center sm:-mt-3" aria-hidden>
                <svg
                  width="120"
                  height="48"
                  viewBox="0 0 120 48"
                  fill="none"
                  className="text-indigo-400"
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

              <div className="relative z-[2] -mt-2 rounded-2xl border-2 border-indigo-200/80 bg-white p-4 shadow-md sm:p-5">
                <p className="text-[11px] font-medium italic tracking-wide text-indigo-600/90">промпт</p>
                <p className="mt-2 text-left text-sm leading-relaxed text-zinc-700">
                  {FOTO_V_PROMT_HOW.promptSnippet}
                </p>
              </div>
            </div>

            <ol className="list-none space-y-5 p-0">
              {FOTO_V_PROMT_HOW.steps.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-500/25"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <p className="min-w-0 pt-1.5 text-sm leading-relaxed text-zinc-700">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
