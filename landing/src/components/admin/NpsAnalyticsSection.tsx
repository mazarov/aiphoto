"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { NpsAnalyticsDashboard, NpsDailyRow } from "@/lib/nps-analytics-data";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

const TRIGGER_LABEL: Record<string, string> = {
  after_2: "После 2 генераций",
  credits_empty: "Кредиты кончились",
};

function formatCount(value: number): string {
  return value.toLocaleString("ru-RU");
}

function formatRate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatScore(value: number | null): string {
  return value == null ? "—" : value.toFixed(1).replace(".", ",");
}

function AccessMessage({ status }: { status: number }) {
  const { openAuthModal } = useAuth();
  return (
    <div className={`${card} mx-auto max-w-lg text-center`}>
      <h2 className="text-xl font-semibold text-zinc-900">
        {status === 401 ? "Нужен вход" : "Доступ запрещён"}
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        {status === 401
          ? "Войдите через PromptShot с разрешённым аккаунтом."
          : "Аккаунт отсутствует в ANALYTICS_ADMIN_EMAILS."}
      </p>
      {status === 401 && (
        <button
          onClick={() => openAuthModal()}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Войти
        </button>
      )}
    </div>
  );
}

function NpsDailyChart({ rows }: { rows: NpsDailyRow[] }) {
  const series = rows.filter((row) => row.day);
  const max = Math.max(1, ...series.map((row) => Math.max(row.sent, row.responses)));
  if (!series.length) {
    return <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Нет данных</div>;
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Отправлено
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ответы
        </span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex h-52 min-w-[520px] items-end gap-2">
          {series.map((row) => (
            <div key={row.day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">
                {row.avg_score == null ? row.sent : formatScore(row.avg_score)}
              </span>
              <div className="flex h-40 w-full items-end justify-center gap-0.5">
                <i
                  className="w-1.5 rounded-sm bg-indigo-600"
                  style={{ height: Math.max(3, (row.sent / max) * 160) }}
                  title={`Отправлено: ${row.sent}`}
                />
                <i
                  className="w-1.5 rounded-sm bg-emerald-500"
                  style={{ height: Math.max(2, (row.responses / max) * 160) }}
                  title={`Ответы: ${row.responses}`}
                />
              </div>
              <span className="text-xs text-zinc-400">{row.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Столбцы — письма и ответы за день (Москва). Число сверху — средний балл дня или число писем,
        если ответов ещё нет.
      </p>
    </div>
  );
}

export function NpsAnalyticsSection({ days }: { days: number }) {
  const { user } = useAuth();
  const [data, setData] = useState<NpsAnalyticsDashboard | null>(null);
  const [state, setState] = useState({ loading: true, status: 0, error: "" });

  const load = useCallback(async () => {
    setState({ loading: true, status: 0, error: "" });
    try {
      const response = await fetch(`/api/admin/nps?days=${days}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null);
        setState({
          loading: false,
          status: response.status,
          error: body.error || "Не удалось загрузить оценки",
        });
        return;
      }
      setData(body as NpsAnalyticsDashboard);
      setState({ loading: false, status: 0, error: "" });
    } catch {
      setState({ loading: false, status: 0, error: "Ошибка сети" });
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load, user]);

  if (state.status === 401 || state.status === 403) {
    return <AccessMessage status={state.status} />;
  }

  const summary = data?.summary;
  const totalAnswers =
    (summary?.promoters || 0) + (summary?.passives || 0) + (summary?.detractors || 0);

  return (
    <>
      {state.loading && !data ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : state.error ? (
        <div className={`${card} text-red-600`}>{state.error}</div>
      ) : data && summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Отправлено", formatCount(summary.sent)],
              ["Ответы", formatCount(summary.responses)],
              ["Response rate", formatRate(summary.responseRate)],
              ["Средний балл", formatScore(summary.avgScore)],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{value}</p>
              </div>
            ))}
          </section>
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["9–10", summary.promoters],
              ["7–8", summary.passives],
              ["1–6", summary.detractors],
            ].map(([label, value]) => (
              <div key={String(label)} className={card}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
                  {formatCount(Number(value))}
                  <span className="ml-2 text-sm font-medium text-zinc-400">
                    {formatRate(totalAnswers ? Number(value) / totalAnswers : 0)}
                  </span>
                </p>
              </div>
            ))}
          </section>
          <section className={card}>
            <h2 className="mb-5 font-semibold text-zinc-900">Динамика по дням</h2>
            <NpsDailyChart rows={data.daily} />
          </section>
          <section className={card}>
            <h2 className="font-semibold text-zinc-900">Оценки по пользователям</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Письма и ответы за выбранный период. Повтор по той же ссылке обновляет строку.
            </p>
            {!data.responses.length ? (
              <p className="mt-4 text-sm text-zinc-500">За период нет писем и ответов</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-zinc-400">
                    <tr>
                      <th className="pb-3">Email</th>
                      <th>Триггер</th>
                      <th>Письмо</th>
                      <th>Оценка</th>
                      <th>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.responses.map((row) => (
                      <tr key={row.survey_id} className="border-t border-zinc-100 align-top">
                        <td className="py-3 font-medium text-zinc-800">{row.email || "—"}</td>
                        <td>{TRIGGER_LABEL[row.trigger] || row.trigger}</td>
                        <td className="text-zinc-500">
                          {row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}
                        </td>
                        <td className="font-semibold tabular-nums">{row.score ?? "—"}</td>
                        <td className="max-w-sm whitespace-pre-wrap text-zinc-600">
                          {row.comment || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
