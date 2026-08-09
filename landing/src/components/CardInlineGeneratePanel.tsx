"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED,
  YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

type ModelOpt = { id: string; label: string; cost: number };
type RatioOpt = { value: string; label: string };
type SizeOpt = { value: string; label: string };
type GenerationPreferences = {
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  selectedPhotoIds?: string[];
};
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

function GoogleGenerationModelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62c.79-2.37 3-4.13 5.6-4.13Z" />
    </svg>
  );
}

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
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [imageSize, setImageSize] = useState("1K");
  const [configError, setConfigError] = useState("");
  const [maxPhotos, setMaxPhotos] = useState(10);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);

  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [needsCredits, setNeedsCredits] = useState(false);
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
        const [configRes, photosRes, preferencesRes] = await Promise.all([
          fetch("/api/generation-config"),
          fetch("/api/user-generation-photos", { credentials: "include" }),
          fetch("/api/generation-preferences", { credentials: "include" }),
        ]);
        if (!configRes.ok) throw new Error("config_failed");
        const configData = (await configRes.json()) as {
          models?: ModelOpt[];
          aspectRatios?: RatioOpt[];
          imageSizes?: SizeOpt[];
          defaults?: { model?: string; aspectRatio?: string; imageSize?: string };
          limits?: { maxPhotos?: number };
        };
        const photosData = (await photosRes.json().catch(() => ({}))) as {
          photos?: UserPhoto[];
          error?: string;
        };
        const preferencesData = preferencesRes.ok
          ? ((await preferencesRes.json().catch(() => ({}))) as {
              preferences?: GenerationPreferences | null;
            })
          : {};
        if (!photosRes.ok) {
          throw new Error(photosData.error || "Не удалось загрузить ваши фото");
        }
        if (cancelled) return;
        const nextModels = Array.isArray(configData.models) ? configData.models : [];
        const nextRatios = Array.isArray(configData.aspectRatios)
          ? configData.aspectRatios
          : [];
        const nextSizes = Array.isArray(configData.imageSizes) ? configData.imageSizes : [];
        const nextPhotos = Array.isArray(photosData.photos) ? photosData.photos : [];
        const preferences = preferencesData.preferences ?? null;
        const preferredModel = preferences?.model;
        const preferredRatio = preferences?.aspectRatio;
        const preferredSize = preferences?.imageSize;
        const defaultModel = configData.defaults?.model || nextModels[0]?.id;
        const defaultRatio = configData.defaults?.aspectRatio || nextRatios[0]?.value;
        const defaultSize = configData.defaults?.imageSize || nextSizes[0]?.value;
        setModels(nextModels);
        setAspectRatios(nextRatios);
        setImageSizes(nextSizes);
        setPhotos(nextPhotos);
        if (preferredModel && nextModels.some((item) => item.id === preferredModel)) {
          setModel(preferredModel);
        } else if (defaultModel) {
          setModel(defaultModel);
        }
        if (preferredRatio && nextRatios.some((item) => item.value === preferredRatio)) {
          setAspectRatio(preferredRatio);
        } else if (defaultRatio) {
          setAspectRatio(defaultRatio);
        }
        if (preferredSize && nextSizes.some((item) => item.value === preferredSize)) {
          setImageSize(preferredSize);
        } else if (defaultSize) {
          setImageSize(defaultSize);
        }
        const availablePhotoIds = new Set(nextPhotos.map((photo) => photo.id));
        const restoredPhotoIds = (preferences?.selectedPhotoIds ?? []).filter((id) =>
          availablePhotoIds.has(id)
        );
        setSelectedPhotoIds(
          restoredPhotoIds.length
            ? new Set(restoredPhotoIds)
            : nextPhotos[0]
              ? new Set([nextPhotos[0].id])
              : new Set()
        );
        if (typeof configData.limits?.maxPhotos === "number") {
          setMaxPhotos(Math.max(1, Math.min(10, configData.limits.maxPhotos)));
        }
        setPreferencesHydrated(true);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message !== "config_failed") {
            setError(err.message);
          } else {
            setConfigError("Не удалось загрузить параметры генерации");
          }
          setLibraryLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) return;
    setLibraryLoading(false);
    const timer = window.setTimeout(() => {
      void fetch("/api/generation-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          aspectRatio,
          imageSize,
          selectedPhotoIds: Array.from(selectedPhotoIds),
        }),
      }).then((res) => {
        if (!res.ok) console.warn("[generation-preferences] save failed", res.status);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [aspectRatio, imageSize, model, preferencesHydrated, selectedPhotoIds]);

  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.has(photo.id)),
    [photos, selectedPhotoIds]
  );

  const togglePhoto = (id: string) => {
    if (phase === "uploading" || phase === "generating") return;
    setError("");
    setNeedsCredits(false);
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
    setNeedsCredits(false);
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
          generationSurface: "prompt_card",
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
        if (genData.error === "insufficient_credits") {
          setNeedsCredits(true);
          reachYandexMetrikaGoal(
            YM_GOAL_PROMPT_CARD_GENERATION_NO_CREDITS,
            { feature_key: "prompt_card_generation", variant: "treatment" }
          );
        }
        throw new Error(genData.message || genData.error || "Не удалось создать генерацию");
      }
      reachYandexMetrikaGoal(
        YM_GOAL_PROMPT_CARD_GENERATION_ACCEPTED,
        { feature_key: "prompt_card_generation", variant: "treatment" }
      );
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
                  autoFocus
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
              className={`${OVERLAY_BUTTON_UA_RESET} relative flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-indigo-50 p-2 text-center text-zinc-900 ring-2 transition ${
                expandedControl === "model"
                  ? "ring-indigo-500"
                  : "ring-indigo-200 hover:bg-indigo-100 hover:ring-indigo-400"
              } disabled:opacity-50`}
            >
              <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                <GoogleGenerationModelIcon />
              </span>
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight">
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={controlsBusy || libraryLoading}
                  className={`${OVERLAY_BUTTON_UA_RESET} flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-100 text-center text-zinc-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  <span className="mt-1 text-[13px] font-semibold">Добавить</span>
                </button>
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
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-md"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  );
                })}
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
              <div className="grid grid-cols-2 gap-2">
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
                      className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-20 min-w-0 items-center gap-3 overflow-hidden rounded-xl p-3 text-left ring-2 transition ${
                        selected
                          ? "bg-indigo-50 text-zinc-900 ring-indigo-500 shadow-sm"
                          : "bg-zinc-100 text-zinc-900 ring-zinc-200 hover:bg-zinc-200 hover:ring-zinc-300"
                      } disabled:opacity-50`}
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
                      >
                        <GoogleGenerationModelIcon />
                      </span>
                      <span className="min-w-0 flex-1 pr-5">
                        <span className="block truncate text-[13px] font-semibold leading-tight">
                          {displayLabelForGenerationModel(item.id, item.label)}
                        </span>
                        <span
                          className="mt-1 block line-clamp-2 text-xs font-medium leading-tight text-zinc-500"
                        >
                          {display?.description || "Генерация изображений"}
                        </span>
                      </span>
                      <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        selected ? "bg-indigo-100 text-indigo-700" : "bg-white text-zinc-500"
                      }`}>
                        {item.cost} кр.
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
            {needsCredits ? (
              <Link
                href="/pricing"
                onClick={() =>
                  reachYandexMetrikaGoal(
                    YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
                    {
                      feature_key: "prompt_card_generation",
                      variant: "treatment",
                    }
                  )
                }
                className={`mt-2 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-[13px] font-semibold transition ${
                  resultUrl
                    ? "bg-white text-zinc-900 hover:bg-zinc-100"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Посмотреть тарифы
              </Link>
            ) : null}
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
            className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-black/25 px-2 py-3 text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-black/40 active:scale-[0.99] disabled:opacity-50`}
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
        {phase === "done" && resultUrl && generationId ? (
          <button
            type="button"
            disabled={
              controlsBusy ||
              libraryLoading ||
              Boolean(busyAction) ||
              !selectedPhotos.length ||
              Boolean(configError)
            }
            onClick={() => void runGenerate({ promptOverride: draftPrompt })}
            className={`${OVERLAY_BUTTON_UA_RESET} flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-black/25 px-2 py-3 text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-black/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M20 7v5h-5M4 17v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.2 9A7 7 0 0 0 6.4 6.4L4 9m2 6a7 7 0 0 0 11.6 2.6L20 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">Повторить</span>
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
          className={`${OVERLAY_BUTTON_UA_RESET} relative flex min-h-12 min-w-0 items-center justify-center overflow-hidden rounded-2xl py-3 font-semibold text-white shadow-lg shadow-indigo-950/35 transition active:scale-[0.99] disabled:cursor-not-allowed ${
            phase === "done" && resultUrl
              ? "flex-1 px-2 text-[13px]"
              : "w-full px-4 text-[15px]"
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
          <span className="relative z-10 flex min-w-0 items-center justify-center gap-1.5">
            {phase === "done" && resultUrl ? (
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m14.5 6.7 2.8 2.8" />
              </svg>
            ) : null}
            <span className={phase === "done" && resultUrl ? "truncate" : undefined}>
              {phase === "uploading"
                ? `Загружаем фото · ${Math.round(progress)}%`
                : phase === "generating"
                  ? `Генерируем · ${Math.round(progress)}%`
                  : phase === "done" && resultUrl
                    ? "Что изменить"
                    : "Сгенерировать"}
            </span>
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
