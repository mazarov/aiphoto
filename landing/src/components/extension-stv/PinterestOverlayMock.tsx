import type { ReactNode } from "react";
import Image from "next/image";
import { OverlayButtonMock, PAIN_REFERENCE_IMAGE_SRC, StvPinShell } from "./stv-mock-shared";

/**
 * Статичный мокап: лента в духе Pinterest + оверлей расширения.
 * Один ряд из 3 карточек; средняя — с визуалом hover.
 */

/**
 * Простая стрелка (треугольник + «хвост» по одной линии) — без формы «указательного пальца» у системного курсора.
 */
function HoverCursorMock({ className }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute z-20 ${className ?? ""}`} aria-hidden>
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
      >
        <path
          d="M3.5 2.75L3.5 18.25L18.75 10.25L3.5 2.75Z"
          fill="#ffffff"
          stroke="#09090b"
          strokeWidth="1.35"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

type PinChromeProps = {
  children: ReactNode;
  tall?: boolean;
  /** Центральная «активная» карточка: кольцо, лёгкий scale, курсор, оверлей кнопки снаружи */
  featured?: boolean;
  className?: string;
};

function PinChrome({ children, tall, featured, className }: PinChromeProps) {
  return (
    <div
      className={
        (featured
          ? "relative z-[1] sm:scale-[1.03] motion-reduce:scale-100"
          : "relative") +
        " transition-transform duration-200 ease-out " +
        (className ?? "")
      }
    >
      <div
        className={
          featured
            ? "rounded-2xl bg-gradient-to-br from-indigo-500/45 via-violet-500/25 to-transparent p-[2px] shadow-[0_0_32px_rgba(99,102,241,0.28),0_0_0_1px_rgba(255,255,255,0.12)_inset]"
            : ""
        }
      >
        <StvPinShell
          tall={tall}
          className={featured ? "ring-0" : ""}
        >
          {children}
          {featured ? (
            <>
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-white/[0.06]"
                aria-hidden
              />
              <HoverCursorMock className="bottom-[52px] right-3 sm:bottom-[56px] sm:right-4" />
            </>
          ) : null}
        </StvPinShell>
      </div>
    </div>
  );
}

type GradientKey = "orange" | "violet" | "rose" | "teal" | "slate" | "amber";

function PinGradient({ variant }: { variant: GradientKey }) {
  const map: Record<GradientKey, string> = {
    orange: "bg-gradient-to-b from-orange-900/50 via-amber-900/30 to-zinc-900",
    violet: "bg-gradient-to-b from-violet-900/45 to-zinc-900",
    rose: "bg-gradient-to-b from-rose-900/40 to-zinc-900",
    teal: "bg-gradient-to-br from-teal-900/50 via-cyan-900/35 to-zinc-900",
    slate: "bg-gradient-to-b from-slate-700/50 to-zinc-900",
    amber: "bg-gradient-to-b from-amber-900/35 to-zinc-900",
  };
  return <div className={`absolute inset-0 ${map[variant]}`} />;
}

export function PinterestOverlayMock() {
  return (
    <div className="mx-auto mt-12 w-full max-w-3xl sm:mt-14">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgb(24_24_27/0.92)] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset]">
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#0c0c0f] px-3 py-2.5 sm:px-4">
          <span className="h-2 w-2 rounded-full bg-red-500/90" />
          <span className="h-2 w-2 rounded-full bg-amber-400/90" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
          <span className="ml-2 flex-1 truncate rounded-md border border-white/[0.06] bg-black/35 px-2.5 py-1 text-center text-[11px] text-zinc-500 sm:text-xs">
            pinterest.com
          </span>
        </div>

        <div className="bg-[#0a0a0a] px-3 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
          <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:text-[11px]">
            Home feed · hover a pin
          </p>

          <div className="mx-auto grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-3">
            <div className="opacity-[0.82] motion-reduce:opacity-100">
              <PinChrome tall>
                <PinGradient variant="rose" />
              </PinChrome>
            </div>

            <PinChrome tall featured>
              <div className="absolute inset-0 bg-zinc-950">
                <Image
                  src={PAIN_REFERENCE_IMAGE_SRC}
                  alt="Same reference photo as in the Reference block above — example from PromptShot generations"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 34vw, 300px"
                  quality={60}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25"
                aria-hidden
              />
              <div className="absolute right-1.5 top-1.5 z-10 sm:right-2 sm:top-2">
                <OverlayButtonMock />
              </div>
              <p className="absolute bottom-[3.35rem] left-2.5 right-2.5 z-[5] text-[10px] leading-snug text-white/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)] sm:bottom-[3.5rem] sm:left-3 sm:right-3 sm:text-[11px]">
                Hover — overlay at the <span className="font-medium text-indigo-200">top-right</span>, same as live sites
              </p>
            </PinChrome>

            <div className="opacity-[0.82] motion-reduce:opacity-100">
              <PinChrome tall>
                <PinGradient variant="violet" />
              </PinChrome>
            </div>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-md text-pretty text-center text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
        Same UI as the extension (Shadow DOM) — shows when you hover images on Pinterest-style grids.
      </p>
    </div>
  );
}
