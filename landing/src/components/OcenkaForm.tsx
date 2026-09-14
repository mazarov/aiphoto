"use client";

import { useState, type FormEvent } from "react";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function OcenkaForm({
  token,
  initialScore,
}: {
  token: string;
  initialScore: number | null;
}) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (score == null) {
      setError("Выберите оценку от 1 до 10");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, score, comment }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        const code = typeof body.error === "string" ? body.error : "";
        setError(
          code === "invalid_token" || code === "not_found"
            ? "Ссылка больше не действует. Откройте оценку ещё раз из письма."
            : code === "invalid_score"
              ? "Выберите оценку от 1 до 10"
              : "Не удалось сохранить оценку",
        );
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Ошибка сети. Попробуйте ещё раз.");
    }
  }

  if (status === "done") {
    return (
      <p className="mt-6 text-sm text-zinc-600">
        Спасибо. Оценка {score} сохранена
        {comment.trim() ? " вместе с комментарием" : ""}. Это помогает нам делать PromptShot лучше.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <p className="text-sm font-medium text-zinc-800">Насколько готовы порекомендовать друзьям</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SCORES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScore(value)}
              className={`min-h-11 min-w-11 rounded-xl text-sm font-semibold ${
                score === value
                  ? "bg-indigo-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-400">
          <span>1 — не готов</span>
          <span>10 — обязательно</span>
        </div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-800">Комментарий, если хотите</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none focus:border-indigo-400"
          placeholder="Что сработало или что мешает"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {status === "saving" ? "Сохраняем…" : "Отправить"}
      </button>
    </form>
  );
}
