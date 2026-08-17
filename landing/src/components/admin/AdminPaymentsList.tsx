"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type Payment = {
  id: string;
  provider: "yookassa" | "robokassa";
  providerPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  authUserId: string;
  landingUserId: string;
  identityMismatch: boolean;
  payerEmail: string | null;
  payerDisplayName: string | null;
  payerProvider: string | null;
  planId: string;
  amountRub: number;
  credits: number;
  status: "created" | "pending" | "succeeded" | "canceled";
  providerStatus: string | null;
  test: boolean | null;
  creditedAt: string | null;
  creditState: "credited" | "not_due" | "discrepancy" | "stale";
};

const STATUS_OPTIONS = [
  ["all", "Все статусы"],
  ["created", "Создан"],
  ["pending", "Ожидает"],
  ["succeeded", "Успешен"],
  ["canceled", "Отменён"],
] as const;
const TEST_OPTIONS = [["all", "Все"], ["live", "Боевые"], ["test", "Тестовые"]] as const;
const buttonClass = (active: boolean) => `rounded-xl px-3 py-2 text-xs font-semibold ${
  active ? "bg-indigo-600 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
}`;
const statusClass: Record<Payment["status"], string> = {
  created: "bg-zinc-100 text-zinc-700",
  pending: "bg-amber-100 text-amber-700",
  succeeded: "bg-emerald-100 text-emerald-700",
  canceled: "bg-red-100 text-red-700",
};
const shortId = (value: string) => `${value.slice(0, 8)}…`;

