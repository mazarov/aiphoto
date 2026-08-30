"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { usePricingModal } from "@/context/PricingModalContext";
import { COMPOSE_BUY_CREDITS_CTA } from "@/lib/generate-compose-mode";
import { GENERACIYA_FOTO_SEO } from "@/lib/generaciya-foto-seo-copy";
import { requestCreditBalanceRefresh } from "@/lib/credit-balance-events";
import {
  analyzeImageToPrompt,
  fetchAnalyzeQuota,
  type AnalyzeQuotaPayload,
} from "@/lib/image-prompt-analyze-client";
import {
  noticeForUploadError,
  prepareUploadFile,
} from "@/lib/image-upload-prepare";
import { AnalyzeQuotaChip } from "@/components/foto-v-promt/AnalyzeQuotaChip";
import { GF_BLOCK, GF_STACK } from "@/components/generate/generaciya-foto-ui";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN,
  YM_GOAL_GENERATION_PHOTO_PROMPT_READY,
  YM_GOAL_GENERATION_PHOTO_PROMPT_START,
  YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD,
  YM_GOAL_ANALYZE_AUTH_REQUIRED,
  YM_GOAL_ANALYZE_NO_CREDITS,
  YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
} from "@/lib/yandex-metrika";

const FILE_INPUT_ACCEPT =
  ".jpg,.jpeg,.jpe,.png,.webp,image/jpeg,image/png,image/webp,image/*";

type StarterMode = "text" | "photo";

const MODES: Array<{
  id: StarterMode;
  title: string;
  description: string;
}> = [
  {
    id: "text",
    title: GENERACIYA_FOTO_SEO.starterByTextTitle,
    description: GENERACIYA_FOTO_SEO.starterByTextLead,
  },
  {
    id: "photo",
    title: GENERACIYA_FOTO_SEO.starterByPhotoTitle,
    description: GENERACIYA_FOTO_SEO.starterByPhotoLead,
  },
];

function ModeIcon({ mode }: { mode: StarterMode }) {
  if (mode === "photo") {
    return (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
      </svg>
    );
  }

  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  );
}

