import Image from "next/image";
import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import { FOTO_V_PROMT_HOW } from "@/lib/foto-v-promt-copy";
import { AddToChromeCard } from "./AddToChromeCard";
import { PAIN_REFERENCE_IMAGE_SRC } from "./mock-shared";
import { FVP_BORDER_CARD } from "./foto-v-promt-tokens";

export function FotoVPromtHowItWorks() {
  return (
    <section
      id="howto"
      className="scroll-mt-20"
      aria-labelledby="foto-v-promt-how-heading"
    >
      <div className={GF_BLOCK}>
        <p className={GF_EYEBROW}>три шага</p>
        <h2 id="foto-v-promt-how-heading" className={`mt-2 ${GF_H2}`}>
          {FOTO_V_PROMT_HOW.title}
        </h2>
        <p className={GF_LEAD}>{FOTO_V_PROMT_HOW.subtitle}</p>

        <div className={`${GF_STACK} grid items-start gap-8 lg:grid-cols-2 lg:gap-10`}>
          <div className="relative mx-auto w-full max-w-md pr-8 lg:mx-0">
            <style>{`
              @keyframes liteBorderRun { to { stroke-dashoffset: -100; } }
            `}</style>
            <div
              className={`relative overflow-hidden rounded-2xl ${FVP_BORDER_CARD} bg-white ring-1 ring-indigo-100/80`}
            >
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
                className="relative h-full w-full overflow-hidden rounded-l-[12px] border border-black/10 bg-white"
                style={{ borderRightWidth: 0 }}
              >
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 32 40" aria-hidden>
                  <defs>
                    <linearGradient
                      id="fvpDemoFabBorder"
                      x1="4"
                      y1="4"
                      x2="30"
                      y2="36"
                      gradientUnits="userSpaceOnUse"
                    >
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

          <div className="flex flex-col gap-5">
            <div className={`p-4 sm:p-5 ${GF_SURFACE}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                промпт
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {FOTO_V_PROMT_HOW.promptSnippet}
              </p>
            </div>

            <ol className="list-none space-y-5 p-0">
              {FOTO_V_PROMT_HOW.steps.map((step, i) => (
                <li key={step}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{step}</p>
                </li>
              ))}
            </ol>

            <AddToChromeCard placement="foto_v_promt_howto" />
          </div>
        </div>
      </div>
    </section>
  );
}
