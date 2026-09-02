"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  FINANCE_COGS_PROVIDER_LABELS,
  type FinanceAdsSource,
  type FinanceCogsSource,
  type FinanceMonthData,
  type FinancePnl,
  type FinanceRevenueSource,
} from "@/lib/finance-types";
import { YANDEX_TWO_CLUSTER_LAUNCH } from "@/lib/yandex-two-cluster-launch";
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

function formatInt(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("ru-RU");
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}

function formatRatio(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
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

function sourceLabel(kind: "revenue" | "cogs" | "ads", source: FinanceRevenueSource | FinanceCogsSource | FinanceAdsSource | null | undefined): string {
  if (kind === "revenue") return source === "csv" ? "реестр CSV" : source === "live_ledger" ? "live ledger" : "нет данных";
  if (kind === "cogs") return source === "csv" ? "GCP CSV" : source === "estimate" ? "оценка по генерациям" : "нет данных";
  return source === "csv" ? "CSV Директа" : source === "direct_api" ? "Direct API" : "нет данных";
}

function NetIncomeCard({ pnl }: { pnl: FinancePnl }) {
  return (
    <section className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Операционная маржа</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{formatRub(pnl.operatingRub)}</p>
      <p className="mt-1 text-xs text-zinc-500">
        $1 = {pnl.usdRubRate} ₽ · налог {(pnl.taxRate * 100).toFixed(0)}% с выручки · без рекламы
        {pnl.revenueSource === "live_ledger" ? " · комиссия ЮKassa оценка 3,5%+НДС" : " · комиссия ЮKassa из реестра"}
      </p>
      {pnl.missingCogs ? (
        <p className="mt-2 text-xs text-amber-700">Затраты AI не загружены — в расчёте 0 ₽.</p>
      ) : null}
      {pnl.operatingRub == null ? (
        <p className="mt-2 text-xs text-zinc-500">Нет выручки за месяц.</p>
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
            label="Google"
            hint={formatUsd(pnl.cogsByProviderRub.google / pnl.usdRubRate)}
            value={formatSignedRub(pnl.cogsByProviderRub.google)}
            muted={!pnl.cogsByProviderRub.google}
          />
          <PnlRow
            label={FINANCE_COGS_PROVIDER_LABELS.xai}
            hint={formatUsd(pnl.cogsByProviderRub.xai / pnl.usdRubRate)}
            value={formatSignedRub(pnl.cogsByProviderRub.xai)}
            muted={!pnl.cogsByProviderRub.xai}
          />
          <PnlRow
            label={FINANCE_COGS_PROVIDER_LABELS.openrouter}
            hint={formatUsd(pnl.cogsByProviderRub.openrouter / pnl.usdRubRate)}
            value={formatSignedRub(pnl.cogsByProviderRub.openrouter)}
            muted={!pnl.cogsByProviderRub.openrouter}
          />
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <p className="text-sm font-semibold text-zinc-900">Операционная маржа</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-900">{formatRub(pnl.operatingRub)}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function AfterAdsCard({ pnl }: { pnl: FinancePnl }) {
  return (
    <section className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">После Директа</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{formatRub(pnl.afterAdsRub)}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Операционная маржа − расход кабинета × 1,22. Кабинет без НДС.
      </p>
      {pnl.missingAds ? (
        <p className="mt-2 text-xs text-amber-700">Директ не подтянут — в итоге 0 ₽ рекламы.</p>
      ) : null}
      {pnl.afterAdsRub == null ? (
        <p className="mt-2 text-xs text-zinc-500">Нет выручки за месяц.</p>
      ) : (
        <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          <PnlRow label="Операционная маржа" value={formatRub(pnl.operatingRub)} />
          <PnlRow
            label="Директ без НДС"
            value={pnl.adsCabinetRub == null ? "—" : formatSignedRub(pnl.adsCabinetRub)}
          />
          <PnlRow
            label="НДС 22% на Директ"
            value={pnl.adsVatRub == null ? "—" : formatSignedRub(pnl.adsVatRub)}
          />
          <PnlRow
            label="Директ с НДС"
            value={pnl.adsWithVatRub == null ? "—" : formatSignedRub(pnl.adsWithVatRub)}
          />
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <p className="text-sm font-semibold text-zinc-900">Итог после Директа</p>
            <p className="text-sm font-semibold tabular-nums text-zinc-900">{formatRub(pnl.afterAdsRub)}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function CsvToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <fieldset className="text-sm text-zinc-600">
      <legend className="mb-1">Тянуть данные из CSV</legend>
      <div className="inline-flex rounded-xl border border-zinc-200 p-0.5">
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange(false)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            !value ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          Нет
        </button>
        <button
          type="button"
          aria-pressed={value}
          onClick={() => onChange(true)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            value ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          Да
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {value
          ? "Реестры ЮKassa / GCP / CSV Директа перекрывают live, если загружены."
          : "Внутренний расчёт: ledger ЮKassa, генерации × прайс, Директ API."}
      </p>
    </fieldset>
  );
}

export function FinanceTab() {
  const { openAuthModal } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [useCsv, setUseCsv] = useState(false);
  const [data, setData] = useState<FinanceMonthData | null>(null);
  const [state, setState] = useState({ loading: true, status: 0, error: "", message: "" });
  const [busy, setBusy] = useState<"revenue" | "cogs" | "ads" | "sync" | null>(null);

  const load = useCallback(async (csvOverride = useCsv) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch(
        `/api/admin/finance?month=${month}&csv=${csvOverride ? "1" : "0"}`,
        { credentials: "include" },
      );
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
  }, [month, useCsv]);

  useEffect(() => { void load(); }, [load]);

  const syncDirect = async () => {
    setBusy("sync");
    setState((current) => ({ ...current, error: "", message: "" }));
    try {
      const response = await fetch("/api/admin/finance/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState((current) => ({
          ...current,
          error: body.message || body.error || "Не удалось обновить Директ",
        }));
        return;
      }
      if (body.ads === "missing_token") {
        setState((current) => ({
          ...current,
          error: "Нет YANDEX_DIRECT_TOKEN в env лендинга",
        }));
        return;
      }
      setState((current) => ({
        ...current,
        message: `Директ: ${body.rowCount ?? 0} строк`,
      }));
      await load();
    } catch {
      setState((current) => ({ ...current, error: "Ошибка сети при обновлении Директа" }));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (kind: "revenue" | "cogs" | "ads", file?: File) => {
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
        message: `Загружено ${body.rowCount ?? 0} строк (${
          kind === "revenue" ? "поступления" : kind === "cogs" ? "затраты" : "Директ"
        })`,
      }));
      setUseCsv(true);
      await load(true);
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

  const deliveryRows = data?.acquisition?.delivery.length
    ? data.acquisition.delivery
    : (data?.ads?.daily || []).map((row) => ({
        day: row.day,
        spendRub: row.costRub,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        cpc: row.cpc,
        payments: null,
        revenueRub: null,
      }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Финансы</h1>
        <p className="mt-1 text-sm text-zinc-500">
          По умолчанию внутренний P&amp;L. CSV — только если включить переключатель.
        </p>
      </header>
      <section className={`${card} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <label className="text-sm text-zinc-600">
            Месяц
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 block rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <CsvToggle value={useCsv} onChange={setUseCsv} />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-xs text-zinc-500">
            Курс: $1 = 90 ₽. Налог: 6% с выручки. Директ в P&amp;L × 1,22.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => { void syncDirect(); }}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
          >
            {busy === "sync" ? "Обновляю Директ…" : "Обновить Директ"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <h2 className="font-semibold text-zinc-900">Поступления ЮKassa</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {useCsv ? "CSV включён: реестр перекрывает live." : "CSV выкл.: live ledger + оценка комиссии 3,5%+НДС."}
            {" "}Источник: {sourceLabel("revenue", data?.revenue?.source ?? data?.pnl.revenueSource)}
          </p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            {busy === "revenue" ? "Загрузка…" : "Загрузить реестр"}
            <input type="file" accept=".csv,.zip,text/csv,application/zip" className="hidden"
              disabled={busy !== null}
              onChange={(event) => { void upload("revenue", event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <div className="mt-3">
            <ImportMeta
              label={!useCsv && data?.csvAvailable.revenue ? "CSV есть, в расчёте не участвует" : "Последний импорт"}
              missing={!(data?.revenue?.import || (!useCsv && data?.csvAvailable.revenue))}
              filename={(data?.revenue?.import || data?.csvAvailable.revenue)?.sourceFilename}
              at={(data?.revenue?.import || data?.csvAvailable.revenue)?.updatedAt}
              email={(data?.revenue?.import || data?.csvAvailable.revenue)?.uploadedByEmail}
            />
          </div>
        </div>
        <div className={card}>
          <h2 className="font-semibold text-zinc-900">Затраты Gemini</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {useCsv ? "CSV включён: GCP перекрывает оценку." : "CSV выкл.: генерации × прайс моделей."}
            {" "}Источник: {sourceLabel("cogs", data?.cogs?.source ?? data?.pnl.cogsSource)}
          </p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            {busy === "cogs" ? "Загрузка…" : "Загрузить billing CSV"}
            <input type="file" accept=".csv,text/csv" className="hidden"
              disabled={busy !== null}
              onChange={(event) => { void upload("cogs", event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <div className="mt-3">
            <ImportMeta
              label={!useCsv && data?.csvAvailable.cogs ? "CSV есть, в расчёте не участвует" : "Последний импорт"}
              missing={!(data?.cogs?.import || (!useCsv && data?.csvAvailable.cogs))}
              filename={(data?.cogs?.import || data?.csvAvailable.cogs)?.sourceFilename}
              at={(data?.cogs?.import || data?.csvAvailable.cogs)?.updatedAt}
              email={(data?.cogs?.import || data?.csvAvailable.cogs)?.uploadedByEmail}
            />
          </div>
        </div>
        <div className={card}>
          <h2 className="font-semibold text-zinc-900">Яндекс Директ</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {useCsv ? "CSV включён: выгрузка кабинета перекрывает API." : "CSV выкл.: только Direct API (кнопка «Обновить»)."}
            {" "}Источник: {sourceLabel("ads", data?.ads?.source ?? data?.pnl.adsSource)}
          </p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            {busy === "ads" ? "Загрузка…" : "Загрузить CSV Директа"}
            <input type="file" accept=".csv,text/csv" className="hidden"
              disabled={busy !== null}
              onChange={(event) => { void upload("ads", event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <div className="mt-3">
            <ImportMeta
              label={!useCsv && data?.csvAvailable.ads && !data?.ads ? "CSV есть, в расчёте не участвует" : "Последний импорт"}
              missing={!(data?.ads?.import || data?.csvAvailable.ads)}
              filename={(data?.ads?.import || data?.csvAvailable.ads)?.sourceFilename}
              at={(data?.ads?.import || data?.csvAvailable.ads)?.updatedAt}
              email={(data?.ads?.import || data?.csvAvailable.ads)?.uploadedByEmail}
            />
            {data?.ads?.kpi.droppedOutsideMonth ? (
              <p className="mt-1 text-xs text-amber-700">
                Пропущено строк вне месяца: {data.ads.kpi.droppedOutsideMonth}
              </p>
            ) : null}
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
            ["Потрачено AI", formatRub(data.pnl.spendRub), data.pnl.spendUsd != null ? `${formatUsd(data.pnl.spendUsd)} × ${data.pnl.usdRubRate}` : null],
          ].map(([label, value, hint]) => (
            <div key={label} className={card}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
              {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
            </div>
          ))}
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <NetIncomeCard pnl={data.pnl} />
          <AfterAdsCard pnl={data.pnl} />
        </section>
        <p className="text-xs text-zinc-500">
          В AI-косты v1 не входят planner фотосессии, analyze/remix/embeddings и failed job после списания у провайдера. Robokassa и Stars вне кассы.
        </p>
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
            Динамика моделей (оценка или GCP CSV). $1 = 90 ₽.
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

        <section className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Launch scorecard
              </p>
              <h2 className="mt-1 font-semibold text-zinc-900">
                Кластер «Фото на день рождения»
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-zinc-500">
                Одна кампания · одна группа · одно объявление · поиск · вся Россия ·{" "}
                {YANDEX_TWO_CLUSTER_LAUNCH.testWindowDays.min}–
                {YANDEX_TWO_CLUSTER_LAUNCH.testWindowDays.max} дней
              </p>
            </div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              CAC временный
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-zinc-500">Общий бюджет с НДС</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {formatRub(YANDEX_TWO_CLUSTER_LAUNCH.budget.totalWithVatRub)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Первый транш{" "}
                {formatRub(
                  YANDEX_TWO_CLUSTER_LAUNCH.budget.initialPilotWithVatRub,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">CAC_max до зрелого D30</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {formatRub(YANDEX_TWO_CLUSTER_LAUNCH.economics.cacMaxRub)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Маржа августа MTD</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {formatPct(
                  YANDEX_TWO_CLUSTER_LAUNCH.economics.contributionMarginRate,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Зрелых D30 плательщиков</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900">
                {formatInt(
                  YANDEX_TWO_CLUSTER_LAUNCH.economics.matureD30Payers,
                )}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-amber-700">
            {YANDEX_TWO_CLUSTER_LAUNCH.economics.note}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Расход Директа", formatRub(data.ads?.kpi.costRub ?? null), data.ads ? `НДС: ${data.ads.kpi.vatMode}` : "нет импорта"],
            ["Клики", formatInt(data.ads?.kpi.clicks ?? null), data.ads?.kpi.cpc != null ? `CPC ${formatRub(data.ads.kpi.cpc)}` : null],
            ["Показы", formatInt(data.ads?.kpi.impressions ?? null), data.ads?.kpi.ctr != null ? `CTR ${formatPct(data.ads.kpi.ctr)}` : null],
            ["Кампаний", formatInt(data.ads?.byCampaign.length ?? null), data.ads ? `${data.ads.kpi.count} строк` : null],
          ].map(([label, value, hint]) => (
            <div key={label} className={card}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
              {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">
              Delivery по дням
            </h2>
            {!deliveryRows.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="pb-2">День</th>
                    <th>Расход</th>
                    <th>Клики</th>
                    <th>Платежи</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryRows.map((row) => (
                    <tr key={row.day} className="border-t border-zinc-100">
                      <td className="py-2">{row.day}</td>
                      <td className="tabular-nums">{formatRub(row.spendRub)}</td>
                      <td className="tabular-nums">{formatInt(row.clicks)}</td>
                      <td className="tabular-nums">{formatInt(row.payments)}</td>
                      <td className="tabular-nums">{formatRub(row.revenueRub)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Директ по кампаниям</h2>
            {!data.ads?.byCampaign.length ? <p className="text-sm text-zinc-500">Нет данных</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">Кампания</th><th>Расход</th><th>Клики</th><th>CTR</th></tr>
                </thead>
                <tbody>
                  {data.ads.byCampaign.map((row) => (
                    <tr key={row.campaignId} className="border-t border-zinc-100">
                      <td className="py-2">
                        <p>{row.campaignName}</p>
                        <p className="font-mono text-xs text-zinc-400">{row.campaignId}</p>
                      </td>
                      <td className="tabular-nums">{formatRub(row.costRub)}</td>
                      <td className="tabular-nums">{formatInt(row.clicks)}</td>
                      <td className="tabular-nums">{formatPct(row.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {data.ads?.byAd.length ? (
          <section className={card}>
            <h2 className="mb-4 font-semibold text-zinc-900">Директ по объявлениям</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-zinc-400">
                  <tr><th className="pb-2">Объявление</th><th>Расход</th><th>Клики</th><th>CPC</th></tr>
                </thead>
                <tbody>
                  {data.ads.byAd.map((row) => (
                    <tr key={`${row.campaignId}:${row.adId}`} className="border-t border-zinc-100">
                      <td className="py-2">
                        <p className="font-mono text-zinc-800">{row.adId}</p>
                        <p className="text-xs text-zinc-400">{row.campaignName}</p>
                      </td>
                      <td className="tabular-nums">{formatRub(row.costRub)}</td>
                      <td className="tabular-nums">{formatInt(row.clicks)}</td>
                      <td className="tabular-nums">{formatRub(row.cpc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {data.acquisition && (data.acquisition.cohorts.length || data.acquisition.quality) ? (
          <section className={card}>
            <h2 className="mb-1 font-semibold text-zinc-900">Когорты и качество данных</h2>
            <p className="mb-4 text-sm text-zinc-500">Gross CAC / ROAS / LTV. Незрелые D7/D30 не для масштаба бюджета.</p>
            {data.acquisition.quality ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-sm">
                <p>Direct + yclid: {formatPct(data.acquisition.quality.directVisitsWithYclidRate)}</p>
                <p>Numeric campaign: {formatPct(data.acquisition.quality.directVisitsWithNumericCampaignRate)}</p>
                <p>Facts + visitor: {formatPct(data.acquisition.quality.funnelFactsWithVisitorRate)}</p>
                <p>OAuth + visitor: {formatPct(data.acquisition.quality.oauthUsersWithVisitorLinkRate)}</p>
                <p>Payments + snapshot: {formatPct(data.acquisition.quality.livePaymentsWithSnapshotRate)}</p>
                <p>Time to first aha: {data.acquisition.quality.timeToFirstAhaHours == null ? "—" : `${formatRatio(data.acquisition.quality.timeToFirstAhaHours)} ч`}</p>
                <p>MP sent / error: {formatInt(data.acquisition.quality.mpSent)} / {formatInt(data.acquisition.quality.mpError)}</p>
                <p>Unmatched spend: {formatInt(data.acquisition.quality.unmatchedSpendCampaigns.length)}</p>
                <p>Duplicate sessions: {formatInt(data.acquisition.quality.duplicateSessionCount)}</p>
                <p>Guest-owner facts: {formatInt(data.acquisition.quality.guestOwnerFactsInUniqueUsers)}</p>
              </div>
            ) : null}
            {!data.acquisition.cohorts.length ? <p className="text-sm text-zinc-500">Нет когорт RPC</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="text-xs uppercase text-zinc-400">
                    <tr>
                      <th className="pb-2">Когорта</th>
                      <th>Визиты</th>
                      <th>Aha</th>
                      <th>Activation</th>
                      <th>Payer CVR</th>
                      <th>CPA Aha</th>
                      <th>CAC</th>
                      <th>ROAS D0</th>
                      <th>ROAS D7</th>
                      <th>ROAS D30</th>
                      <th>LTV D30</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.acquisition.cohorts.map((row) => (
                      <tr key={`${row.cohortDate}:${row.source || ""}:${row.campaignId || ""}:${row.landingPath || ""}`} className="border-t border-zinc-100">
                        <td className="py-2">
                          <p>{row.cohortDate}{row.maturity.d7 ? "" : " · D7 незрелая"}{row.maturity.d30 ? "" : " · D30 незрелая"}</p>
                          <p className="text-xs text-zinc-400">{[row.source, row.campaignId, row.landingPath].filter(Boolean).join(" · ") || "без источника"}</p>
                        </td>
                        <td className="tabular-nums">{formatInt(row.visitors)}</td>
                        <td className="tabular-nums">{formatInt(row.ahaVisitors)}</td>
                        <td className="tabular-nums">{formatPct(row.activationRate)}</td>
                        <td className="tabular-nums">{formatPct(row.payerConversion)}</td>
                        <td className="tabular-nums">{formatRub(row.cpaAha)}</td>
                        <td className="tabular-nums">{formatRub(row.cac)}</td>
                        <td className="tabular-nums">{formatRatio(row.grossRoasD0)}</td>
                        <td className="tabular-nums">{formatRatio(row.grossRoasD7)}</td>
                        <td className="tabular-nums">{formatRatio(row.grossRoasD30)}</td>
                        <td className="tabular-nums">{formatRub(row.ltvD30)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </>}
    </div>
  );
}
