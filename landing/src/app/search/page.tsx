import { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { SearchResults } from "./SearchResults";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim();

  return {
    title: query
      ? `Поиск: ${query} — PromptShot`
      : "Поиск промптов — PromptShot",
    description: query
      ? `Результаты поиска по запросу «${query}». Готовые промпты для нейросетей.`
      : "Поиск готовых промптов для создания фото с помощью нейросетей.",
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${SITE_URL}/search`,
    },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const qs = await searchParams;
  const query = qs?.q?.trim() || "";

  return (
    <PageLayout>
      <main className="w-full px-5 py-8">
        <SearchResults initialQuery={query} />
      </main>
    </PageLayout>
  );
}
