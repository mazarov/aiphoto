"use client";

import { useState } from "react";

type Props = {
  id: string;
  status: string;
  resultUrl: string | null;
  prompt: string;
  model: string;
  aspectRatio: string;
  createdAt: string;
};

export function GenerationCard({
  id,
  status,
  resultUrl,
  prompt,
  model,
  aspectRatio,
  createdAt,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <div
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        onClick={() => resultUrl && setLightboxOpen(true)}
      >
        <div className="aspect-square relative bg-zinc-100">
          {resultUrl ? (
            <img
              src={resultUrl}
              alt=""
              className="h-full w-full object-cover cursor-pointer"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">
              {status === "pending" || status === "processing" ? (
                <span className="text-sm">Генерация...</span>
              ) : status === "failed" ? (
                <span className="text-sm text-red-500">Ошибка</span>
              ) : (
                <span className="text-sm">—</span>
              )}
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="line-clamp-2 text-xs text-zinc-600">{prompt}</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            {model} · {aspectRatio} · {dateStr}
          </p>
        </div>
      </div>

      {lightboxOpen && resultUrl && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            <img src={resultUrl} alt="" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
            <a
              href={resultUrl}
              download="generated.png"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
            >
              Скачать
            </a>
          </div>
        </div>
      )}
    </>
  );
}
