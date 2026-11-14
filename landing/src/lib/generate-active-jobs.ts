export const MAX_PARALLEL_DOCK_JOBS = 3;
export const MAX_TRAY_DOCK_JOBS = 6;

export type DockJobStatus = "starting" | "running" | "completed" | "failed";

export type ActiveDockGenerationJob = {
  clientJobId: string;
  generationId: string | null;
  promptText: string;
  modality: "image" | "video";
  editKind: string | null;
  status: DockJobStatus;
  progress: number;
  startedAtMs: number;
  completedAtMs: number | null;
  sourcePreviewUrl: string | null;
  resultUrl: string | null;
  photoshootTileUrls: string[] | null;
  errorMessage: string | null;
  seen: boolean;
  listingVideoRepeat?: boolean;
};

export type ActiveDockJobsSummary = {
  activeCount: number;
  completedCount: number;
  failedCount: number;
  unseenCompletedCount: number;
  runBusy: boolean;
  displayProgress: number;
  fabLabel: string | null;
  mobileTabLabel: string | null;
};

export function isDockJobActive(job: Pick<ActiveDockGenerationJob, "status">): boolean {
  return job.status === "starting" || job.status === "running";
}

export function advanceSoftJobProgress(current: number): number {
  if (current >= 92) return current;
  const step = current < 40 ? 2.5 : current < 70 ? 1.2 : 0.45;
  return Math.min(92, current + step);
}

export function canStartAnotherDockJob(
  jobs: readonly ActiveDockGenerationJob[],
  maxParallel = MAX_PARALLEL_DOCK_JOBS,
): boolean {
  let active = 0;
  for (const job of jobs) {
    if (isDockJobActive(job)) active += 1;
  }
  return active < maxParallel;
}

export function summarizeActiveDockJobs(
  jobs: readonly ActiveDockGenerationJob[],
): ActiveDockJobsSummary {
  let activeCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let unseenCompletedCount = 0;
  let progressSum = 0;

  for (const job of jobs) {
    if (isDockJobActive(job)) {
      activeCount += 1;
      progressSum += Math.min(99, Math.max(4, job.progress || 6));
    } else if (job.status === "completed") {
      completedCount += 1;
      if (!job.seen) unseenCompletedCount += 1;
    } else if (job.status === "failed") {
      failedCount += 1;
    }
  }

  if (activeCount === 0) {
    return {
      activeCount: 0,
      completedCount,
      failedCount,
      unseenCompletedCount,
      runBusy: false,
      displayProgress: 0,
      fabLabel: null,
      mobileTabLabel: null,
    };
  }

  const displayProgress = Math.min(
    99,
    Math.max(6, Math.round(progressSum / activeCount)),
  );
  const fabLabel =
    activeCount === 1
      ? `Генерируем · ${displayProgress}%`
      : `${activeCount} в работе · ${displayProgress}%`;
  const mobileTabLabel =
    activeCount === 1 ? "Генерируем" : `${activeCount} в работе`;

  return {
    activeCount,
    completedCount,
    failedCount,
    unseenCompletedCount,
    runBusy: true,
    displayProgress,
    fabLabel,
    mobileTabLabel,
  };
}

export function pruneDockJobsHistory(
  jobs: readonly ActiveDockGenerationJob[],
  maxTotal = MAX_TRAY_DOCK_JOBS,
): ActiveDockGenerationJob[] {
  if (jobs.length <= maxTotal) return [...jobs];
  const active = jobs.filter(isDockJobActive);
  const terminal = jobs
    .filter((job) => !isDockJobActive(job))
    .sort(
      (a, b) =>
        (b.completedAtMs ?? b.startedAtMs) -
        (a.completedAtMs ?? a.startedAtMs),
    );
  const slotsForTerminal = Math.max(0, maxTotal - active.length);
  const keepIds = new Set([
    ...active.map((job) => job.clientJobId),
    ...terminal.slice(0, slotsForTerminal).map((job) => job.clientJobId),
  ]);
  return jobs.filter((job) => keepIds.has(job.clientJobId));
}
