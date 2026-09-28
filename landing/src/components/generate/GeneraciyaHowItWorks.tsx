import { GF_BLOCK, GF_H2, GF_LEAD } from "@/components/generate/generaciya-foto-ui";

/** H2 «как работает» + H3 tips — one extra key in the H2, no key in the H3. */
export function GeneraciyaHowItWorks({
  title,
  paragraphs,
  tipsTitle,
  tips,
  headingId = "how-it-works-heading",
}: {
  title: string;
  paragraphs: readonly string[];
  tipsTitle: string;
  tips: readonly string[];
  headingId?: string;
}) {
  return (
    <section className="scroll-mt-20" aria-labelledby={headingId}>
      <div className={`${GF_BLOCK} grid items-start gap-8 lg:grid-cols-2`}>
        <div>
          <h2 id={headingId} className={GF_H2}>
            {title}
          </h2>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className={GF_LEAD}>
              {paragraph}
            </p>
          ))}
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{tipsTitle}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 sm:text-base">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
