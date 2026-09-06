import {
  GF_BLOCK,
  GF_EYEBROW,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import type { NanoBananaFeaturesCopy } from "@/lib/nano-banana-seo-copy";

export function NanoBananaFeatures({
  eyebrow,
  features,
}: {
  eyebrow: string;
  features: NanoBananaFeaturesCopy;
}) {
  return (
    <section className="scroll-mt-20" aria-labelledby="nano-banana-features-heading">
      <div className={GF_BLOCK}>
        <p className={GF_EYEBROW}>{eyebrow}</p>
        <h2 id="nano-banana-features-heading" className={`mt-2 ${GF_H2}`}>
          {features.title}
        </h2>
        <p className={GF_LEAD}>{features.lead}</p>
        <ul className={`${GF_STACK} grid gap-3 sm:grid-cols-3`}>
          {features.items.map((item) => (
            <li key={item.title} className={`p-5 ${GF_SURFACE}`}>
              <h3 className="text-base font-semibold text-zinc-900">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
