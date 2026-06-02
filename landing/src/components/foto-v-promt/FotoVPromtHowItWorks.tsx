import Image from "next/image";
import { FOTO_V_PROMT_HOW } from "@/lib/foto-v-promt-copy";
import { PAIN_REFERENCE_IMAGE_SRC } from "./mock-shared";
import {
  FVP_BORDER_CARD,
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
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="relative mx-auto w-full max-w-md lg:mx-0">
              <style>{`
                @keyframes liteBorderRun { to { stroke-dashoffset: -100; } }
              `}</style>
              <div className={`relative overflow-hidden rounded-2xl ${FVP_BORDER_CARD} bg-white shadow-sm ring-1 ring-zinc-100`}>
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

              <div
                className="absolute z-10"
                style={{ right: "-1px", top: "22%", width: 32, height: 40 }}
                aria-hidden
              >
                <div
                  className="relative h-full w-full overflow-hidden rounded-l-[12px] border border-black/10 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.8)]"
                  style={{ borderRightWidth: 0 }}
                >
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 32 40" aria-hidden>
                    <defs>
                      <linearGradient id="fvpDemoFabBorder" x1="4" y1="4" x2="30" y2="36" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366f1" />
                        <stop offset="1" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M32 0 H12 A12 12 0 0 0 0 12 V28 A12 12 0 0 0 12 40 H32 V0"
                      fill="none"
                      stroke="url(#fvpDemoFabBorder)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="11 89"
                      pathLength="100"
                      style={{ animation: "liteBorderRun 1.15s linear infinite" }}
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center">
                    <Image
                      src="/icons/icon-widget-star.png"
                      alt=""
                      width={18}
                      height={18}
                      unoptimized
                      className="h-[18px] w-[18px] translate-x-[1px] object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border-2 border-indigo-200/80 bg-white p-4 shadow-md sm:p-5">
                <p className="text-[11px] font-medium italic tracking-wide text-indigo-600/90">промпт</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                  {FOTO_V_PROMT_HOW.promptSnippet}
                </p>
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
      </div>
    </section>
  );
}
