"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import {
  GENERATION_MODEL_DISPLAY,
  displayLabelForGenerationModel,
} from "@/lib/generation-model-labels";
import { noticeForUploadError, prepareUploadFile } from "@/lib/image-upload-prepare";
import { copyTextUniversal } from "@/lib/copy-text-to-clipboard";
import {
  GenerationCardMenu,
  type GenerationMenuAction,
} from "@/components/GenerationCardMenu";
import {
  downloadGenerationResult,
  shareGenerationResult,
} from "@/lib/generation-result-client-actions";
import { getGenerationPromptRemixUrl } from "@/lib/foto-v-promt-config";
import { PROMPT_REMIX_COPY } from "@/lib/foto-v-promt-copy";

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
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState(promptText);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<GenerationMenuAction | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [toast, setToast] = useState("");
  const [expandedControl, setExpandedControl] = useState<"photos" | "model" | null>(null);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [remixing, setRemixing] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setDraftPrompt(promptText);
  }, [cardId, promptText]);

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

  const runGenerate = async (options?: {
    promptOverride?: string;
    parentGenerationId?: string;
    editInstruction?: string;
  }): Promise<boolean> => {
    const parentGenerationId = options?.parentGenerationId?.trim() || "";
    const editInstruction = options?.editInstruction?.trim() || "";
    const isContinuation = Boolean(parentGenerationId);
    if (!isContinuation && !selectedPhotos.length) {
      setError("Выберите хотя бы одно фото");
      return false;
    }
    if (isContinuation && !editInstruction) {
      setError("Опишите, что изменить");
      return false;
    }
    const prompt = (options?.promptOverride ?? draftPrompt).trim();
    if (prompt.length < 8) {
      setError("Промпт слишком короткий");
      return false;
    }

    setError("");
    if (!isContinuation) {
      setResultUrl(null);
      setGenerationId(null);
    }
    setMenuOpen(false);
    setExpandedControl(null);
    setPromptExpanded(false);
    setPhase("generating");
    setProgress(20);

    try {
      const idempotencyKey = crypto.randomUUID();
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio,
          imageSize,
          cardId,
          photoStoragePaths: isContinuation
            ? []
            : selectedPhotos.map((photo) => photo.storagePath),
          parentGenerationId: parentGenerationId || null,
          editInstruction: editInstruction || null,
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
      if (!isContinuation) setGenerationId(genData.id);
      setDraftPrompt(prompt);
      setSubmittedPrompt(prompt);
      setIsPublished(false);
      requestCreditBalanceRefresh();

      while (true) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        let pollRes: Response;
        try {
          pollRes = await fetch(`/api/generations/${genData.id}`, {
            credentials: "include",
          });
        } catch {
          setError("Связь прервана, генерация продолжается…");
          continue;
        }
        const poll = (await pollRes.json().catch(() => ({}))) as {
          status?: string;
          progress?: number;
          resultUrl?: string;
          errorMessage?: string;
          error?: string;
        };
        if (!pollRes.ok) {
          if (pollRes.status >= 500) {
            setError("Сервис временно недоступен, генерация продолжается…");
            continue;
          }
          throw new Error(poll.errorMessage || poll.error || "Ошибка статуса генерации");
        }
        setError("");
        if (typeof poll.progress === "number") setProgress(Math.max(20, poll.progress));
        if (poll.status === "completed" && poll.resultUrl) {
          setGenerationId(genData.id);
          setResultUrl(poll.resultUrl);
          setProgress(100);
          setPhase("done");
          requestCreditBalanceRefresh();
          return true;
        }
        if (poll.status === "failed") {
          requestCreditBalanceRefresh();
          throw new Error(poll.errorMessage || "Генерация не удалась");
        }
      }
    } catch (err) {
      setPhase(isContinuation ? "done" : "error");
      setError(err instanceof Error ? err.message : "Ошибка генерации");
      return false;
    }
  };

  const applyPromptRemix = async () => {
    const basePrompt = draftPrompt.trim();
    const requestedChange = changeRequest.trim();
    const parentGenerationId =
      resultUrl && generationId ? generationId : null;
    if (
      basePrompt.length < 8 ||
      !requestedChange ||
      remixing ||
      phase === "generating"
    ) {
      return;
    }

    setRemixing(true);
    setError("");
    try {
      const remixRes = await fetch(getGenerationPromptRemixUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: basePrompt,
          parentGenerationId,
          changeRequest: requestedChange,
        }),
      });
      const remixData = (await remixRes.json().catch(() => ({}))) as {
        prompt?: string;
        error?: string;
        message?: string;
      };
      if (!remixRes.ok) {
        throw new Error(
          remixRes.status === 429
            ? remixData.message || PROMPT_REMIX_COPY.errorRateLimited
            : remixData.message || PROMPT_REMIX_COPY.errorGeneric
        );
      }
      const nextPrompt = remixData.prompt?.trim() || "";
      if (nextPrompt.length < 8) {
        throw new Error(PROMPT_REMIX_COPY.errorGeneric);
      }
      setDraftPrompt(nextPrompt);
      setChangeRequest("");
      if (parentGenerationId) {
        await runGenerate({
          promptOverride: nextPrompt,
          parentGenerationId,
          editInstruction: requestedChange,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : PROMPT_REMIX_COPY.errorGeneric);
    } finally {
      setRemixing(false);
    }
  };

  const handleResultAction = async (action: GenerationMenuAction) => {
    if (!resultUrl || !generationId || busyAction) return;

    if (action === "select") return;

    if (action === "share") {
      setMenuOpen(false);
      try {
        const mode = await shareGenerationResult(resultUrl);
        if (mode === "copied") setToast("Ссылка скопирована");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setToast("Не удалось поделиться");
      }
      return;
    }

    if (action === "download") {
      setBusyAction("download");
      try {
        await downloadGenerationResult(resultUrl, `promptshot-${generationId}.jpg`);
        setMenuOpen(false);
      } catch {
        setToast("Не удалось скачать");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "copyPrompt") {
      setMenuOpen(false);
      const ok = await copyTextUniversal(submittedPrompt || draftPrompt);
      setToast(ok ? "Промпт скопирован" : "Не удалось скопировать");
      return;
    }

    if (action === "use") {
      setBusyAction("use");
      try {
        const res = await fetch(`/api/generations/${generationId}/save-to-library`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          photo?: UserPhoto;
        };
        if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
        if (data.photo) {
          setPhotos((current) => [
            data.photo!,
            ...current.filter((photo) => photo.id !== data.photo!.id),
          ]);
          setSelectedPhotoIds((current) => {
            if (current.has(data.photo!.id) || current.size >= maxPhotos) return current;
            return new Set([...current, data.photo!.id]);
          });
        }
        setMenuOpen(false);
        setToast("Сохранено для генерации");
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось сохранить");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "publish") {
      setBusyAction("publish");
      try {
        const res = await fetch(`/api/generations/${generationId}/publish`, {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось опубликовать");
        setIsPublished(true);
        setMenuOpen(false);
        setToast("Карточка опубликована");
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось опубликовать");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Удалить эту генерацию?")) return;
      setBusyAction("delete");
      try {
        const res = await fetch(`/api/generations/${generationId}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Не удалось удалить");
        setMenuOpen(false);
        setResultUrl(null);
        setGenerationId(null);
        setSubmittedPrompt("");
        setProgress(0);
        setPhase("idle");
        setToast("Генерация удалена");
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Не удалось удалить");
      } finally {
        setBusyAction(null);
      }
    }
  };

  const busy = phase === "uploading" || phase === "generating";
  const controlsBusy = busy || Boolean(deletingPhotoId);
  const isMobile = layout === "mobile";
  const activePrompt = draftPrompt;
  const openPromptEditor = () => {
    setError("");
    setExpandedControl(null);
    setPromptExpanded(true);
  };

  return (
    <div
      className={`relative isolate flex min-h-0 flex-1 flex-col overflow-hidden text-zinc-100 ${
        isMobile ? "h-full min-h-[100dvh]" : ""
      } ${
        resultUrl ? "bg-transparent" : "bg-white text-zinc-900"
      }`}
    >
      {resultUrl ? (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.38)_0%,rgba(9,9,11,0.04)_42%,rgba(9,9,11,0.44)_100%)]" />
        </div>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.16),transparent_38%),#09090b]"
          aria-hidden
        />
      )}

      <header
        className={`relative z-30 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-3 backdrop-blur-md ${
          isMobile ? "pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]" : "py-2"
        } ${
          resultUrl ? "border-white/10 bg-black/15" : "border-zinc-200 bg-white/90"
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold backdrop-blur-md transition disabled:opacity-50 ${
            resultUrl
              ? "bg-black/25 text-white hover:bg-black/40"
              : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
          }`}
        >
          Назад
        </button>
        <span
          className={`text-[13px] font-semibold ${
            resultUrl ? "text-white/85" : "text-zinc-700"
          }`}
        >
          {phase === "generating" ? "Генерируем" : resultUrl ? "Готово" : "Новая генерация"}
        </span>
        {resultUrl && generationId && phase === "done" ? (
          <div className="relative" data-generation-menu-root>
            <button
              type="button"
              aria-label="Действия с фото"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition hover:bg-black/40`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="12" cy="19" r="1.75" />
              </svg>
            </button>
            <GenerationCardMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              showSelect={false}
              hasResult
              hasPrompt={Boolean(activePrompt.trim())}
              canPublish
              isPublished={isPublished}
              busyAction={busyAction}
              onAction={(action) => {
                void handleResultAction(action);
              }}
            />
          </div>
        ) : (
          <span className="h-11 w-11" aria-hidden />
        )}
      </header>

      <div
        className={`flex min-h-0 flex-1 flex-col ${
          isMobile ? "px-3 py-3" : "px-3 py-2.5"
        }`}
      >
        <div className="mt-auto space-y-3">
        {promptExpanded ? (
          <button
            type="button"
            aria-label="Свернуть промпт"
            className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px]`}
            onClick={() => setPromptExpanded(false)}
          />
        ) : null}

        <section
          role={promptExpanded ? "dialog" : undefined}
          aria-modal={promptExpanded ? "true" : undefined}
          aria-labelledby={promptExpanded ? "inline-prompt-editor-title" : undefined}
          className={`border shadow-none ${
            promptExpanded
              ? "absolute inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex min-h-0 flex-col rounded-t-3xl border-transparent bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]"
              : "rounded-2xl px-3 py-1 backdrop-blur-md"
          } ${
            promptExpanded
              ? ""
              : resultUrl
              ? "border-white/15 bg-black/15 text-white"
              : "border-zinc-200 bg-white/95 text-zinc-900"
          }`}
        >
          {promptExpanded ? (
            <>
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-zinc-300" aria-hidden />
              <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
                <h3 id="inline-prompt-editor-title" className="text-[13px] font-semibold">
                  {resultUrl ? "Изменить картинку" : "Промпт"}
                </h3>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => setPromptExpanded(false)}
                  className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <label className="flex min-h-0 flex-1 flex-col">
                <span className="mb-2 block text-[13px] font-semibold text-zinc-700">
                  Текущий промпт
                </span>
                <textarea
                  value={draftPrompt}
                  onChange={(event) => setDraftPrompt(event.target.value)}
                  maxLength={8000}
                  disabled={busy || remixing}
                  autoFocus
                  className="min-h-0 w-full flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[13px] font-medium leading-relaxed text-zinc-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />
              </label>
              <label className="mt-3 block shrink-0">
                <span className="mb-2 block text-[13px] font-semibold text-zinc-700">
                  {PROMPT_REMIX_COPY.changeLabel}
                </span>
                <textarea
                  value={changeRequest}
                  onChange={(event) => setChangeRequest(event.target.value)}
                  placeholder={PROMPT_REMIX_COPY.changePlaceholder}
                  maxLength={1000}
                  rows={3}
                  disabled={busy || remixing}
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-[13px] font-medium leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />
              </label>
              {error ? (
                <p className="mt-2 text-[13px] font-medium text-rose-600">{error}</p>
              ) : null}
              <button
                type="button"
                disabled={
                  controlsBusy ||
                  draftPrompt.trim().length < 8 ||
                  !changeRequest.trim() ||
                  remixing
                }
                onClick={() => void applyPromptRemix()}
                className={`${OVERLAY_BUTTON_UA_RESET} mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-[13px] font-semibold text-white shadow-lg shadow-indigo-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {remixing
                  ? resultUrl && generationId
                    ? "Применяем и генерируем…"
                    : "Переписываем промпт…"
                  : resultUrl && generationId
                    ? "Применить и сгенерировать"
                    : "Применить изменение"}
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-expanded="false"
              onClick={openPromptEditor}
              className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-11 w-full items-center gap-3 text-left`}
            >
              <span className="shrink-0 text-[13px] font-semibold">Промпт</span>
              <span
                className={`min-w-0 flex-1 truncate text-[13px] font-medium ${
                  resultUrl ? "text-white/70" : "text-zinc-500"
                }`}
              >
                {activePrompt}
              </span>
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
          )}
        </section>

        <section
          className={`rounded-2xl border p-2 ${
            resultUrl ? "border-white/15 bg-black/15" : "border-zinc-200 bg-white/95"
          }`}
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-expanded={expandedControl === "photos"}
              aria-controls="inline-generation-photos"
              disabled={controlsBusy}
              onClick={() => {
                setPromptExpanded(false);
                setExpandedControl((current) => (current === "photos" ? null : "photos"));
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-xl text-left ring-2 transition ${
                expandedControl === "photos"
                  ? "ring-indigo-300"
                  : resultUrl
                    ? "bg-black/20 ring-white/10 hover:ring-white/25"
                    : "bg-zinc-100 ring-zinc-200 hover:ring-zinc-300"
              } disabled:opacity-50`}
            >
              {selectedPhotos[0]?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPhotos[0].previewUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-zinc-300">
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden
                  >
                    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m5 17 4.5-4 3.2 2.7 2.5-2.2L19 17" />
                  </svg>
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
              <span className="absolute inset-x-2 bottom-1.5 text-[13px] font-semibold text-white">
                Ваши фото
              </span>
              <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                {selectedPhotos.length}/{maxPhotos}
              </span>
            </button>

            <button
              type="button"
              aria-expanded={expandedControl === "model"}
              aria-controls="inline-generation-models"
              disabled={controlsBusy || !models.length}
              onClick={() => {
                setPromptExpanded(false);
                setExpandedControl((current) => (current === "model" ? null : "model"));
              }}
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500/35 via-violet-500/20 to-black/30 p-2 text-center ring-2 transition ${
                expandedControl === "model"
                  ? "ring-indigo-300"
                  : "ring-white/10 hover:ring-white/25"
              } disabled:opacity-50`}
            >
              <svg
                className="mb-1 h-6 w-6 text-indigo-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden
              >
                <path
                  d="M12 3.5c.8 4.4 3.1 6.7 7.5 7.5-4.4.8-6.7 3.1-7.5 7.5-.8-4.4-3.1-6.7-7.5-7.5 4.4-.8 6.7-3.1 7.5-7.5Z"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-white">
                {displayLabelForGenerationModel(
                  model,
                  models.find((item) => item.id === model)?.label
                )}
              </span>
            </button>

            <p
              className={`min-w-0 flex-1 self-center text-[13px] font-medium leading-snug ${
                resultUrl ? "text-white/70" : "text-zinc-500"
              }`}
            >
              Нажмите на квадрат, чтобы изменить выбор.
            </p>
          </div>

          {expandedControl ? (
            <button
              type="button"
              aria-label="Закрыть выбор"
              className={`${OVERLAY_BUTTON_UA_RESET} absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px]`}
              onClick={() => setExpandedControl(null)}
            />
          ) : null}

          {expandedControl === "photos" ? (
            <div
              id="inline-generation-photos"
              role="dialog"
              aria-modal="true"
              aria-label="Выбор фотографий"
              className="absolute inset-x-0 bottom-0 z-50 max-h-[min(76dvh,38rem)] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]"
            >
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-zinc-300" aria-hidden />
              <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-zinc-900">
                  Ваши фото · {selectedPhotos.length}/{maxPhotos}
                </span>
                {libraryLoading ? (
                  <span className="text-[13px] font-medium text-zinc-500">Загрузка…</span>
                ) : (
                  <button
                    type="button"
                    aria-label="Закрыть выбор фотографий"
                    onClick={() => setExpandedControl(null)}
                    className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`}
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo) => {
                  const selected = selectedPhotoIds.has(photo.id);
                  const deleting = deletingPhotoId === photo.id;
                  return (
                    <div
                      key={photo.id}
                      className={`group relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-2 transition ${
                        selected ? "ring-indigo-300" : "ring-white/10"
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
                          <span className="flex h-full items-center justify-center text-[13px] font-medium text-zinc-400">
                            Фото
                          </span>
                        )}
                        {selected ? (
                          <span
                            aria-hidden
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-300 text-[13px] font-bold text-zinc-950 shadow"
                          >
                            ✓
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        aria-label="Удалить фото"
                        disabled={busy || Boolean(deletingPhotoId)}
                        onClick={() => void deletePhoto(photo)}
                        className={`${OVERLAY_BUTTON_UA_RESET} absolute bottom-0 left-0 z-10 flex h-11 w-11 items-end justify-start p-1.5 text-white disabled:opacity-50`}
                      >
                        <span
                          aria-hidden
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[18px] leading-none backdrop-blur-md"
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
                  className={`${OVERLAY_BUTTON_UA_RESET} flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-black/20 text-center transition hover:border-indigo-300/70 hover:bg-black/30 disabled:opacity-50`}
                >
                  <svg
                    className="h-5 w-5 text-zinc-200"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span className="mt-1 text-[13px] font-semibold text-white">Добавить</span>
                </button>
              </div>
              {!libraryLoading && !photos.length ? (
                <p className="mt-2 text-[13px] font-medium text-zinc-600">
                  Добавьте фото — оно сохранится для следующих генераций.
                </p>
              ) : null}
            </div>
          ) : null}

          {expandedControl === "model" ? (
            <div
              id="inline-generation-models"
              role="dialog"
              aria-modal="true"
              aria-label="Выбор модели"
              className="absolute inset-x-0 bottom-0 z-50 max-h-[min(82dvh,44rem)] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-900 shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.45)]"
            >
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-zinc-300" aria-hidden />
              <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-zinc-900">Модель генерации</span>
                <button
                  type="button"
                  aria-label="Закрыть выбор модели"
                  onClick={() => setExpandedControl(null)}
                  className={`${OVERLAY_BUTTON_UA_RESET} flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {models.map((item) => {
                  const selected = model === item.id;
                  const display = GENERATION_MODEL_DISPLAY[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={controlsBusy}
                      title={display?.description || item.label}
                      onClick={() => setModel(item.id)}
                      className={`${OVERLAY_BUTTON_UA_RESET} relative flex aspect-square min-h-20 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500/30 via-violet-500/15 to-black/30 p-2 text-center ring-2 transition ${
                        selected
                          ? "ring-indigo-300 shadow-lg shadow-indigo-950/30"
                          : "ring-white/10 hover:ring-white/25"
                      } disabled:opacity-50`}
                    >
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md">
                        {item.cost} кр.
                      </span>
                      <svg
                        className="mb-1 h-6 w-6 text-indigo-100"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden
                      >
                        <path
                          d="M12 3.5c.8 4.4 3.1 6.7 7.5 7.5-4.4.8-6.7 3.1-7.5 7.5-.8-4.4-3.1-6.7-7.5-7.5 4.4-.8 6.7-3.1 7.5-7.5Z"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-white">
                        {displayLabelForGenerationModel(item.id, item.label)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[13px] font-medium text-zinc-600">
                    Формат
                  </span>
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value)}
                    disabled={controlsBusy || !aspectRatios.length}
                    className="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-[13px] font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 disabled:opacity-50"
                  >
                    {aspectRatios.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[13px] font-medium text-zinc-600">
                    Качество
                  </span>
                  <select
                    value={imageSize}
                    onChange={(event) => setImageSize(event.target.value)}
                    disabled={controlsBusy || !imageSizes.length}
                    className="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-[13px] font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 disabled:opacity-50"
                  >
                    {imageSizes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void uploadFiles(files);
            event.target.value = "";
          }}
        />

        {Boolean(error) || Boolean(configError) ? (
          <div
            className={`rounded-xl border p-3 backdrop-blur-md ${
              resultUrl ? "border-white/15 bg-black/15" : "border-rose-200 bg-rose-50"
            }`}
          >
            <p
              className={`text-[13px] font-medium ${
                resultUrl ? "text-rose-200" : "text-rose-700"
              }`}
            >
              {configError || error}
            </p>
          </div>
        ) : null}
        </div>
      </div>

      <footer
        className={`relative z-20 shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md ${
          resultUrl ? "border-white/10 bg-black/15" : "border-zinc-200 bg-white/90"
        }`}
      >
        <div className="flex gap-2">
        {phase === "done" && resultUrl && generationId ? (
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => void handleResultAction("download")}
            className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 basis-[38%] items-center justify-center gap-2 rounded-2xl bg-black/25 px-3 py-3 text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-black/40 active:scale-[0.99] disabled:opacity-50`}
          >
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">
              {busyAction === "download" ? "Скачиваем…" : "Скачать"}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          aria-busy={busy}
          disabled={
            controlsBusy ||
            libraryLoading ||
            Boolean(busyAction) ||
            (!(phase === "done" && resultUrl && generationId) &&
              !selectedPhotos.length) ||
            Boolean(configError)
          }
          onClick={() => {
            if (phase === "done" && resultUrl && generationId) {
              openPromptEditor();
              return;
            }
            void runGenerate({ promptOverride: draftPrompt });
          }}
          className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-12 min-w-0 items-center justify-center overflow-hidden rounded-2xl px-4 py-3 text-[15px] font-semibold text-white shadow-lg shadow-indigo-950/35 transition active:scale-[0.99] disabled:cursor-not-allowed ${
            phase === "done" && resultUrl ? "flex-1" : "w-full"
          } ${
            busy
              ? "bg-white/10"
              : "bg-gradient-to-r from-indigo-500 to-violet-500 hover:brightness-110 disabled:opacity-50"
          }`}
        >
          {busy ? (
            <span
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
              aria-hidden
            />
          ) : null}
          <span className="relative z-10">
            {phase === "uploading"
              ? `Загружаем фото · ${Math.round(progress)}%`
              : phase === "generating"
                ? `Генерируем · ${Math.round(progress)}%`
                : phase === "done" && resultUrl
                  ? "Что изменить"
                  : "Сгенерировать"}
          </span>
        </button>
        </div>
      </footer>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-20 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-zinc-900/95 px-4 py-2 text-center text-[13px] font-medium text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
