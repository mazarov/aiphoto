import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { PricingScreen } from "@/components/pricing/PricingScreen";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

export const metadata: Metadata = {
  title: "Тарифы и токены — PromptShot",
  description: "Пакеты токенов PromptShot: разовая покупка, токены без срока действия и более выгодная цена за фото в больших пакетах.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Тарифы и токены — PromptShot",
    description: "Покупайте токены один раз и создавайте фото в своём темпе.",
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <PageLayout>
      <PricingScreen variant="page" />
    </PageLayout>
  );
}