export function AdminPaymentsList() {
  const { user, openAuthModal } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [testFilter, setTestFilter] = useState("all");
  const [items, setItems] = useState<Payment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState({ loading: true, status: 0, error: "" });
  const [actionMessage, setActionMessage] = useState("");
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [staleBusy, setStaleBusy] = useState(false);

  const load = useCallback(async (next?: string) => {
    setState({ loading: true, status: 0, error: "" });
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        test: testFilter,
        limit: "30",
      });
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/admin/payments?${params}`, { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({ loading: false, status: response.status, error: body.error || "Не удалось загрузить оплаты" });
        return;
      }
      setItems((current) => next ? [...current, ...body.items] : body.items);
      setCursor(body.nextCursor || null);
      setState({ loading: false, status: 0, error: "" });
    } catch {
      setState({ loading: false, status: 0, error: "Ошибка сети" });
    }
  }, [statusFilter, testFilter]);

  useEffect(() => { void load(); }, [load, user]);

  const reconcileOne = useCallback(async (payment: Payment) => {
    setReconcilingId(payment.id);
    setActionMessage("");
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          yookassaPaymentId: payment.providerPaymentId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionMessage(body.message || body.error || "Не удалось сверить оплату");
        return;
      }
      setActionMessage(
        `Сверено ${shortId(payment.id)} → ${body.status}${body.credited ? ", кредиты начислены" : ""}`,
      );
      await load();
    } catch {
      setActionMessage("Ошибка сети при сверке");
    } finally {
      setReconcilingId(null);
    }
  }, [load]);

  const reconcileStale = useCallback(async () => {
    setStaleBusy(true);
    setActionMessage("");
    try {
      const response = await fetch("/api/admin/payments/reconcile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stale: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionMessage(body.message || body.error || "Не удалось сверить зависшие");
        return;
      }
      setActionMessage(
        `Зависшие: scanned ${body.scanned ?? 0}, ok ${body.ok ?? 0}, failed ${body.failed ?? 0}`,
      );
      await load();
    } catch {
      setActionMessage("Ошибка сети при сверке зависших");
    } finally {
      setStaleBusy(false);
    }
  }, [load]);

  if (state.status === 401 || state.status === 403) {
    return <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">
        {state.status === 401 ? "Нужен вход" : "Доступ запрещён"}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        {state.status === 401 ? "Войдите через PromptShot." : "Ваш email не включён в allowlist."}
      </p>
      {state.status === 401 && <button onClick={() => openAuthModal()}
        className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">
        Войти
      </button>}
    </div>;
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-indigo-600">PromptShot Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Оплаты</h1>
        <p className="mt-1 text-sm text-zinc-500">Плательщики, статусы и начисление кредитов</p>
      </div>
      <button
        type="button"
        disabled={staleBusy || state.loading}
        onClick={() => void reconcileStale()}
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
      >
        {staleBusy ? "Сверяем…" : "Сверить зависшие YooKassa"}
      </button>
    </header>

    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(([value, label]) => <button key={value}
          className={buttonClass(statusFilter === value)} onClick={() => setStatusFilter(value)}>
          {label}
        </button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {TEST_OPTIONS.map(([value, label]) => <button key={value}
          className={buttonClass(testFilter === value)} onClick={() => setTestFilter(value)}>
          {label}
        </button>)}
      </div>
    </section>

    {actionMessage && <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">{actionMessage}</p>}
    {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    {state.loading && !items.length ? <p className="text-sm text-zinc-500">Загрузка…</p>
      : !items.length ? <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        Оплат пока нет
      </div>
      : <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Дата / плательщик</th>
              <th className="px-4 py-3">Тариф</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Кредиты</th>
              <th className="px-4 py-3">Provider ID</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>{items.map((item) => <tr key={item.id} className="border-t border-zinc-100 align-top">
            <td className="px-4 py-4">
              <p className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</p>
              <p className="mt-1 font-semibold text-zinc-900">{item.payerEmail || item.payerDisplayName || "Email неизвестен"}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {item.payerProvider || "provider —"} · auth {shortId(item.authUserId)}
              </p>
              {item.identityMismatch && <p className="mt-1 text-xs font-medium text-amber-700">
                billing ID {shortId(item.landingUserId)}
              </p>}
            </td>
            <td className="px-4 py-4 font-medium text-zinc-800">{item.planId}</td>
            <td className="px-4 py-4 font-semibold tabular-nums text-zinc-900">
              {item.amountRub.toLocaleString("ru-RU")} ₽
              {item.test === true && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">test</span>}
            </td>
            <td className="px-4 py-4">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}>
                {item.status}
              </span>
              {item.providerStatus && item.providerStatus !== item.status
                && <p className="mt-2 text-xs text-zinc-500">provider: {item.providerStatus}</p>}
            </td>
            <td className="px-4 py-4">
              <p className="font-semibold tabular-nums text-zinc-900">{item.credits}</p>
              {item.creditState === "credited"
                ? <p className="mt-1 text-xs text-emerald-700">Начислены {new Date(item.creditedAt!).toLocaleString()}</p>
                : item.creditState === "discrepancy"
                  ? <p className="mt-1 font-semibold text-red-700">Оплата успешна, начисления нет</p>
                  : item.creditState === "stale"
                    ? <p className="mt-1 font-semibold text-amber-700">Зависла сверка (&gt;15 мин)</p>
                    : <p className="mt-1 text-xs text-zinc-500">Не начислены</p>}
            </td>
            <td className="px-4 py-4 font-mono text-xs text-zinc-500">
              <span className="font-sans font-semibold text-zinc-700">{item.provider}</span>
              <br />
              {item.providerPaymentId || "—"}
            </td>
            <td className="px-4 py-4">
              <button
                type="button"
                disabled={
                  item.provider !== "yookassa" ||
                  !item.providerPaymentId ||
                  reconcilingId === item.id ||
                  staleBusy
                }
                onClick={() => void reconcileOne(item)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
              >
                {reconcilingId === item.id ? "…" : "Сверить"}
              </button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>}

    {cursor && <button disabled={state.loading} onClick={() => void load(cursor)}
      className="mx-auto block rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">
      {state.loading ? "Загрузка…" : "Показать ещё"}
    </button>}
  </div>;
}
