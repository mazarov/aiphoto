import Image from "next/image";
import { PAIN_REFERENCE_IMAGE_SRC } from "./stv-mock-shared";
import {
  STV_SECTION_BG_MUTED,
  STV_SECTION_CONTAINER,
  STV_SECTION_DIVIDER,
  STV_SECTION_PY,
  STV_SECTION_SUBTITLE,
  STV_SECTION_TITLE,
} from "./stv-marketing-shared";

type ComparisonCardProps = {
  generatedLabel: string;
  description: string;
  generatedClassName?: string;
};

/**
 * Карточка «Original | Generated» с бейджами и VS — единая высота текста через line-clamp.
 */
function ComparisonCard({ generatedLabel, description, generatedClassName }: ComparisonCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgb(24_24_27/0.4)] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.04]">
      <div className="relative grid grid-cols-2">
        <div className="relative aspect-[4/5] min-h-0 border-r border-white/[0.06]">
          <span className="absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 backdrop-blur-sm">
            Original
          </span>
          <Image
            src={PAIN_REFERENCE_IMAGE_SRC}
            alt="Original reference frame"
            fill
            unoptimized
            className="object-cover object-center"
            sizes="(max-width: 768px) 50vw, 280px"
            quality={60}
          />
        </div>
        <div className="relative aspect-[4/5] min-h-0">
          <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 backdrop-blur-sm">
            {generatedLabel}
          </span>
          <Image
            src={PAIN_REFERENCE_IMAGE_SRC}
            alt="Illustrative regenerated variant for comparison"
            fill
            unoptimized
            className={`object-cover object-center ${generatedClassName ?? ""}`}
            sizes="(max-width: 768px) 50vw, 280px"
            quality={60}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-violet-950/20 to-transparent" />
        </div>
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500 text-xs font-bold text-white shadow-lg shadow-violet-500/30">
            VS
          </span>
        </div>
      </div>
      <p className="min-h-[5.5rem] border-t border-white/[0.06] bg-zinc-950/35 px-4 py-3 text-sm leading-relaxed text-zinc-400 line-clamp-4">
        {description}
      </p>
    </article>
  );
}

const CARDS: ComparisonCardProps[] = [
  {
    generatedLabel: "Generated · pass A",
    description:
      "Prompt emphasizes subject separation, stormy cool palette, and metallic speculars—useful when you want the model to echo mood and material, not just composition.",
    generatedClassName: "saturate-[1.15] contrast-[1.08] hue-rotate-[6deg]",
  },
  {
    generatedLabel: "Generated · pass B",
    description:
      "A warmer, slightly softer read of the same frame—shows how small language shifts steer color grading and micro-contrast without changing the scene layout.",
    generatedClassName: "saturate-[1.08] contrast-[1.04] hue-rotate-[-8deg] brightness-[1.03]",
  },
  {
    generatedLabel: "Generated · pass C",
    description:
      "Higher clarity bias in the prompt family: edges read crisper, shadows a touch deeper—handy when your target model tends to mush fine detail.",
    generatedClassName: "saturate-[1.12] contrast-[1.12] brightness-[0.98]",
  },
  {
    generatedLabel: "Generated · pass D",
    description:
      "More diffuse key-light wording in the extract—foreground feels gentler while background structure stays anchored; good for portrait-leaning generators.",
    generatedClassName: "saturate-[1.05] contrast-[1.03] hue-rotate-[3deg] brightness-[1.04]",
  },
];

export function ExtensionStvAccuracySection() {
  return (
    <section
      className={`${STV_SECTION_DIVIDER} ${STV_SECTION_BG_MUTED} ${STV_SECTION_PY}`}
      aria-labelledby="extension-stv-accuracy-heading"
    >
      <div className={STV_SECTION_CONTAINER}>
        <h2 id="extension-stv-accuracy-heading" className={STV_SECTION_TITLE}>
          Highly accurate image-to-prompt generation
        </h2>
        <p className={STV_SECTION_SUBTITLE}>
          Compare a reference with a prompt-aware regeneration to see how tightly the language tracks what you liked.
          Results vary by model and settings—treat it as a sanity check, not a guarantee.
        </p>

        <div className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 sm:gap-8 lg:gap-10">
          {CARDS.map((c) => (
            <ComparisonCard key={c.generatedLabel} {...c} />
          ))}
        </div>
      </div>
    </section>
  );
}
