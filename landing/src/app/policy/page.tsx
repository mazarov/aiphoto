import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export const metadata: Metadata = {
  title: "Политика обработки данных — PromptShot",
  description: "Политика обработки и защиты персональных данных пользователей PromptShot.",
  robots: "noindex, follow",
};

export default function PolicyPage() {
  const documentAvailable = fs.existsSync(path.join(process.cwd(), "public", "docs", "privacy.pdf"));

  return (
    <LegalDocumentPage
      eyebrow="Юридическая информация"
      title="Политика обработки данных"
      description="Порядок сбора, использования, хранения и защиты персональных данных описан в официальном документе PromptShot."
      documentHref="/docs/privacy.pdf"
      documentAvailable={documentAvailable}
    />
  );
}
