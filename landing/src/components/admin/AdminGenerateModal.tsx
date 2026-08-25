"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampImageSizeForModel, imageSizeOptionsForModel } from "@/lib/generation/image-options";

type Config = {
  models: { id: string; label: string }[]; aspectRatios: { value: string; label: string }[];
  imageSizes: { value: string; label: string }[]; defaults: { model: string };
};
type Result = { id: string; status: string; progress: number; resultUrl?: string; errorMessage?: string };

export function AdminGenerateModal({ initialPrompt, onClose, onCompleted }: {
  initialPrompt: string; onClose: () => void; onCompleted: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [photo, setPhoto] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [model, setModel] = useState("");
  const [aspect, setAspect] = useState("9:16");
  const [size, setSize] = useState("1K");
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const init = useCallback(async () => {
    try {
      const [photoResponse, configResponse] = await Promise.all([
        fetch("/api/admin/generation-photo", { credentials: "include" }), fetch("/api/generation-config"),
      ]);
      const photoBody = await photoResponse.json();
      const configBody = await configResponse.json();
      if (!photoResponse.ok || !configResponse.ok) throw new Error(photoBody.error || configBody.error);
      setPhoto(photoBody.signedUrl || null); setConfig(configBody); setModel(configBody.defaults.model);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка загрузки"); }
  }, []);
  useEffect(() => { void init(); }, [init]);

  const visibleImageSizes = useMemo(() => {
    const allowed = new Set(imageSizeOptionsForModel(model).map((item) => item.value));
    return (config?.imageSizes ?? []).filter((item) => allowed.has(item.value));
  }, [config, model]);

  useEffect(() => {
    const next = clampImageSizeForModel(model, size);
    if (next !== size) setSize(next);
  }, [model, size]);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/admin/generation-photo", { method: "POST", credentials: "include", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Ошибка загрузки");
      setPhoto(body.signedUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка загрузки"); }
    finally { setBusy(false); }
  };

  const poll = async (id: string): Promise<Result> => {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const response = await fetch(`/api/admin/generations/${id}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Ошибка статуса");
      setResults((current) => current.map((item) => item.id === id ? body : item));
      if (body.status === "completed") return body;
      if (body.status === "failed") throw new Error(body.errorMessage || "Генерация завершилась ошибкой");
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }
    throw new Error("Превышено время ожидания");
  };

  const generate = async () => {
    if (!photo) { setError("Сначала загрузите референс"); return; }
    setBusy(true); setError(""); setResults([]);
    try {
      const response = await fetch("/api/admin/generate", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, model, aspectRatio: aspect, imageSize: size, count,
          idempotencyKey: `admin:${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error || "Ошибка генерации");
      setResults(body.ids.map((id: string) => ({ id, status: "pending", progress: 10 })));
      await Promise.all(body.ids.map((id: string) => poll(id)));
      onCompleted();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ошибка генерации"); }
    finally { setBusy(false); }
  };

  return <div onClick={() => !busy && onClose()} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
    <div onClick={(event) => event.stopPropagation()} className="flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">Админ-генерация</h2>
        <button disabled={busy} onClick={onClose} className="text-2xl text-zinc-400">×</button>
      </header>
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="flex gap-3">
          <button onClick={() => inputRef.current?.click()} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl text-zinc-400">+</span>}
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)}
            className="min-h-24 flex-1 resize-none rounded-2xl border border-zinc-200 p-3 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="grid min-h-48 grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3">
          {results.length ? results.map((result) => result.resultUrl
            ? <img key={result.id} src={result.resultUrl} alt="" className="h-full max-h-72 w-full rounded-xl object-contain" />
            : <div key={result.id} className="flex items-center justify-center rounded-xl bg-white text-sm text-zinc-500">{result.status} · {result.progress}%</div>)
            : <p className="col-span-2 m-auto text-sm text-zinc-400">Результаты появятся здесь</p>}
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
      <footer className="space-y-3 border-t border-zinc-200 p-5">
        <div className="flex flex-wrap gap-2">
          <select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
            {config?.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={aspect} onChange={(event) => setAspect(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
            {config?.aspectRatios.map((item) => <option key={item.value}>{item.value}</option>)}
          </select>
          <select value={size} onChange={(event) => setSize(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
            {visibleImageSizes.map((item) => <option key={item.value}>{item.value}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center rounded-xl border border-zinc-200">
            <button onClick={() => setCount((value) => Math.max(1, value - 1))} className="px-3 py-2">−</button>
            <span className="w-6 text-center font-semibold">{count}</span>
            <button onClick={() => setCount((value) => Math.min(4, value + 1))} className="px-3 py-2">+</button>
          </div>
          <button disabled={busy || prompt.trim().length < 8 || !model || !photo} onClick={() => void generate()}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
            {busy ? "Выполняется…" : `Сгенерировать × ${count}`}
          </button>
        </div>
      </footer>
    </div>
  </div>;
}
