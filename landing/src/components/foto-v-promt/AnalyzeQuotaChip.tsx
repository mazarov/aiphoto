"use client";

import type { AnalyzeQuotaPayload } from "@/lib/image-prompt-analyze-client";
import { widgetCopy } from "@/lib/foto-v-promt-copy";
import { FVP_FOCUS_RING, FVP_IMMERSIVE_FOCUS_RING } from "./foto-v-promt-tokens";

export type AnalyzeQuotaChipTone = "light" | "dark";

function TokenMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.5l.7 1.9L10.7 7 8.7 7.6 8 9.5 7.3 7.6 5.3 7l2-1.6L8 4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function QuotaMeter({
  value,
  max,
  dark,
}: {
  value: number;
  max: number;
  dark: boolean;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span
      className={`relative h-1 w-8 overflow-hidden rounded-full ${
        dark ? "bg-white/15" : "bg-zinc-200"
      }`}
      aria-hidden
    >
      <span
        className={`absolute inset-y-0 left-0 rounded-full ${
          value === 0 || value >= max
            ? "bg-zinc-400"
            : dark
              ? "bg-indigo-400"
              : "bg-indigo-500"
        }`}
        style={{ width: `${Math.max(ratio * 100, value > 0 ? 8 : 0)}%` }}
      />
    </span>
  );
}

export function AnalyzeQuotaChip({
  quota,
  tone,
  compact = false,
  minimal = false,
  countAs = "remaining",
  onSignIn,
  onTopUp,
}: {
  quota: AnalyzeQuotaPayload | null;
  tone: AnalyzeQuotaChipTone;
  compact?: boolean;
  minimal?: boolean;
  countAs?: "remaining" | "used";
  onSignIn?: () => void;
  onTopUp?: () => void;
}) {
  if (!quota) return null;

  const remaining = Math.max(0, Number(quota.remaining_free ?? 0));
  const max = Math.max(1, Number(quota.free_max ?? 10));
  const used = Math.min(max, Math.max(0, max - remaining));
  const shown = countAs === "used" ? used : remaining;
  const next = quota.next_mode;
  const dark = tone === "dark";
  const focus = dark ? FVP_IMMERSIVE_FOCUS_RING : FVP_FOCUS_RING;
  const height = minimal ? "h-6" : compact ? "h-8" : "h-10";
  const shell = dark
    ? `inline-flex ${height} shrink-0 items-center ${
        minimal ? "gap-1 rounded-full px-2 text-xs" : "gap-1.5 rounded-xl px-2.5 text-[13px]"
      } border border-white/10 bg-white/5 font-medium text-zinc-200`
    : `inline-flex ${height} shrink-0 items-center ${
        minimal ? "gap-1 rounded-full px-2" : "gap-1.5 rounded-xl px-2.5 shadow-sm shadow-zinc-200/50"
      } border border-zinc-200 bg-white text-xs font-medium text-zinc-600`;

  if (next === "auth_required") {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className={`${shell} ${focus} ${
          dark ? "hover:bg-white/10" : "hover:border-indigo-200 hover:text-indigo-700"
        }`}
      >
        {widgetCopy("quotaChipSignIn")}
      </button>
    );
  }

  if (next === "no_credits") {
    return (
      <button
        type="button"
        onClick={onTopUp}
        className={`inline-flex ${height} shrink-0 items-center ${
          minimal ? "gap-1 rounded-full px-2" : "gap-1.5 rounded-xl px-2.5"
        } border font-medium ${focus} ${
          dark
            ? "border-rose-400/25 bg-rose-500/10 text-[13px] text-rose-200 hover:bg-rose-500/15"
            : "border-rose-200 bg-rose-50 text-xs text-rose-700 hover:border-rose-300"
        }`}
      >
        {widgetCopy("quotaChipTopUp")}
      </button>
    );
  }

  if (next === "paid") {
    return (
      <span
        className={`${shell} ${
          dark ? "text-indigo-200" : "border-indigo-200/80 text-indigo-700"
        }`}
        title={widgetCopy("paidWarning")}
      >
        {minimal ? null : <TokenMark className="h-4 w-4 shrink-0" />}
        {widgetCopy("quotaChipPaid")}
      </span>
    );
  }

  const label = `${shown} из ${max} ${widgetCopy("quotaFreeLine")}`;
  return (
    <span className={shell} title={label} aria-label={label}>
      {minimal ? null : <QuotaMeter value={shown} max={max} dark={dark} />}
      <span className="tabular-nums">
        {minimal ? `${shown}/${max}` : `${shown} из ${max}`}
      </span>
      {minimal ? null : (
        <span className={dark ? "text-zinc-500" : "text-zinc-400"}>
          {widgetCopy("quotaChipToday")}
        </span>
      )}
    </span>
  );
}

export function AnalyzePaidNotice({
  tone,
}: {
  tone: AnalyzeQuotaChipTone;
}) {
  const dark = tone === "dark";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
        dark
          ? "bg-emerald-500/15 text-[13px] text-emerald-300"
          : "bg-emerald-50 text-xs text-emerald-700"
      }`}
    >
      {widgetCopy("paidSuccess")}
    </span>
  );
}
