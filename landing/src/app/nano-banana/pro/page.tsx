import type { Metadata } from "next";
import { NanoBananaFamilyPage } from "@/components/generate/NanoBananaFamilyPage";
import {
  buildNanoBananaMetadata,
  loadNanoBananaOgImage,
  loadNanoBananaPageData,
} from "@/lib/nano-banana-page-data";
import {
  NANO_BANANA_PATH,
  NANO_BANANA_PRO_ACCESS,
  NANO_BANANA_PRO_DEFAULT_MODEL_ID,
  NANO_BANANA_PRO_FAQ,
  NANO_BANANA_PRO_FEATURES,
  NANO_BANANA_PRO_HOW_TO_STEPS,
  NANO_BANANA_PRO_PATH,
  NANO_BANANA_PRO_PRICING,
  NANO_BANANA_PRO_SEO,
  NANO_BANANA_PRO_TOOLS,
  NANO_BANANA_SEO,
} from "@/lib/nano-banana-seo-copy";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await loadNanoBananaOgImage();
  return buildNanoBananaMetadata(
    NANO_BANANA_PRO_SEO,
    NANO_BANANA_PRO_PATH,
    ogImage
  );
}

export default async function NanoBananaProPage() {
  const data = await loadNanoBananaPageData();
  return (
    <NanoBananaFamilyPage
      path={NANO_BANANA_PRO_PATH}
      defaultModelId={NANO_BANANA_PRO_DEFAULT_MODEL_ID}
      seo={NANO_BANANA_PRO_SEO}
      applicationName="Nano Banana Pro — PromptShot"
      breadcrumbs={[
        { name: "Главная", href: "/" },
        { name: NANO_BANANA_SEO.breadcrumb, href: NANO_BANANA_PATH },
        { name: NANO_BANANA_PRO_SEO.breadcrumb },
      ]}
      howToSteps={NANO_BANANA_PRO_HOW_TO_STEPS}
      tools={NANO_BANANA_PRO_TOOLS}
      features={NANO_BANANA_PRO_FEATURES}
      featuresEyebrow="Зачем Pro"
      pricingReturnPath={NANO_BANANA_PRO_PRICING.returnPath}
      faq={NANO_BANANA_PRO_FAQ}
      access={NANO_BANANA_PRO_ACCESS}
      {...data}
    />
  );
}
