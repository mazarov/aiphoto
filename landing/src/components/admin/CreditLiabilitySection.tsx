"use client";

import { useCallback, useEffect, useState } from "react";

type CreditItem = {
  landingUserId: string;
  email: string | null;
  displayName: string | null;
  provider: string | null;
  credits: number;
  updatedAt: string;
};

type CreditsResponse = {
  summary: {
    usersWithCredits: number;
    creditsTotal: number;
    blendedRubPerCredit: number | null;
    liabilityRubEstimate: number | null;
  };
  items: CreditItem[];
  nextCursor: string | null;
};

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

function formatCredits(value: number): string {
  return value.toLocaleString("ru-RU");
}

function formatRub(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

export function CreditLiabilitySection() {
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [state, setState] = useState({ loading: true, error: "" });

  const load = useCallback(async (next?: string) => {
    setState({ loading: true, error: "" });
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/credits?${params}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({ loading: false, error: body.error || "Не удалось загрузить кредиты" });
        return;
      }
      setData((current) => next && current
        ? { ...body, items: [...current.items, ...body.items] }
        : body);
      setState({ loading: false, error: "" });
    } catch {
      setState({ loading: false, error: "Ошибка сети" });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Непотраченные кредиты</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {data ? formatCredits(data.summary.creditsTotal) : "—"}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Пользователей с балансом</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {data ? formatCredits(data.summary.usersWithCredits) : "—"}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Оценка обязательства</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {formatRub(data?.summary.liabilityRubEstimate ?? null)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {data?.summary.blendedRubPerCredit != null
              ? `${data.summary.blendedRubPerCredit.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽ / кредит по боевым YooKassa`
              : "Нет боевых начислений для оценки"}
          </p>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-4 font-semibold text-zinc-900">Пользователи с непотраченными кредитами</h2>
        {state.loading && !data ? <p className="text-sm text-zinc-500">Загрузка…</p>
          : state.error ? <p className="text-sm text-red-600">{state.error}</p>
          : !data?.items.length ? <p className="text-sm text-zinc-500">Ни у кого нет кредитов на балансе</p>
          : <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="pb-3">Пользователь</th>
                    <th>Кредиты</th>
                    <th>Провайдер</th>
                    <th>Обновлён</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.landingUserId} className="border-t border-zinc-100">
                      <td className="py-3">
                        <p className="font-medium text-zinc-800">{row.email || row.displayName || "—"}</p>
                        {row.email && row.displayName && row.displayName !== row.email
                          && <p className="text-xs text-zinc-500">{row.displayName}</p>}
                      </td>
                      <td className="tabular-nums font-semibold">{formatCredits(row.credits)}</td>
                      <td className="text-zinc-500">{row.provider || "—"}</td>
                      <td className="text-zinc-500">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.nextCursor && (
              <button
                type="button"
                disabled={state.loading}
                onClick={() => void load(data.nextCursor!)}
                className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
              >
                {state.loading ? "Загрузка…" : "Показать ещё"}
              </button>
            )}
          </>}
      </div>
    </section>
  );
}
