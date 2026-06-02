import { FOTO_V_PROMT_FAQ } from "@/lib/foto-v-promt-copy";
import { FVP_FOCUS_RING, FVP_SECTION_CONTAINER, FVP_SECTION_PY, FVP_SECTION_SUBTITLE, FVP_SECTION_TITLE } from "./foto-v-promt-tokens";

export function FotoVPromtFaq() {
  return (
    <section className={FVP_SECTION_PY} aria-labelledby="foto-v-promt-faq-heading">
      <div className={`${FVP_SECTION_CONTAINER} max-w-3xl`}>
        <h2 id="foto-v-promt-faq-heading" className={FVP_SECTION_TITLE}>
          {FOTO_V_PROMT_FAQ.title}
        </h2>
        <p className={FVP_SECTION_SUBTITLE}>{FOTO_V_PROMT_FAQ.subtitle}</p>

        <div className="mt-8 space-y-3">
          {FOTO_V_PROMT_FAQ.items.map((item) => (
            <details
              key={item.q}
              className={`group rounded-xl border border-zinc-200 bg-white transition-colors open:border-indigo-200 open:bg-indigo-50/30 open:ring-1 open:ring-indigo-100 ${FVP_FOCUS_RING}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-zinc-900 sm:text-[15px] [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span
                  className="shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-current">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-4 pt-0 text-sm leading-relaxed text-zinc-600">
                <div className="pt-2">{item.a}</div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
