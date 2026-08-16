"use client";

import { useCallback, useEffect, useState } from "react";
import type { FinanceMonthData } from "@/lib/finance-types";

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

export function FinanceTab() {
  const [month, setMonth] = useState(currentMonth);
  const [rate, setRate] = useState("");
  const [data, setData] = useState<FinanceMonthData | null>(null);
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const [busy, setBusy] = useState<"revenue" | "cogs" | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch(`/api/admin/finance?month=${month}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setData(null);
        setState({ loading: false, error: body.error || "Не удалось загрузить финансы", message: "" });
        return;
      }
      setData(body);
      if (body.usdRubRate != null) {
        setRate((current) => current || String(body.usdRubRate));
      }
      setState((current) => ({ ...current, loading: false, error: "" }));
    } catch {
      setState({ loading: false, error: "Ошибка сети", message: "" });
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
      if (rate.trim()) form.set("usdRubRate", rate.trim());
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

  return (
    <div className="space-y-6">
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
        <label className="text-sm text-zinc-600">
          Курс USD/RUB (оценка маржи)
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            placeholder="необязательно"
            className="mt-1 block rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
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
          <p className="mt-1 text-sm text-zinc-500">CSV Google Cloud Billing Account Report. Subtotal $.</p>
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
            ["Получено gross", formatRub(data.revenue?.kpi.gross ?? null)],
            ["Комиссия + НДС", formatRub(data.revenue ? data.revenue.kpi.commission + data.revenue.kpi.vat : null)],
            ["Получено net", formatRub(data.revenue?.kpi.net ?? null)],
            ["Потрачено Gemini", formatUsd(data.cogs?.kpi.subtotalUsd ?? null)],
          ].map(([label, value]) => (
            <div key={label} className={card}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
            </div>
          ))}
        </section>
        {(data.spendRubEstimate != null || data.marginRubEstimate != null) && (
          <section className="grid gap-4 sm:grid-cols-2">
            <div className={card}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Затраты в RUB (оценка)</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{formatRub(data.spendRubEstimate)}</p>
              <p className="mt-1 text-xs text-zinc-500">курс {data.usdRubRate}</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Маржа net − spend (оценка)</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{formatRub(data.marginRubEstimate)}</p>
            </div>
          </section>
        )}

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
                  <tr><th className="pb-2">День</th><th>USD</th></tr>
                </thead>
                <tbody>
                  {data.cogs.daily.map((row) => (
                    <tr key={row.day} className="border-t border-zinc-100">
                      <td className="py-2">{row.day}</td>
                      <td className="tabular-nums">{formatUsd(row.subtotalUsd)}</td>
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
                  <tr><th className="pb-2">Семейство</th><th>USD</th></tr>
                </thead>
                <tbody>
                  {data.cogs.byFamily.map((row) => (
                    <tr key={row.family} className="border-t border-zinc-100">
                      <td className="py-2">{row.label}</td>
                      <td className="tabular-nums">{formatUsd(row.subtotalUsd)}</td>
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
                  <tr><th className="pb-2">SKU</th><th>USD</th></tr>
                </thead>
                <tbody>
                  {data.cogs.bySku.map((row) => (
                    <tr key={row.skuId} className="border-t border-zinc-100">
                      <td className="py-2">
                        <p className="text-zinc-800">{row.skuDescription}</p>
                        <p className="font-mono text-xs text-zinc-400">{row.skuId}</p>
                      </td>
                      <td className="tabular-nums">{formatUsd(row.subtotalUsd)}</td>
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
