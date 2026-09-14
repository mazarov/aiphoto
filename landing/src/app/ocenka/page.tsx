import type { Metadata } from "next";
import { OcenkaForm } from "@/components/OcenkaForm";
import { PageLayout } from "@/components/PageLayout";
import { parseNpsScore, verifyNpsToken } from "@/lib/nps-token";

export const metadata: Metadata = {
  title: "Оценка PromptShot",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OcenkaPage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string; s?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const token = typeof params.t === "string" ? params.t : "";
  const surveyId = verifyNpsToken(token);
  const initialScore = parseNpsScore(params.s);

  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PromptShot</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Насколько сервис полезен?</h1>
        {!surveyId ? (
          <p className="mt-4 text-sm text-zinc-600">
            Ссылка недействительна или устарела. Если письмо ещё открыто — перейдите по оценке
            ещё раз из него.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-zinc-600">
              Оцените от 1 до 10, насколько готовы порекомендовать PromptShot друзьям.
              Комментарий необязателен.
            </p>
            <OcenkaForm token={token} initialScore={initialScore} />
          </>
        )}
      </main>
    </PageLayout>
  );
}
