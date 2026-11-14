"use client";

import { OVERLAY_BUTTON_UA_RESET } from "@/lib/card-overlay-action-pill";
import {
  canStartAnotherDockJob,
  isDockJobActive,
  MAX_PARALLEL_DOCK_JOBS,
  type ActiveDockGenerationJob,
} from "@/lib/generate-active-jobs";
import { PHOTOSHOOT_EDIT_KIND } from "@/lib/photoshoot";
import { STICKER_EDIT_KIND } from "@/lib/sticker";
import { STICKER_PACK_EDIT_KIND } from "@/lib/sticker-pack";

type Props = {
  jobs: readonly ActiveDockGenerationJob[];
  activeGenerationId: string | null;
  showingResult: boolean;
  glassChrome: boolean;
  onSelectCompletedJob: (job: ActiveDockGenerationJob) => void;
  onDismissJob: (clientJobId: string) => void;
  onNewCompose: () => void;
};

function shortJobKindLabel(job: ActiveDockGenerationJob): string {
  if (job.editKind === PHOTOSHOOT_EDIT_KIND) return "Фотосессия";
  if (job.editKind === STICKER_PACK_EDIT_KIND) return "Стикер пак";
  if (job.editKind === STICKER_EDIT_KIND) return "Стикер";
  if (job.modality === "video") return "Видео";
  const clean = job.promptText.trim();
  if (!clean || clean === "PHOTOSHOOT" || clean === "STICKER") return "Фото";
  return clean.length > 18 ? `${clean.slice(0, 18).trim()}…` : clean;
}

/**
 * Compact horizontal queue strip at the top of the generate dock.
 * Displays 1..3 concurrent running jobs with live % progress alongside
 * finished thumbnails from this session and a 1-tap «+ Ещё» button.
 */
export function ComposeActiveJobsTray({
  jobs,
  activeGenerationId,
  showingResult,
  glassChrome,
  onSelectCompletedJob,
  onDismissJob,
  onNewCompose,
}: Props) {
  if (!jobs.length) return null;

  const canLaunchMore = canStartAnotherDockJob(jobs, MAX_PARALLEL_DOCK_JOBS);

  return (
    <div
      role="region"
      aria-label="Очередь генераций"
      className={`relative z-30 flex shrink-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-3 pt-3 pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        showingResult ? "pr-24" : ""
      }`}
    >
      {jobs.map((job) => {
        const active = isDockJobActive(job);
        const completed = job.status === "completed" && Boolean(job.resultUrl);
        const failed = job.status === "failed";
        const isCurrentResult =
          showingResult &&
          completed &&
          Boolean(job.generationId) &&
          job.generationId === activeGenerationId;

        if (active) {
          const pct = Math.min(99, Math.max(6, Math.round(job.progress)));
          return (
            <div
              key={job.clientJobId}
              className={`relative isolate flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-xl pl-1.5 pr-3 text-[12px] font-semibold leading-none ${
                glassChrome
                  ? "bg-zinc-950/75 text-white ring-1 ring-white/20 backdrop-blur-xl"
                  : "bg-zinc-900 text-white"
              }`}
              aria-label={`В работе: ${shortJobKindLabel(job)}, ${pct}%`}
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 z-0 origin-left transition-transform duration-300 ease-out"
                style={{
                  width: "100%",
                  transform: `scaleX(${Math.min(1, Math.max(0.08, pct / 100))})`,
                  background:
                    "linear-gradient(90deg, rgba(99,102,241,0.38) 0%, rgba(139,92,246,0.38) 100%)",
                }}
                aria-hidden
              />
              <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                {job.sourcePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.sourcePreviewUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-70"
                  />
                ) : null}
                <span
                  className="absolute h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
              </span>
              <span className="relative z-10 flex flex-col gap-0.5">
                <span className="max-w-[6.5rem] truncate text-[11px] font-semibold text-white/95">
                  {shortJobKindLabel(job)}
                </span>
                <span className="text-[10px] font-semibold tabular-nums text-indigo-200">
                  {pct}%
                </span>
              </span>
            </div>
          );
        }

        if (completed) {
          return (
            <div
              key={job.clientJobId}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl pl-1.5 pr-1 text-[12px] font-semibold leading-none transition ${
                isCurrentResult
                  ? "bg-indigo-500/35 text-white ring-2 ring-indigo-300 backdrop-blur-xl"
                  : glassChrome
                    ? "bg-zinc-950/75 text-white/90 ring-1 ring-white/20 backdrop-blur-xl hover:bg-zinc-900/85"
                    : "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-200"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectCompletedJob(job)}
                className={`${OVERLAY_BUTTON_UA_RESET} flex items-center gap-2 text-left`}
                aria-label={`Открыть готовый результат: ${shortJobKindLabel(job)}`}
              >
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-800">
                  {job.modality === "video" ? (
                    <video
                      src={job.resultUrl!}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.resultUrl!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  {!job.seen && !isCurrentResult ? (
                    <span
                      className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-zinc-950"
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="max-w-[5.5rem] truncate text-[12px] font-semibold">
                  {isCurrentResult ? "Открыто" : "Готово"}
                </span>
              </button>
              <button
                type="button"
                aria-label="Убрать из очереди"
                onClick={() => onDismissJob(job.clientJobId)}
                className={`${OVERLAY_BUTTON_UA_RESET} flex h-6 w-6 items-center justify-center rounded-full opacity-65 transition hover:bg-white/15 hover:opacity-100`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          );
        }

        if (failed) {
          return (
            <div
              key={job.clientJobId}
              title={job.errorMessage || "Ошибка генерации"}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-rose-950/75 pl-2.5 pr-1 text-[12px] font-semibold leading-none text-rose-100 ring-1 ring-rose-400/35 backdrop-blur-xl"
            >
              <span className="max-w-[8rem] truncate">
                {job.errorMessage || "Ошибка"}
              </span>
              <button
                type="button"
                aria-label="Скрыть ошибку"
                onClick={() => onDismissJob(job.clientJobId)}
                className={`${OVERLAY_BUTTON_UA_RESET} flex h-6 w-6 items-center justify-center rounded-full opacity-75 transition hover:bg-white/15 hover:opacity-100`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          );
        }

        return null;
      })}

      {showingResult && canLaunchMore ? (
        <button
          type="button"
          onClick={onNewCompose}
          className={`${OVERLAY_BUTTON_UA_RESET} inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-indigo-500/85 px-3 text-[12px] font-semibold leading-none text-white ring-1 ring-white/20 backdrop-blur-xl transition hover:bg-indigo-500 active:scale-[0.98]`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          <span>Ещё</span>
        </button>
      ) : null}
    </div>
  );
}
