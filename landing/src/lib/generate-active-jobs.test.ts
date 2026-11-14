import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceSoftJobProgress,
  canStartAnotherDockJob,
  MAX_PARALLEL_DOCK_JOBS,
  pruneDockJobsHistory,
  summarizeActiveDockJobs,
  type ActiveDockGenerationJob,
} from "./generate-active-jobs";

function makeJob(
  overrides: Partial<ActiveDockGenerationJob> = {},
): ActiveDockGenerationJob {
  return {
    clientJobId: overrides.clientJobId ?? "job-1",
    generationId: overrides.generationId ?? "gen-1",
    promptText: overrides.promptText ?? "Студийный портрет",
    modality: overrides.modality ?? "image",
    editKind: overrides.editKind ?? null,
    status: overrides.status ?? "running",
    progress: overrides.progress ?? 25,
    startedAtMs: overrides.startedAtMs ?? 1_000,
    completedAtMs: overrides.completedAtMs ?? null,
    sourcePreviewUrl: overrides.sourcePreviewUrl ?? null,
    resultUrl: overrides.resultUrl ?? null,
    photoshootTileUrls: overrides.photoshootTileUrls ?? null,
    errorMessage: overrides.errorMessage ?? null,
    seen: overrides.seen ?? false,
  };
}

test("summarizeActiveDockJobs formats 1 running job and 2+ parallel jobs cleanly", () => {
  const empty = summarizeActiveDockJobs([]);
  assert.equal(empty.runBusy, false);
  assert.equal(empty.activeCount, 0);
  assert.equal(empty.fabLabel, null);

  const single = summarizeActiveDockJobs([makeJob({ progress: 42 })]);
  assert.equal(single.runBusy, true);
  assert.equal(single.activeCount, 1);
  assert.equal(single.displayProgress, 42);
  assert.equal(single.fabLabel, "Генерируем · 42%");
  assert.equal(single.mobileTabLabel, "Генерируем");

  const multi = summarizeActiveDockJobs([
    makeJob({ clientJobId: "j1", progress: 80 }),
    makeJob({ clientJobId: "j2", progress: 30 }),
    makeJob({
      clientJobId: "j3",
      status: "completed",
      progress: 100,
      seen: false,
      resultUrl: "https://cdn.example/done.jpg",
    }),
  ]);
  assert.equal(multi.runBusy, true);
  assert.equal(multi.activeCount, 2);
  assert.equal(multi.completedCount, 1);
  assert.equal(multi.unseenCompletedCount, 1);
  assert.equal(multi.displayProgress, 55);
  assert.equal(multi.fabLabel, "2 в работе · 55%");
  assert.equal(multi.mobileTabLabel, "2 в работе");
});

test("canStartAnotherDockJob enforces MAX_PARALLEL_DOCK_JOBS while ignoring completed jobs", () => {
  const twoRunningOneDone = [
    makeJob({ clientJobId: "a", status: "running" }),
    makeJob({ clientJobId: "b", status: "starting" }),
    makeJob({ clientJobId: "c", status: "completed" }),
  ];
  assert.equal(
    canStartAnotherDockJob(twoRunningOneDone, MAX_PARALLEL_DOCK_JOBS),
    true,
  );

  const threeRunning = [
    makeJob({ clientJobId: "a", status: "running" }),
    makeJob({ clientJobId: "b", status: "running" }),
    makeJob({ clientJobId: "c", status: "starting" }),
  ];
  assert.equal(
    canStartAnotherDockJob(threeRunning, MAX_PARALLEL_DOCK_JOBS),
    false,
  );
});

test("advanceSoftJobProgress smoothly approaches 92 and never exceeds it", () => {
  let p = 8;
  for (let i = 0; i < 200; i += 1) {
    const next = advanceSoftJobProgress(p);
    assert.ok(next >= p);
    p = next;
  }
  assert.equal(p, 92);
});

test("pruneDockJobsHistory retains all active jobs and trims oldest terminal items", () => {
  const jobs = [
    makeJob({ clientJobId: "run-1", status: "running", startedAtMs: 5000 }),
    makeJob({ clientJobId: "run-2", status: "running", startedAtMs: 4000 }),
    makeJob({
      clientJobId: "done-new",
      status: "completed",
      startedAtMs: 3000,
      completedAtMs: 3500,
    }),
    makeJob({
      clientJobId: "done-old-1",
      status: "completed",
      startedAtMs: 2000,
      completedAtMs: 2500,
    }),
    makeJob({
      clientJobId: "done-old-2",
      status: "completed",
      startedAtMs: 1000,
      completedAtMs: 1500,
    }),
  ];

  const pruned = pruneDockJobsHistory(jobs, 3);
  assert.deepEqual(
    pruned.map((j) => j.clientJobId),
    ["run-1", "run-2", "done-new"],
  );
});
