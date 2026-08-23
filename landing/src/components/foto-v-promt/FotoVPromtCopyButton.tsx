"use client";

import { useEffect, useRef, useState } from "react";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import { widgetCopy } from "@/lib/foto-v-promt-copy";

const RESET_MS = 2000;

type CopyStatus = "idle" | "copied" | "failed";

type Props = {
  text: string;
  idleLabel: string;
  className: string;
  copiedLabel?: string;
  failedLabel?: string;
};

export function FotoVPromtCopyButton({
  text,
  idleLabel,
  className,
  copiedLabel = widgetCopy("copied"),
  failedLabel = widgetCopy("copyFailed"),
}: Props) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onClick = async () => {
    const ok = await copyTextUniversal(text);
    setStatus(ok ? "copied" : "failed");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus("idle");
      timerRef.current = null;
    }, RESET_MS);
  };

  const label =
    status === "copied" ? copiedLabel : status === "failed" ? failedLabel : idleLabel;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={`${className} gap-1.5`}
      aria-live="polite"
      aria-label={label}
    >
      {status === "copied" ? (
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : null}
      {label}
    </button>
  );
}
