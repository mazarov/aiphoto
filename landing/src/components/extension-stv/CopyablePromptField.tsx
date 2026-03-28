"use client";

import { useCallback, useState } from "react";

type Props = {
  value: string;
  label?: string;
  className?: string;
};

/** Read-only textarea + copy — вид «результат для копирования», не карточка. */
export function CopyablePromptField({ value, label = "Prompt", className }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2.5 ${className ?? ""}`}>
      <textarea
        readOnly
        value={value}
        spellCheck={false}
        rows={10}
        className="min-h-[220px] w-full flex-1 resize-y rounded-xl border border-white/[0.08] bg-zinc-950/90 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-colors focus:border-indigo-500/35 focus:ring-2 focus:ring-indigo-500/15 sm:min-h-0 sm:text-xs"
        aria-label={label}
      />
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] pt-2">
        <span className="text-[10px] leading-snug text-zinc-500">Copy into your AI tool</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-indigo-500/90 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400/80"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
