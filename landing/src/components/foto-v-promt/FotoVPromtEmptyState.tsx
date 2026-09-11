import { widgetCopy } from "@/lib/foto-v-promt-copy";

type ImmersiveProps = { immersive: boolean };

/** Reference tile → prompt tile from the /foto-v-promt empty state. */
export function FotoVPromtEmptyIllustration({ immersive }: ImmersiveProps) {
  const arrowClass = immersive ? "text-zinc-300" : "text-zinc-400";
  const tileGlow = immersive
    ? "shadow-[0_0_28px_-4px_rgba(139,92,246,0.55)]"
    : "shadow-[0_8px_28px_-6px_rgba(99,102,241,0.35)]";

  return (
    <div className="relative flex items-center gap-3 py-1" aria-hidden>
      <div
        className={`pointer-events-none absolute -inset-x-6 -inset-y-2 rounded-full blur-2xl ${
          immersive
            ? "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.28),rgba(59,130,246,0.12)_45%,transparent_70%)]"
            : "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),rgba(59,130,246,0.1)_45%,transparent_70%)]"
        }`}
      />

      <div
        className={`relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-[1.15rem] bg-gradient-to-b from-violet-400 via-indigo-400 to-sky-300 ring-1 ring-white/25 ${tileGlow}`}
      >
        <div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.9)]" />
        <div className="absolute -bottom-5 -left-5 h-12 w-16 rotate-12 rounded-[50%] bg-violet-900/70" />
        <div className="absolute -bottom-4 right-[-1rem] h-11 w-16 -rotate-12 rounded-[50%] bg-indigo-950/65" />
        <div className="absolute bottom-0 left-1/2 h-9 w-3 -translate-x-1/2 rounded-t-full bg-zinc-950/85" />
        <div className="absolute bottom-7 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-zinc-950/85" />
        <div className="absolute inset-1 rounded-[0.9rem] ring-1 ring-inset ring-white/30" />
      </div>

      <svg className={`relative h-5 w-5 shrink-0 ${arrowClass}`} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12h12m0 0l-4.5-4.5M17 12l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div
        className={`relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 ${tileGlow}`}
      >
        <div className="relative h-[3.3rem] w-[2.8rem] rounded-lg border border-white/75 bg-zinc-950/35 p-2 shadow-inner">
          <span className="block text-left text-[10px] font-bold leading-none text-white">T</span>
          <span className="mt-1.5 block h-0.5 w-full rounded-full bg-white/85" />
          <span className="mt-1 block h-0.5 w-4/5 rounded-full bg-white/70" />
          <span className="mt-1 block h-0.5 w-3/5 rounded-full bg-fuchsia-200/90" />
        </div>
        <svg className="absolute right-1.5 top-1.5 h-4 w-4 text-white" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5l1.2 3.3L12.5 6 9.2 7.2 8 10.5 6.8 7.2 3.5 6l3.3-1.2L8 1.5z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export function FotoVPromtEmptyHero({ immersive }: ImmersiveProps) {
  const titleClass = immersive
    ? "text-lg font-semibold tracking-tight text-zinc-50"
    : "text-lg font-semibold tracking-tight text-zinc-900";
  const leadClass = immersive
    ? "mt-2 max-w-[18rem] text-sm leading-relaxed text-zinc-400"
    : "mt-2 max-w-[18rem] text-sm leading-relaxed text-zinc-600";

  return (
    <div className="pointer-events-none flex w-full max-w-sm flex-col items-center text-center">
      <FotoVPromtEmptyIllustration immersive={immersive} />
      <p className={`mt-5 ${titleClass}`}>{widgetCopy("emptyTitle")}</p>
      <p className={leadClass}>{widgetCopy("emptyLead")}</p>
    </div>
  );
}

export function FotoVPromtEmptyGuidance({
  immersive,
  density = "page",
}: ImmersiveProps & { density?: "page" | "dock" }) {
  const dock = density === "dock";
  const chipBase = dock
    ? "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium"
    : "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-medium";
  const doChip = immersive
    ? `${chipBase} bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20`
    : `${chipBase} bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200`;
  const dontChip = immersive
    ? `${chipBase} bg-white/[0.035] text-zinc-400 ring-1 ring-inset ring-white/10`
    : `${chipBase} bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200`;
  const hintClass = dock
    ? immersive
      ? "mt-2 text-[13px] font-medium text-white/50"
      : "mt-2 text-[13px] font-medium text-zinc-500"
    : "mt-3 text-xs text-zinc-500";

  return (
    <div className="pointer-events-none mt-4 flex w-full max-w-[17rem] flex-col items-center">
      <div className="flex w-full gap-2">
        <div className={doChip}>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {widgetCopy("emptyDo")}
        </div>
        <div className={dontChip}>
          <svg className="h-4 w-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
          {widgetCopy("emptyDont")}
        </div>
      </div>
      <p className={hintClass}>{widgetCopy("emptyHint")}</p>
    </div>
  );
}
