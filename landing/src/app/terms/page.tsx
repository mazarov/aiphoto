import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Публичная оферта — PromptShot",
  description: "Условия использования и оплаты сервиса PromptShot.",
  robots: "noindex, follow",
};

export default function TermsPage() {
  const documentAvailable = fs.existsSync(path.join(process.cwd(), "public", "docs", "offer.pdf"));

  return (
    <LegalDocumentPage
      eyebrow="Юридическая информация"
      title="Публичная оферта"
      description="Полные условия использования сервиса, покупки токенов и оказания услуг опубликованы в официальном документе PromptShot."
      documentHref="/docs/offer.pdf"
      documentAvailable={documentAvailable}
    />
  );
}
