import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/PageLayout";
import { verifyMailUnsubscribeToken } from "@/lib/mail-unsubscribe";
import { createSupabaseServer } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Отписка от рассылок — PromptShot",
  robots: { index: false, follow: false, nocache: true },
};

async function unsubscribeAction(formData: FormData) {
  "use server";
  const token = String(formData.get("t") || "");
  const email = verifyMailUnsubscribeToken(token);
  if (!email) redirect("/unsubscribe?error=1");
  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc("landing_mail_unsubscribe", { p_email: email });
  if (error) redirect(`/unsubscribe?t=${encodeURIComponent(token)}&error=1`);
  redirect(`/unsubscribe?t=${encodeURIComponent(token)}&done=1`);
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string; done?: string; error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const token = typeof params.t === "string" ? params.t : "";
  const done = params.done === "1";
  const failed = params.error === "1";
  const email = token ? verifyMailUnsubscribeToken(token) : null;
  const invalid = Boolean(token) && !email && !failed;

  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Рассылки PromptShot</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Отписка от маркетинговых писем</h1>
        {done ? (
          <p className="mt-4 text-sm text-zinc-600">
            Готово. На этот адрес больше не будут уходить рекламные письма PromptShot.
            Транзакционные письма об оплате и токенах могут приходить и дальше.
          </p>
        ) : failed || invalid || !token ? (
          <p className="mt-4 text-sm text-zinc-600">
            Ссылка недействительна или устарела. Если письмо ещё приходит, ответьте на него —
            поможем вручную.
          </p>
        ) : (
          <form action={unsubscribeAction} className="mt-6 space-y-4">
            <input type="hidden" name="t" value={token} />
            <p className="text-sm text-zinc-600">
              Отписать этот адрес от новостей и акций PromptShot? Письма о зачислении токенов
              это не отключит.
            </p>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Отписаться
            </button>
          </form>
        )}
      </main>
    </PageLayout>
  );
}
