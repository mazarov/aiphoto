"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { FinanceMonthData, FinancePnl } from "@/lib/finance-types";
import { FinanceDailyChart } from "./FinanceDailyChart";
import { FinanceModelDailyChart } from "./FinanceModelDailyChart";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatRub(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedRub(value: number): string {
  const abs = formatRub(Math.abs(value));
  return value > 0 ? `−${abs}` : value < 0 ? `+${formatRub(Math.abs(value))}` : formatRub(0);
}

function ImportMeta({ label, filename, at, email, missing }: {
  label: string;
  filename?: string;
  at?: string;
  email?: string;
  missing: boolean;
}) {
  return (
    <p className="text-xs text-zinc-500">
      {label}: {missing ? "нет импорта" : `${filename || "файл"} · ${at ? new Date(at).toLocaleString() : "—"} · ${email || ""}`}
    </p>
  );
}

function PnlRow({ label, hint, value, muted }: {
  label: string;
  hint?: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${muted ? "text-zinc-400" : "text-zinc-800"}`}>
      <div>
        <p className="text-sm">{label}</p>
        {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm tabular-nums">{value}</p>
    </div>
  );
}

function NetIncomeCard({ pnl }: { pnl: FinancePnl }) {
  return (
    <section className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Чистый доход</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{formatRub(pnl.netIncomeRub)}</p>
      <p className="mt-1 text-xs text-zinc-500">
        $1 = {pnl.usdRubRate} ₽ · налог {(pnl.taxRate * 100).toFixed(0)}% с выручки · комиссия ЮKassa из реестра
      </p>
      {pnl.missingCogs ? (
        <p className="mt-2 text-xs text-amber-700">Затраты Gemini не загружены — в расчёте 0 ₽.</p>
      ) : null}
      {pnl.netIncomeRub == null ? (
        <p className="mt-2 text-xs text-zinc-500">Чтобы увидеть чистый доход, загрузите реестр ЮKassa.</p>
      ) : (
        <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          <PnlRow
            label="Выручка"
            hint="сколько заплатили клиенты, до комиссии ЮKassa"
            value={formatRub(pnl.grossRub)}
          />
          <PnlRow
            label="Комиссия + НДС ЮKassa"
            value={pnl.yookassaFeesRub == null ? "—" : formatSignedRub(pnl.yookassaFeesRub)}
          />
          <PnlRow
            label={`Налог ${(pnl.taxRate * 100).toFixed(0)}% с выручки`}
            value={pnl.taxRub == null ? "—" : formatSignedRub(pnl.taxRub)}
          />
          <PnlRow
            label="Потрачено Gemini"
            hint={pnl.spendUsd == null ? "нет импорта" : `${formatUsd(pnl.spendUsd)} × ${pnl.usdRubRate}`}
            value={pnl.spendRub == null ? "—" : formatSignedRub(pnl.spendRub)}
            muted={pnl.spendRub == null}
          />
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <p className="text-sm font-semibold text-zinc-900">Чистый доход</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-900">{formatRub(pnl.netIncomeRub)}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function FinanceTab() {
  const { openAuthModal } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<FinanceMonthData | null>(null);
  const [state, setState] = useState({ loading: true, status: 0, error: "", message: "" });
  const [busy, setBusy] = useState<"revenue" | "cogs" | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch(`/api/admin/finance?month=${month}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null);
        setState({
          loading: false,
          status: response.status,
          error: body.error || "Не удалось загрузить финансы",
          message: "",
        });
        return;
      }
      setData(body);
      setState((current) => ({ ...current, loading: false, status: 0, error: "" }));
    } catch {
      setState({ loading: false, status: 0, error: "Ошибка сети", message: "" });
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (kind: "revenue" | "cogs", file?: File) => {
    if (!file) return;
    setBusy(kind);
    setState((current) => ({ ...current, error: "", message: "" }));
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("period", month);
      form.set("file", file);
      const response = await fetch("/api/admin/finance/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState((current) => ({
          ...current,
          error: body.message || body.error || "Не удалось импортировать файл",
        }));
        return;
      }
      setState((current) => ({
        ...current,
        message: `Загружено ${body.rowCount ?? 0} строк (${kind === "revenue" ? "поступления" : "затраты"})`,
      }));
      await load();
    } catch {
      setState((current) => ({ ...current, error: "Ошибка сети при импорте" }));
    } finally {
      setBusy(null);
    }
  };

  if (state.status === 401 || state.status === 403) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">
          {state.status === 401 ? "Нужен вход" : "Доступ запрещён"}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {state.status === 401 ? "Войдите через PromptShot." : "Ваш email не включён в allowlist."}
        </p>
        {state.status === 401 && (
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Войти
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Финансы</h1>
        <p className="mt-1 text-sm text-zinc-500">Поступления, затраты Gemini и чистый доход</p>
      </header>
      <section className={`${card} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
        <label className="text-sm text-zinc-600">
          Месяц
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="mt-1 block rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <p className="text-xs text-zinc-500">
          Курс Gemini: $1 = 90 ₽ (статика). Налог: 6% с выручки.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h2 className="font-semibold text-zinc-900">Поступления ЮKassa</h2>
          <p className="mt-1 text-sm text-zinc-500">CSV или ZIP реестра за месяц. Gross / комиссия / net.</p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            {busy === "revenue" ? "Загрузка…" : "Загрузить реестр"}
            <input type="file" accept=".csv,.zip,text/csv,application/zip" className="hidden"
              disabled={busy !== null}
              onChange={(event) => { void upload("revenue", event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <div className="mt-3">
            <ImportMeta
              label="Последний импорт"
              missing={!data?.revenue}
              filename={data?.revenue?.import.sourceFilename}
              at={data?.revenue?.import.updatedAt}
              email={data?.revenue?.import.uploadedByEmail}
            />
          </div>
        </div>
        <div className={card}>
          <h2 className="font-semibold text-zinc-900">Затраты Gemini</h2>
          <p className="mt-1 text-sm text-zinc-500">CSV Google Cloud Billing. Subtotal $ × 90 ₽.</p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            {busy === "cogs" ? "Загрузка…" : "Загрузить billing CSV"}
            <input type="file" accept=".csv,text/csv" className="hidden"
              disabled={busy !== null}
              onChange={(event) => { void upload("cogs", event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <div className="mt-3">
            <ImportMeta
              label="Последний импорт"
              missing={!data?.cogs}
              filename={data?.cogs?.import.sourceFilename}
              at={data?.cogs?.import.updatedAt}
              email={data?.cogs?.import.uploadedByEmail}
            />
          </div>
        </div>
      </section>

      {state.message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.message}</p>}
      {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state.loading && !data ? <p className="text-sm text-zinc-500">Загрузка…</p> : data && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Выручка", formatRub(data.revenue?.kpi.gross ?? null), "заплатили клиенты"],
            ["После комиссии ЮKassa", formatRub(data.revenue?.kpi.net ?? null), "то, что в кабинете ЮKassa часто называют выручкой"],
            ["Налог 6% с выручки", formatRub(data.pnl.taxRub), "считается с суммы клиентов, не с net"],
            ["Потрачено Gemini", formatRub(data.pnl.spendRub), data.pnl.spendUsd != null ? `${formatUsd(data.pnl.spendUsd)} × ${data.pnl.usdRubRate}` : null],
          ].map(([label, value, hint]) => (
            <div key={label} className={card}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
              {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
            </div>
          ))}
        </section>
        <NetIncomeCard pnl={data.pnl} />
        <section className={card}>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">Динамика по дням</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Выручка, косты и чистая прибыль. Пунктир — накопленные обязательства сейчас
                {data.liability.creditsTotal
                  ? ` (${data.liability.creditsTotal.toLocaleString("ru-RU")} кр., 5 кр. = 2,5 ₽)`
                  : " (5 кр. = 2,5 ₽)"}.
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-amber-800">
              {formatRub(data.liability.liabilityRubEstimate)}
            </p>
          </div>
          <FinanceDailyChart
            series={data.daily || []}
            liabilityRub={data.liability?.liabilityRubEstimate ?? null}
          />
        </section>
        <section className={card}>
          <h2 className="font-semibold text-zinc-900">Затраты на модели</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-500">
            Динамика Gemini по семействам. $1 = 90 ₽.
          </p>
          <FinanceModelDailyChart series={data.modelDaily || []} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Поступления по дням</h2>
            {!data.revenue?.daily.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">День</th><th>Gross</th><th>Net</th><th>Платежей</th></tr>
                </thead>
                <tbody>
                  {data.revenue.daily.map((row) => (
                    <tr key={row.day} className="border-t border-zinc-100">
                      <td className="py-2">{row.day}</td>
                      <td className="tabular-nums">{formatRub(row.gross)}</td>
                      <td className="tabular-nums">{formatRub(row.net)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Затраты по дням</h2>
            {!data.cogs?.daily.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">День</th><th>USD</th><th>RUB</th></tr>
                </thead>
                <tbody>
                  {data.cogs.daily.map((row) => (
                    <tr key={row.day} className="border-t border-zinc-100">
                      <td className="py-2">{row.day}</td>
                      <td className="tabular-nums">{formatUsd(row.subtotalUsd)}</td>
                      <td className="tabular-nums">{formatRub(row.subtotalRub)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Поступления по типу оплаты</h2>
            {!data.revenue?.byType.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">Тип</th><th>Net</th><th>Платежей</th></tr>
                </thead>
                <tbody>
                  {data.revenue.byType.map((row) => (
                    <tr key={row.paymentType} className="border-t border-zinc-100">
                      <td className="py-2">{row.paymentType}</td>
                      <td className="tabular-nums">{formatRub(row.net)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Затраты по семейству модели</h2>
            {!data.cogs?.byFamily.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">Семейство</th><th>USD</th><th>RUB</th></tr>
                </thead>
                <tbody>
                  {data.cogs.byFamily.map((row) => (
                    <tr key={row.family} className="border-t border-zinc-100">
                      <td className="py-2">{row.label}</td>
                      <td className="tabular-nums">{formatUsd(row.subtotalUsd)}</td>
                      <td className="tabular-nums">{formatRub(row.subtotalRub)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-4 font-semibold text-zinc-900">Топ SKU Gemini</h2>
          {!data.cogs?.bySku.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">SKU</th><th>USD</th><th>RUB</th></tr>
                </thead>
                <tbody>
                  {data.cogs.bySku.map((row) => (
                    <tr key={row.skuId} className="border-t border-zinc-100">
                      <td className="py-2">
                        <p className="text-zinc-800">{row.skuDescription}</p>
                        <p className="font-mono text-xs text-zinc-400">{row.skuId}</p>
                      </td>
                      <td className="tabular-nums">{formatUsd(row.subtotalUsd)}</td>
                      <td className="tabular-nums">{formatRub(row.subtotalRub)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>}
    </div>
  );
}
