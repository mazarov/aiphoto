import { GeneraciyaFotoFaqBlock } from "@/components/generate/GeneraciyaFotoFaqBlock";
import { FOTO_V_PROMT_FAQ } from "@/lib/foto-v-promt-copy";

export function FotoVPromtFaq() {
  return (
    <GeneraciyaFotoFaqBlock
      headingId="foto-v-promt-faq-heading"
      title={FOTO_V_PROMT_FAQ.title}
      lead={FOTO_V_PROMT_FAQ.subtitle}
      items={FOTO_V_PROMT_FAQ.items}
    />
  );
}
