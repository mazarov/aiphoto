import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GenerationsContent } from "./GenerationsContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мои генерации — PromptShot",
  robots: { index: false, follow: false },
};

export default function GenerationsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="mb-8 text-2xl font-bold text-zinc-900">Мои генерации</h1>
        <GenerationsContent />
      </main>
      <Footer />
    </>
  );
}
