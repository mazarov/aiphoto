"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type Campaign = {
  id: string;
  status: string;
  segment: string;
  subject: string;
  recipient_count: number;
  enqueued_count: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  created_at: string;
};

type PreviewRow = { email: string; displayName: string | null };

const buttonClass =
  "rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const secondaryClass =
  "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50";

export function AdminMailDashboard() {
  const { user, openAuthModal } = useAuth();
  const [segment, setSegment] = useState<"all_email" | "paid">("all_email");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/mail/campaigns", { cache: "no-store" });
    if (!response.ok) {
      setMessage(response.status === 401 ? "Нужен вход" : "Не удалось загрузить очередь");
      return;
    }
    const data = (await response.json()) as { campaigns: Campaign[]; stats: Record<string, unknown> };
    setCampaigns(data.campaigns || []);
    setStats(data.stats || null);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  async function post(action: "preview" | "send") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/mail/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "preview"
            ? { action, segment, subject, body_text: bodyText }
            : { action, campaignId },
        ),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "Ошибка запроса");
        return;
      }
      if (action === "preview") {
        setCampaignId(typeof data?.campaignId === "string" ? data.campaignId : "");
        setRecipientCount(typeof data?.recipientCount === "number" ? data.recipientCount : 0);
        setPreview(Array.isArray(data?.preview) ? (data.preview as PreviewRow[]) : []);
        setMessage("Dry-run готов. Проверьте получателей, потом отправьте.");
      } else {
        setMessage(`В очередь поставлено: ${String(data?.enqueued ?? 0)}`);
        setCampaignId("");
        setRecipientCount(null);
        setPreview([]);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-600">Войдите, чтобы открыть рассылки.</p>
        <button type="button" className={`${buttonClass} mt-3`} onClick={() => openAuthModal()}>
          Войти
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-zinc-900">Почта</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Сначала dry-run: число получателей и 5 адресов. Отправка — отдельная кнопка.
          Пока стоит <code>POSTBOX_TEST_ALLOWLIST</code>, cron отправит только эти адреса.
        </p>
        <label className="mt-4 block text-xs font-semibold text-zinc-500">
          Сегмент
          <select
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            value={segment}
            onChange={(event) => setSegment(event.target.value as "all_email" | "paid")}
          >
            <option value="all_email">Все с email</option>
            <option value="paid">Оплатившие</option>
          </select>
        </label>
        <label className="mt-3 block text-xs font-semibold text-zinc-500">
          Тема
          <input
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={200}
          />
        </label>
        <label className="mt-3 block text-xs font-semibold text-zinc-500">
          Текст
          <textarea
            className="mt-1 min-h-32 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            maxLength={20000}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={secondaryClass} disabled={busy} onClick={() => void post("preview")}>
            Dry-run
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={busy || !campaignId || !recipientCount}
            onClick={() => {
              if (!window.confirm(`Отправить кампанию ${recipientCount} получателям?`)) return;
              void post("send");
            }}
          >
            Отправить
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-zinc-600">{message}</p> : null}
        {recipientCount !== null ? (
          <p className="mt-3 text-sm text-zinc-800">Получателей: {recipientCount}</p>
        ) : null}
        {preview.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {preview.map((row) => (
              <li key={row.email}>
                {row.email}
                {row.displayName ? ` · ${row.displayName}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Очередь</h2>
        {stats ? (
          <p className="mt-2 text-xs text-zinc-600">
            pending {String(stats.pending ?? 0)} · processing {String(stats.processing ?? 0)} · sent{" "}
            {String(stats.sent ?? 0)} · skipped {String(stats.skipped ?? 0)} · failed {String(stats.failed ?? 0)}
          </p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-3">Тема</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3">Сегмент</th>
                <th className="py-2 pr-3">Получатели</th>
                <th className="py-2">Отправлено</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-zinc-100 text-zinc-700">
                  <td className="py-2 pr-3">{campaign.subject}</td>
                  <td className="py-2 pr-3">{campaign.status}</td>
                  <td className="py-2 pr-3">{campaign.segment}</td>
                  <td className="py-2 pr-3">{campaign.recipient_count}</td>
                  <td className="py-2">{campaign.sent_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
