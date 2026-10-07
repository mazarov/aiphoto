import { GF_BLOCK, GF_H2 } from "@/components/generate/generaciya-foto-ui";

/**
 * «Что такое нейрофотосессия» — definition slot the hub needs to rank for
 * «ИИ фотосессия по фото»: every SERP leader carries this block. Server component,
 * plain text, no CTA — the CTA lives in HowTo above and in the dock.
 */
export function FotosessiiWhatIsSection({
  title,
  paragraphs,
}: {
  title: string;
  paragraphs: readonly string[];
}) {
  return (
    <section
      id="chto-takoe"
      className="scroll-mt-20"
      aria-labelledby="what-is-heading"
    >
      <div className={GF_BLOCK}>
        <h2 id="what-is-heading" className={GF_H2}>
          {title}
        </h2>
        <div className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
          {paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
