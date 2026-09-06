import type { Metadata } from "next";
import { NanoBananaFamilyPage } from "@/components/generate/NanoBananaFamilyPage";
import {
  buildNanoBananaMetadata,
  loadNanoBananaOgImage,
  loadNanoBananaPageData,
} from "@/lib/nano-banana-page-data";
import {
  NANO_BANANA_ACCESS,
  NANO_BANANA_DEFAULT_MODEL_ID,
  NANO_BANANA_FAQ,
  NANO_BANANA_FEATURES,
  NANO_BANANA_HOW_TO_STEPS,
  NANO_BANANA_PATH,
  NANO_BANANA_PRICING,
  NANO_BANANA_SEO,
  NANO_BANANA_TOOLS,
} from "@/lib/nano-banana-seo-copy";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const ogImage = await loadNanoBananaOgImage();
  return buildNanoBananaMetadata(NANO_BANANA_SEO, NANO_BANANA_PATH, ogImage);
}

export default async function NanoBananaPage() {
  const data = await loadNanoBananaPageData();
  return (
    <NanoBananaFamilyPage
      path={NANO_BANANA_PATH}
      defaultModelId={NANO_BANANA_DEFAULT_MODEL_ID}
      seo={NANO_BANANA_SEO}
      applicationName="Nano Banana — PromptShot"
      breadcrumbs={[
        { name: "Главная", href: "/" },
        { name: NANO_BANANA_SEO.breadcrumb },
      ]}
      howToSteps={NANO_BANANA_HOW_TO_STEPS}
      tools={NANO_BANANA_TOOLS}
      features={NANO_BANANA_FEATURES}
      featuresEyebrow="Возможности"
      pricingReturnPath={NANO_BANANA_PRICING.returnPath}
      faq={NANO_BANANA_FAQ}
      access={NANO_BANANA_ACCESS}
      {...data}
    />
  );
}
