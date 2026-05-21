import type { Metadata } from "next";
import Link from "next/link";
import { ExtensionStvFloatingCta } from "@/components/extension-stv/ExtensionStvFloatingCta";
import { ExtensionStvMarketingFooter } from "@/components/extension-stv/ExtensionStvMarketingFooter";
import { ExtensionStvMarketingHeader } from "@/components/extension-stv/ExtensionStvMarketingHeader";
import { ExtensionStvPricing } from "@/components/extension-stv/ExtensionStvPricing";
import { STV_FOCUS_RING } from "@/components/extension-stv/stv-marketing-shared";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

const TITLE = "Pricing — Image to Prompt | PromptShot";
const DESCRIPTION =
  "Plans for Image to Prompt: free tier and Standard monthly—image-to-prompt limits and generation credits on PromptShot.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/extension-stv/pricing` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/extension-stv/pricing`,
    type: "website",
  },
};

export default function ExtensionStvPricingPage() {
  return (
    <div className="pb-32">
      <ExtensionStvMarketingHeader />

      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-6">
        <Link
          href="/extension-stv"
          className={`inline-flex text-sm text-zinc-400 transition-colors hover:text-zinc-200 ${STV_FOCUS_RING} rounded-md`}
        >
          ← Image to prompt
        </Link>
      </div>

      <ExtensionStvPricing />

      <ExtensionStvMarketingFooter />

      <ExtensionStvFloatingCta />
    </div>
  );
}
