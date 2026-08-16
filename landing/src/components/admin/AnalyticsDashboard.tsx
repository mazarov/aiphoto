"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { AnalyticsDashboardData } from "@/lib/analytics-data";
import { AdminExpandableCard } from "./AdminExpandableCard";
import { ClientsDailyChart } from "./ClientsDailyChart";
import { CreditLiabilitySection } from "./CreditLiabilitySection";
import { CLIENT_SOURCES_ORDER, clientSourceLabel } from "./analytics-constants";

const PERIODS = [{ value: 1, label: "Сегодня" }, { value: 7, label: "7 дней" },
  { value: 30, label: "30 дней" }, { value: 90, label: "90 дней" }];
const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

function AccessMessage({ status }: { status: number }) {
  const { openAuthModal } = useAuth();
  return <div className={`${card} mx-auto max-w-lg text-center`}>
    <h1 className="text-xl font-semibold text-zinc-900">{status === 401 ? "Нужен вход" : "Доступ запрещён"}</h1>
    <p className="mt-2 text-sm text-zinc-500">
      {status === 401 ? "Войдите через PromptShot с разрешённым аккаунтом." : "Аккаунт отсутствует в ANALYTICS_ADMIN_EMAILS."}
    </p>
    {status === 401 && <button onClick={() => openAuthModal()}
      className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
      Войти
    </button>}
  </div>;
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [kind, setKind] = useState("all");
  const [source, setSource] = useState("all");
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [state, setState] = useState({ loading: true, status: 0, error: "" });
  const load = useCallback(async () => {
    setState({ loading: true, status: 0, error: "" });
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null); setState({ loading: false, status: response.status, error: body.error || "Ошибка загрузки" });
      } else {
        setData(body); setState({ loading: false, status: 0, error: "" });
      }
    } catch {
      setState({ loading: false, status: 0, error: "Ошибка сети" });
    }
  }, [days]);
  useEffect(() => { void load(); }, [load, user]);

  const totals = useMemo(() => {
    const sum = (key: string) => (data?.extensionOutcomes || [])
      .reduce((value, row) => value + Number((row as unknown as Record<string, number>)[key] || 0), 0);
    return { requests: sum("requests"), success: sum("success"), limited: sum("rate_limited"), errors: sum("upstream_error") + sum("empty_response") };
  }, [data]);
  if (state.status === 401 || state.status === 403) return <AccessMessage status={state.status} />;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Аналитика</h1>
        <p className="mt-1 text-sm text-zinc-500">Пользователи, клиенты, запросы и непотраченные кредиты</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/analyze-history" className="mr-2 text-sm font-semibold text-indigo-600">История и публикации →</Link>
        {PERIODS.map((period) => <button key={period.value} onClick={() => setDays(period.value)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold ${days === period.value ? "bg-indigo-600 text-white" : "border border-zinc-200 bg-white text-zinc-600"}`}>
          {period.label}
        </button>)}
      </div>
    </header>
    {state.loading && !data ? <p className="text-sm text-zinc-500">Загрузка…</p> : state.error ? <div className={`${card} text-red-600`}>{state.error}</div> : data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Всего пользователей", data.summary.totalUsers],
          ["Активные", data.summary.activeUsersInPeriod],
          ["Запросы", data.summary.requestsInPeriod],
          ["Генерации / анализы", `${data.summary.generationsInPeriod} / ${data.summary.analyzesInPeriod}`],
        ].map(([label, value]) => <div key={label} className={card}><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{value}</p></div>)}
      </section>
      <CreditLiabilitySection days={days} />
      <section className={card}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-900">Запросы по клиентам</h2>
          <div className="flex flex-wrap gap-2">
            {["all", "generation", "analyze"].map((item) => <button key={item} onClick={() => setKind(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${kind === item ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>{item}</button>)}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {["all", ...CLIENT_SOURCES_ORDER].map((item) => <button key={item} onClick={() => setSource(item)}
            className={`rounded-full px-3 py-1 text-xs ${source === item ? "bg-indigo-100 font-semibold text-indigo-700" : "text-zinc-500 hover:bg-zinc-100"}`}>
            {item === "all" ? "Все клиенты" : clientSourceLabel(item)}
          </button>)}
        </div>
        <ClientsDailyChart rows={data.clientsDaily} kind={kind} source={source} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Backend requests", totals.requests], ["Успешно", totals.success], ["Rate limited", totals.limited], ["Ошибки", totals.errors]]
          .map(([label, value]) => <div key={label} className={card}><p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p></div>)}
      </section>
      <AdminExpandableCard
        title="Топ пользователей"
        summary={data.topUsers.length ? `${data.topUsers.length} за период` : "Нет запросов"}
      >
        <p className="mb-4 text-sm text-zinc-500">Запросы за выбранный период, не за всё время.</p>
        {!data.topUsers.length ? <p className="text-sm text-zinc-500">За период нет запросов</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-xs uppercase text-zinc-400"><tr><th className="pb-3">Email</th><th>Всего</th><th>Генерации</th><th>Анализы</th><th>Последняя активность</th></tr></thead>
          <tbody>{data.topUsers.map((row, index) => <tr key={`${row.email}-${index}`} className="border-t border-zinc-100">
            <td className="py-3 font-medium text-zinc-800">{row.email || "—"}</td><td>{row.total_requests}</td>
            <td>{row.generations}</td><td>{row.analyzes}</td><td className="text-zinc-500">{row.last_seen ? new Date(row.last_seen).toLocaleString() : "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      </AdminExpandableCard>
      <AdminExpandableCard
        title="Последние analyze-события"
        summary={data.recentEvents.length ? `${data.recentEvents.length} событий` : "Нет событий"}
      >
        {!data.recentEvents.length ? <p className="text-sm text-zinc-500">За период нет событий</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-zinc-400"><tr><th className="pb-3">Время</th><th>Клиент</th><th>Outcome</th><th>Ошибка</th><th>Latency</th><th>Correlation</th></tr></thead>
          <tbody>{data.recentEvents.map((row, index) => <tr key={`${row.created_at}-${index}`} className="border-t border-zinc-100">
            <td className="py-3">{new Date(row.created_at).toLocaleString()}</td><td>{clientSourceLabel(row.client_source)}</td>
            <td>{row.outcome || "—"}</td><td className="font-mono text-xs text-zinc-500">{row.error_code || "—"}</td>
            <td>{row.latency_ms == null ? "—" : `${row.latency_ms} ms`}</td><td className="font-mono text-xs">{row.correlation_id?.slice(0, 8) || "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      </AdminExpandableCard>
    </>}
  </div>;
}
