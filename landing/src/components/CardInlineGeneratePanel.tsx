"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { optionLabelForGenerationModel } from "@/lib/generation-model-labels";
import { noticeForUploadError, prepareUploadFile } from "@/lib/image-upload-prepare";

type ModelOpt = { id: string; label: string; cost: number };
type RatioOpt = { value: string; label: string };
type SizeOpt = { value: string; label: string };

type Phase = "idle" | "uploading" | "generating" | "done" | "error";

type Props = {
  promptText: string;
  cardId: string;
  onBack: () => void;
  /** desktop | mobile visual density */
  layout?: "desktop" | "mobile";
};

const POLL_MS = 2500;
const POLL_MAX_MS = 120_000;

export function CardInlineGeneratePanel({
  promptText,
  cardId,
  onBack,
  layout = "desktop",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [models, setModels] = useState<ModelOpt[]>([]);
  const [aspectRatios, setAspectRatios] = useState<RatioOpt[]>([]);
  const [imageSizes, setImageSizes] = useState<SizeOpt[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash-image");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [configError, setConfigError] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
  }, []);

  useEffect(() => () => revokePreview(), [revokePreview]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/generation-config");
        if (!res.ok) throw new Error("config_failed");
        const data = (await res.json()) as {
          models?: ModelOpt[];
          aspectRatios?: RatioOpt[];
          imageSizes?: SizeOpt[];
          defaults?: { model?: string; aspectRatio?: string; imageSize?: string };
        };
        if (cancelled) return;
        const nextModels = Array.isArray(data.models) ? data.models : [];
        const nextRatios = Array.isArray(data.aspectRatios) ? data.aspectRatios : [];
        const nextSizes = Array.isArray(data.imageSizes) ? data.imageSizes : [];
        setModels(nextModels);
        setAspectRatios(nextRatios);
        setImageSizes(nextSizes);
        if (data.defaults?.model) setModel(data.defaults.model);
        else if (nextModels[0]) setModel(nextModels[0].id);
        if (data.defaults?.aspectRatio) setAspectRatio(data.defaults.aspectRatio);
        else if (nextRatios[0]) setAspectRatio(nextRatios[0].value);
        if (data.defaults?.imageSize) setImageSize(data.defaults.imageSize);
        else if (nextSizes[0]) setImageSize(nextSizes[0].value);
      } catch {
        if (!cancelled) setConfigError("Не удалось загрузить параметры генерации");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    revokePreview();
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setPhotoFile(file);
    setError("");
    setResultUrl(null);
    setPhase("idle");
    setProgress(0);
  };

  const clearPhoto = () => {
    revokePreview();
    setPreviewUrl(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runGenerate = async () => {
    if (!photoFile) {
      setError("Загрузите своё фото");
      return;
    }
    const prompt = promptText.trim();
    if (prompt.length < 8) {
      setError("Промпт слишком короткий");
      return;
    }

    setError("");
    setResultUrl(null);
    setPhase("uploading");
    setProgress(8);

    try {
      const prepared = await prepareUploadFile(photoFile);
      if (!prepared.ok) {
        const msg = noticeForUploadError(prepared.error, (key) => {
          if (key === "tooLarge") return "Файл слишком большой (макс. 10 МБ)";
          if (key === "readFailed") return "Не удалось прочитать файл";
          return "Недопустимый тип файла";
        });
        throw new Error(msg);
      }

      const blob = await (await fetch(prepared.dataUrl)).blob();
      const mime =
        prepared.mime === "image/png" || prepared.mime === "image/webp"
          ? prepared.mime
          : "image/jpeg";
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const typedFile = new File([blob], `photo.${ext}`, { type: mime });

      const form = new FormData();
      form.append("file", typedFile);
      const upRes = await fetch("/api/upload-generation-photo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const upData = (await upRes.json().catch(() => ({}))) as {
        storagePath?: string;
        error?: string;
        message?: string;
      };
      if (!upRes.ok || !upData.storagePath) {
        throw new Error(upData.message || upData.error || "Ошибка загрузки фото");
      }

      setPhase("generating");
      setProgress(20);
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio,
          imageSize,
          cardId,
          photoStoragePaths: [upData.storagePath],
          vibeId: null,
        }),
      });
      const genData = (await genRes.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        message?: string;
      };
      if (!genRes.ok || !genData.id) {
        throw new Error(genData.message || genData.error || "Не удалось создать генерацию");
      }

      const started = Date.now();
      while (Date.now() - started < POLL_MAX_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const pollRes = await fetch(`/api/generations/${genData.id}`, {
          credentials: "include",
        });
        const poll = (await pollRes.json().catch(() => ({}))) as {
          status?: string;
          progress?: number;
          resultUrl?: string;
          errorMessage?: string;
          error?: string;
        };
        if (!pollRes.ok) {
          throw new Error(poll.errorMessage || poll.error || "Ошибка статуса генерации");
        }
        if (typeof poll.progress === "number") setProgress(Math.max(20, poll.progress));
        if (poll.status === "completed" && poll.resultUrl) {
          setResultUrl(poll.resultUrl);
          setProgress(100);
          setPhase("done");
          return;
        }
        if (poll.status === "failed") {
          throw new Error(poll.errorMessage || "Генерация не удалась");
        }
      }
      throw new Error("Таймаут генерации");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Ошибка генерации");
    }
  };

  const busy = phase === "uploading" || phase === "generating";
  const isMobile = layout === "mobile";

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${isMobile ? "gap-3 p-4" : "gap-3 px-4 pb-4 pt-2"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={`${OVERLAY_BUTTON_UA_RESET} rounded-xl bg-zinc-800 px-3 py-2 text-[13px] font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50`}
        >
          Назад
        </button>
        <span className="text-[13px] font-medium text-zinc-400">Генерация</span>
      </div>

      {resultUrl ? (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Результат генерации" className="h-full w-full object-contain" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-zinc-600 bg-zinc-900/80 px-3 py-4 text-center transition hover:border-zinc-400 disabled:opacity-50`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Ваше фото" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <span className="text-[28px] leading-none text-zinc-500">+</span>
              <span className="text-[13px] font-semibold text-zinc-200">Загрузить своё фото</span>
              <span className="text-[12px] text-zinc-500">JPEG / PNG / WebP</span>
            </>
          )}
          {previewUrl && (
            <span className="absolute bottom-2 left-2 rounded-lg bg-black/55 px-2 py-1 text-[12px] font-semibold text-white">
              Сменить фото
            </span>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onPickFile(f);
          e.target.value = "";
        }}
      />

      {previewUrl && !resultUrl && (
        <button
          type="button"
          onClick={clearPhoto}
          disabled={busy}
          className={`${OVERLAY_BUTTON_UA_RESET} self-start text-[13px] font-medium text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50`}
        >
          Убрать фото
        </button>
      )}

      <div className="grid grid-cols-1 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-zinc-500">Модель</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={busy || !models.length}
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[13px] font-semibold text-zinc-100"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {optionLabelForGenerationModel(m.id, m.label)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-[12px] font-medium text-zinc-500">Формат</span>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              disabled={busy || !aspectRatios.length}
              className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[13px] font-semibold text-zinc-100"
            >
              {aspectRatios.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[12px] font-medium text-zinc-500">Качество</span>
            <select
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value)}
              disabled={busy || !imageSizes.length}
              className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[13px] font-semibold text-zinc-100"
            >
              {imageSizes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {(busy || phase === "error" || configError) && (
        <div className="space-y-1">
          {busy && (
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
              />
            </div>
          )}
          <p className="text-[12px] text-zinc-400">
            {phase === "uploading"
              ? "Загружаем фото…"
              : phase === "generating"
                ? "Генерируем…"
                : configError || error}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={busy || !photoFile || Boolean(configError)}
        onClick={() => void runGenerate()}
        className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-300 px-4 py-3 text-[15px] font-semibold text-zinc-900 transition hover:bg-emerald-200 active:scale-[0.98] disabled:opacity-50`}
      >
        {phase === "done" ? "Сгенерировать ещё" : busy ? "Подождите…" : "Сгенерировать"}
      </button>
    </div>
  );
}
