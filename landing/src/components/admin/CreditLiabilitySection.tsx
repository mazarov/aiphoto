"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminExpandableCard } from "./AdminExpandableCard";
import { CreditDynamicsChart } from "./CreditDynamicsChart";
import type { CreditSeriesDay } from "@/lib/admin-credits";

type CreditItem = {
  landingUserId: string;
  email: string | null;
  displayName: string | null;
  provider: string | null;
  remaining: number;
  grantedTotal: number;
  spentTotal: number;
  sharePct: number;
  updatedAt: string;
};

type CreditsResponse = {
  summary: {
    usersWithCredits: number;
    creditsTotal: number;
    blendedRubPerCredit: number | null;
    liabilityRubEstimate: number | null;
  };
  flow: {
    days: number;
    granted: number;
    spent: number;
    refunded: number;
    series: CreditSeriesDay[];
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

export function CreditLiabilitySection({ days }: { days: number }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [state, setState] = useState({ loading: true, error: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (next?: string) => {
    setState({ loading: true, error: "" });
    try {
      const params = new URLSearchParams({ limit: "30", days: String(days) });
      if (next) params.set("cursor", next);
      if (debouncedQuery) params.set("q", debouncedQuery);
      const response = await fetch(`/api/admin/credits?${params}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({ loading: false, error: body.error || "Не удалось загрузить кредиты" });
        return;
      }
      setData((current) => next && current
        ? { ...body, items: [...current.items, ...body.items], flow: current.flow, summary: current.summary }
        : body);
      setState({ loading: false, error: "" });
    } catch {
      setState({ loading: false, error: "Ошибка сети" });
    }
  }, [days, debouncedQuery]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Сейчас на балансах</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {data ? formatCredits(data.summary.creditsTotal) : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">непотраченные кредиты</p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Начислено за период</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {data ? formatCredits(data.flow.granted) : "—"}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Потрачено за период</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {data ? formatCredits(data.flow.spent) : "—"}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Оценка обязательства</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
            {formatRub(data?.summary.liabilityRubEstimate ?? null)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            5 кр. = 2,5 ₽
            {data?.summary.blendedRubPerCredit != null
              ? ` · ${data.summary.blendedRubPerCredit.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽ / кредит`
              : ""}
          </p>
        </div>
      </div>

      <AdminExpandableCard
        title="Динамика остатка кредитов"
        summary={data ? `${formatCredits(data.summary.creditsTotal)} кр. сейчас` : "Загрузка…"}
      >
        <p className="mb-4 text-sm text-zinc-500">
          Сколько кредитов оставалось неиспользованными. Период как у обзора сверху.
        </p>
        {state.loading && !data ? <p className="text-sm text-zinc-500">Загрузка…</p>
          : state.error && !data ? <p className="text-sm text-red-600">{state.error}</p>
          : <CreditDynamicsChart series={data?.flow.series || []} />}
      </AdminExpandableCard>

      <AdminExpandableCard
        title="Разбивка по пользователям"
        summary={data
          ? `${data.items.length}${data.nextCursor ? "+" : ""} за период`
          : "Загрузка…"}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-zinc-500">
            Кто начислял или тратил кредиты за период. «Осталось» — живой баланс.
          </p>
          <label className="text-sm text-zinc-600">
            Поиск
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="email или имя"
              className="mt-1 block w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 sm:w-64"
            />
          </label>
        </div>
        {state.loading && !data ? <p className="text-sm text-zinc-500">Загрузка…</p>
          : state.error ? <p className="text-sm text-red-600">{state.error}</p>
          : !data?.items.length ? <p className="text-sm text-zinc-500">За период никто не начислял и не тратил кредиты</p>
          : <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="pb-3">Пользователь</th>
                    <th>Осталось</th>
                    <th>Доля</th>
                    <th>Начислено / потрачено</th>
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
                      <td className="align-top">
                        <p className="text-lg font-bold tabular-nums text-zinc-900">{formatCredits(row.remaining)}</p>
                        <p className="text-xs text-zinc-400">на балансе</p>
                      </td>
                      <td className="align-top">
                        <p className="tabular-nums text-zinc-800">{row.sharePct.toLocaleString("ru-RU")}%</p>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, row.sharePct)}%` }} />
                        </div>
                      </td>
                      <td className="align-top text-zinc-500">
                        <p>+{formatCredits(row.grantedTotal)} / −{formatCredits(row.spentTotal)}</p>
                        <p className="text-xs text-zinc-400">за период</p>
                      </td>
                      <td className="align-top text-zinc-500">
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
      </AdminExpandableCard>
    </section>
  );
}
