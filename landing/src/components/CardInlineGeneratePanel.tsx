"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import { optionLabelForGenerationModel } from "@/lib/generation-model-labels";
import { noticeForUploadError, prepareUploadFile } from "@/lib/image-upload-prepare";

type ModelOpt = { id: string; label: string; cost: number };
type RatioOpt = { value: string; label: string };
type SizeOpt = { value: string; label: string };
type UserPhoto = {
  id: string;
  storagePath: string;
  previewUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

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

  const [models, setModels] = useState<ModelOpt[]>([]);
  const [aspectRatios, setAspectRatios] = useState<RatioOpt[]>([]);
  const [imageSizes, setImageSizes] = useState<SizeOpt[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash-image");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [configError, setConfigError] = useState("");
  const [maxPhotos, setMaxPhotos] = useState(10);

  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

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
          limits?: { maxPhotos?: number };
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
        if (typeof data.limits?.maxPhotos === "number") {
          setMaxPhotos(Math.max(1, Math.min(10, data.limits.maxPhotos)));
        }
      } catch {
        if (!cancelled) setConfigError("Не удалось загрузить параметры генерации");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/user-generation-photos", { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as {
          photos?: UserPhoto[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить ваши фото");
        if (cancelled) return;
        const nextPhotos = Array.isArray(data.photos) ? data.photos : [];
        setPhotos(nextPhotos);
        setSelectedPhotoIds(nextPhotos[0] ? new Set([nextPhotos[0].id]) : new Set());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить ваши фото");
        }
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.has(photo.id)),
    [photos, selectedPhotoIds]
  );

  const togglePhoto = (id: string) => {
    if (phase === "uploading" || phase === "generating") return;
    setError("");
    setSelectedPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxPhotos) {
        next.add(id);
      } else {
        setError(`Можно выбрать не больше ${maxPhotos} фото`);
      }
      return next;
    });
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const availableSelectionSlots = Math.max(0, maxPhotos - selectedPhotoIds.size);
    setError("");
    setResultUrl(null);
    setPhase("uploading");
    setProgress(8);

    const uploaded: UserPhoto[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const prepared = await prepareUploadFile(files[index]);
        if (!prepared.ok) {
          const message = noticeForUploadError(prepared.error, (key) => {
            if (key === "tooLarge") return "Файл слишком большой (макс. 10 МБ)";
            if (key === "readFailed") return "Не удалось прочитать файл";
            return "Недопустимый тип файла";
          });
          throw new Error(message);
        }

        const blob = await (await fetch(prepared.dataUrl)).blob();
        const mime =
          prepared.mime === "image/png" || prepared.mime === "image/webp"
            ? prepared.mime
            : "image/jpeg";
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const typedFile = new File([blob], files[index].name || `photo.${ext}`, { type: mime });
        const form = new FormData();
        form.append("file", typedFile);
        form.append("saveToLibrary", "true");

        const upRes = await fetch("/api/upload-generation-photo", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const upData = (await upRes.json().catch(() => ({}))) as {
          photo?: UserPhoto;
          error?: string;
          message?: string;
        };
        if (!upRes.ok || !upData.photo) {
          throw new Error(upData.message || upData.error || "Ошибка загрузки фото");
        }
        uploaded.push(upData.photo);
        setProgress(8 + Math.round(((index + 1) / files.length) * 72));
      }

      setPhotos((current) => [...uploaded.reverse(), ...current]);
      setSelectedPhotoIds((current) => {
        const next = new Set(current);
        for (const photo of uploaded) {
          if (next.size >= maxPhotos) break;
          next.add(photo.id);
        }
        return next;
      });
      setPhase("idle");
      setProgress(0);
      if (uploaded.length > availableSelectionSlots) {
        setError(
          `Все фото сохранены. Для генерации можно выбрать не больше ${maxPhotos}.`
        );
      }
    } catch (err) {
      if (uploaded.length) {
        setPhotos((current) => [...uploaded.reverse(), ...current]);
        setSelectedPhotoIds((current) => {
          const next = new Set(current);
          for (const photo of uploaded) {
            if (next.size >= maxPhotos) break;
            next.add(photo.id);
          }
          return next;
        });
      }
      setPhase("error");
      setError(err instanceof Error ? err.message : "Ошибка загрузки фото");
    }
  };

  const deletePhoto = async (photo: UserPhoto) => {
    if (!window.confirm("Удалить это фото из вашей библиотеки?")) return;
    setDeletingPhotoId(photo.id);
    setError("");
    try {
      const res = await fetch(`/api/user-generation-photos/${photo.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось удалить фото");

      const remaining = photos.filter((item) => item.id !== photo.id);
      setPhotos(remaining);
      setSelectedPhotoIds((selected) => {
        const next = new Set(selected);
        next.delete(photo.id);
        if (!next.size && remaining[0]) next.add(remaining[0].id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить фото");
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const runGenerate = async () => {
    if (!selectedPhotos.length) {
      setError("Выберите хотя бы одно фото");
      return;
    }
    const prompt = promptText.trim();
    if (prompt.length < 8) {
      setError("Промпт слишком короткий");
      return;
    }

    setError("");
    setResultUrl(null);
    setPhase("generating");
    setProgress(20);

    try {
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
          photoStoragePaths: selectedPhotos.map((photo) => photo.storagePath),
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
      requestCreditBalanceRefresh();

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
          requestCreditBalanceRefresh();
          return;
        }
        if (poll.status === "failed") {
          requestCreditBalanceRefresh();
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
  const controlsBusy = busy || Boolean(deletingPhotoId);
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
        <section className="rounded-2xl border border-white/10 bg-zinc-900/65 p-3">
          <div className="mb-2 flex min-h-11 items-center justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-100">Ваши фото</h3>
              <p className="text-[13px] font-medium text-zinc-500">
                Выбрано {selectedPhotos.length} из {maxPhotos}
              </p>
            </div>
            {libraryLoading && (
              <span className="text-[13px] font-medium text-zinc-500">Загрузка…</span>
            )}
          </div>

          <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-0.5">
            {photos.map((photo) => {
              const selected = selectedPhotoIds.has(photo.id);
              const deleting = deletingPhotoId === photo.id;
              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-square overflow-hidden rounded-xl bg-zinc-800 ring-2 transition ${
                    selected ? "ring-emerald-300" : "ring-transparent"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={selected ? "Не использовать фото" : "Использовать фото"}
                    aria-pressed={selected}
                    disabled={controlsBusy || deleting}
                    onClick={() => togglePhoto(photo.id)}
                    className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 h-full w-full disabled:opacity-50`}
                  >
                    {photo.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.previewUrl}
                        alt={photo.originalFilename || "Сохранённое фото"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[13px] font-medium text-zinc-500">
                        Фото
                      </span>
                    )}
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-[16px] font-bold text-zinc-950 shadow"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Удалить фото"
                    disabled={busy || Boolean(deletingPhotoId)}
                    onClick={() => void deletePhoto(photo)}
                    className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-0 left-0 flex h-11 w-11 items-end justify-start p-1.5 text-white transition disabled:opacity-50`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-[18px] font-medium leading-none backdrop-blur-sm"
                    >
                      ×
                    </span>
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={controlsBusy || libraryLoading}
              className={`${OVERLAY_BUTTON_UA_RESET} flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-600 bg-zinc-950/45 text-center transition hover:border-zinc-400 hover:bg-zinc-900 disabled:opacity-50`}
            >
              <span aria-hidden="true" className="text-[22px] leading-none text-zinc-400">
                +
              </span>
              <span className="mt-1 text-[13px] font-semibold leading-tight text-zinc-300">
                Загрузить
                <br />
                ещё
              </span>
            </button>
          </div>
          {!libraryLoading && !photos.length && (
            <p className="mt-2 text-[13px] font-medium text-zinc-500">
              Добавьте фото — оно сохранится для следующих генераций.
            </p>
          )}
        </section>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          void uploadFiles(files);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-1 gap-2">
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-zinc-500">Модель</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={controlsBusy || !models.length}
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
            <span className="mb-1 block text-[13px] font-medium text-zinc-500">Формат</span>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              disabled={controlsBusy || !aspectRatios.length}
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
            <span className="mb-1 block text-[13px] font-medium text-zinc-500">Качество</span>
            <select
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value)}
              disabled={controlsBusy || !imageSizes.length}
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

      {(busy || Boolean(error) || Boolean(configError)) && (
        <div className="space-y-1">
          {busy && (
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
              />
            </div>
          )}
          <p className="text-[13px] font-medium text-zinc-400">
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
        disabled={
          controlsBusy || libraryLoading || !selectedPhotos.length || Boolean(configError)
        }
        onClick={() => void runGenerate()}
        className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-300 px-4 py-3 text-[15px] font-semibold text-zinc-900 transition hover:bg-emerald-200 active:scale-[0.98] disabled:opacity-50`}
      >
        {phase === "done" ? "Сгенерировать ещё" : busy ? "Подождите…" : "Сгенерировать"}
      </button>
    </div>
  );
}