export function GeneraciyaFotoStarter() {
  const [mode, setMode] = useState<StarterMode>("text");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzeQuota, setAnalyzeQuota] = useState<AnalyzeQuotaPayload | null>(null);
  const textTabRef = useRef<HTMLButtonElement>(null);
  const photoTabRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const processingFileRef = useRef(false);
  const { open: openPricing } = usePricingModal();
  const { user, openAuthModal } = useAuth();
  const { seedBlankPrompt, needsCredits, runBusy, runProgress } =
    useGenerateDock();
  const isAuthed = Boolean(user && user.is_anonymous !== true);

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    void fetchAnalyzeQuota().then((next) => {
      if (next) setAnalyzeQuota(next);
    });
  }, [isAuthed]);

  const selectMode = (nextMode: StarterMode) => {
    setMode(nextMode);
    setAnalyzeError("");
    if (nextMode === "text") {
      analyzeAbortRef.current?.abort();
      setAnalyzing(false);
    }
    if (nextMode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_OPEN);
    }
  };

  const analyzePhotoAndOpenComposer = async (file: File) => {
    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    setAnalyzing(true);
    setAnalyzeError("");
    reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_UPLOAD);

    try {
      const prepared = await prepareUploadFile(file);
      if (!prepared.ok) {
        setAnalyzeError(
          noticeForUploadError(prepared.error, (key) => {
            if (key === "tooLarge") return "Файл слишком большой (макс. 10 МБ)";
            if (key === "readFailed") return "Не удалось прочитать файл";
            return "Недопустимый тип файла";
          })
        );
        return;
      }
      const result = await analyzeImageToPrompt(prepared.dataUrl, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!result.ok) {
        if (result.quota) setAnalyzeQuota(result.quota);
        if (result.authRequired) {
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_AUTH_REQUIRED);
          openAuthModal("analyze_quota");
        } else if (result.noCredits) {
          reachYandexMetrikaGoal(YM_GOAL_ANALYZE_NO_CREDITS);
          openPricing();
        }
        setAnalyzeError(result.message);
        return;
      }
      if (result.quota) setAnalyzeQuota(result.quota);
      if (result.quota?.credits_charged) {
        requestCreditBalanceRefresh();
      }
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_READY);
      seedBlankPrompt(result.prompt, {
        entrySource: "route",
        intent: "photo_prompt",
        dockSurface: "prompt",
      });
    } catch {
      if (controller.signal.aborted) return;
      setAnalyzeError(
        "Не удалось обработать фото. Проверьте соединение и попробуйте снова."
      );
    } finally {
      processingFileRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (analyzeAbortRef.current === controller) {
        setAnalyzing(false);
      }
    }
  };

  const onPhotoFileChange = (
    event: ChangeEvent<HTMLInputElement> | FormEvent<HTMLInputElement>
  ) => {
    if (processingFileRef.current) return;
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;
    processingFileRef.current = true;
    void analyzePhotoAndOpenComposer(file);
  };

  const openComposer = (nextMode: StarterMode = mode) => {
    if (analyzing) return;
    if (!isAuthed) {
      openAuthModal();
      return;
    }
    if (needsCredits || (nextMode === "photo" && analyzeQuota?.next_mode === "no_credits")) {
      reachYandexMetrikaGoal(
        nextMode === "photo" && analyzeQuota?.next_mode === "no_credits"
          ? YM_GOAL_ANALYZE_NO_CREDITS
          : YM_GOAL_PROMPT_CARD_GENERATION_PRICING,
      );
      openPricing();
      return;
    }
    if (nextMode === "photo") {
      reachYandexMetrikaGoal(YM_GOAL_GENERATION_PHOTO_PROMPT_START);
      fileInputRef.current?.click();
      return;
    }
    seedBlankPrompt("", {
      entrySource: "route",
      intent: "text",
      dockSurface: "prompt",
    });
  };

  const onModeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    nextMode: StarterMode
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const other = nextMode === "text" ? "photo" : "text";
      selectMode(other);
      (other === "photo" ? photoTabRef : textTabRef).current?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectMode(nextMode);
      openComposer(nextMode);
    }
  };

  return (
    <div className={`mt-8 w-full text-left sm:mt-10 ${GF_BLOCK}`}>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="tablist"
        aria-label="Способ создания изображения"
      >
        {MODES.map((item) => {
          const selected = mode === item.id;
          const isPhoto = item.id === "photo";
          return (
            <div
              key={item.id}
              className={`relative rounded-2xl border transition ${
                selected
                  ? "border-transparent bg-white text-zinc-900 shadow-sm ring-2 ring-indigo-500"
                  : "border-indigo-100/90 bg-white/70 text-zinc-600 hover:bg-white"
              }`}
            >
              <button
                ref={item.id === "text" ? textTabRef : photoTabRef}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectMode(item.id)}
                onKeyDown={(event) => onModeKeyDown(event, item.id)}
                className="flex min-h-11 w-full items-start gap-4 p-4 text-left sm:p-5"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    selected
                      ? "bg-indigo-50 text-indigo-600"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  <ModeIcon mode={item.id} />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={`block text-base font-semibold text-zinc-900 ${
                      isPhoto && analyzeQuota ? "pr-16" : ""
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-zinc-600">
                    {item.description}
                  </span>
                </span>
              </button>
              {isPhoto && analyzeQuota ? (
                <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
                  <AnalyzeQuotaChip
                    quota={analyzeQuota}
                    tone="light"
                    compact
                    minimal
                    countAs="used"
                    onSignIn={() => openAuthModal("analyze_quota")}
                    onTopUp={() => openPricing()}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={`${GF_STACK} flex flex-col items-center`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={onPhotoFileChange}
          onInput={onPhotoFileChange}
        />
        <button
          type="button"
          id="generaciya-foto-starter-cta"
          onClick={() => openComposer()}
          disabled={analyzing}
          aria-busy={analyzing || runBusy || undefined}
          aria-valuemin={runBusy ? 0 : undefined}
          aria-valuemax={runBusy ? 100 : undefined}
          aria-valuenow={runBusy ? Math.round(runProgress) : undefined}
          className={`relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full px-8 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-wait ${
            analyzing || runBusy
              ? ""
              : "bg-gradient-to-r from-indigo-500 via-[#5b5cf0] to-violet-500 shadow-lg shadow-indigo-500/20 hover:brightness-105"
          }`}
          style={
            analyzing || runBusy
              ? { backgroundColor: "rgba(39,39,42,0.95)" }
              : undefined
          }
        >
          {runBusy && !analyzing ? (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 z-0 origin-left transition-transform duration-300 ease-out"
              style={{
                width: "100%",
                transform: `scaleX(${Math.min(1, Math.max(0.06, runProgress / 100))})`,
                background:
                  "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
              }}
              aria-hidden
            />
          ) : null}
          <span className="relative z-10 inline-flex items-center">
            {analyzing
              ? "Составляем промт…"
              : runBusy
                ? `Генерируем · ${Math.round(runProgress)}%`
                : needsCredits
                  || (isAuthed && mode === "photo" && analyzeQuota?.next_mode === "no_credits")
                  ? COMPOSE_BUY_CREDITS_CTA
                  : isAuthed
                    ? "Создать фото"
                    : "Войти и создать фото"}
          </span>
        </button>
        {analyzeError ? (
          <p className="mt-3 max-w-md text-center text-sm text-rose-600" role="status">
            {analyzeError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
