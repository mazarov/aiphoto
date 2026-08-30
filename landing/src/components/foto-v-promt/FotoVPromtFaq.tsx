import {
  GF_BLOCK,
  GF_H2,
  GF_LEAD,
  GF_STACK,
  GF_SURFACE,
} from "@/components/generate/generaciya-foto-ui";
import { FOTO_V_PROMT_FAQ } from "@/lib/foto-v-promt-copy";

const FAQ_ITEM = `group ${GF_SURFACE} open:border-indigo-200 open:bg-white`;
const FAQ_SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export function FotoVPromtFaq() {
  return (
    <section
      id="faq"
      className="scroll-mt-20"
      aria-labelledby="foto-v-promt-faq-heading"
    >
      <div className={GF_BLOCK}>
        <h2 id="foto-v-promt-faq-heading" className={GF_H2}>
          {FOTO_V_PROMT_FAQ.title}
        </h2>
        <p className={GF_LEAD}>{FOTO_V_PROMT_FAQ.subtitle}</p>
        <div className={`${GF_STACK} space-y-2`}>
          {FOTO_V_PROMT_FAQ.items.map((item) => (
            <details key={item.q} open className={FAQ_ITEM}>
              <summary className={FAQ_SUMMARY}>
                <span>{item.q}</span>
                <svg
                  className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <div className="px-5 pb-4 text-sm leading-relaxed text-zinc-600">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
