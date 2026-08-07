import express from "express";
import type { Server } from "node:http";
import { config } from "./config";
import { checkSupabase, readQueueMetrics, supabase } from "./lib/supabase";
import { createUgcCard } from "./lib/ugc-card";
import { errorFields, log } from "./lib/logger";
import { retryDelaySeconds, shouldRetry } from "./retry-policy";
import {
  GenerationJob,
  ProcessingError,
  processGeneration,
  RESULTS_BUCKET,
} from "./process-generation";

const app = express();
const shutdownController = new AbortController();
const inFlight = new Set<string>();
const tasks = new Set<Promise<void>>();
let shuttingDown = false;
let lastLoopAt = 0;
let pollTimer: NodeJS.Timeout | null = null;
let reaperTimer: NodeJS.Timeout | null = null;
let server: Server;

class LeaseLostError extends Error {
  constructor() {
    super("Generation lease lost");
    this.name = "LeaseLostError";
  }
}

function rpcBoolean(data: unknown): boolean {
  return data === true;
}

async function heartbeat(generationId: string, leaseToken: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("landing_heartbeat_generation", {
    p_generation_id: generationId,
    p_worker_id: config.workerId,
    p_lease_token: leaseToken,
    p_lease_seconds: config.leaseSeconds,
  });
  if (error) {
    log("warn", "heartbeat_failed", { generationId, error: error.message });
    return false;
  }
  return rpcBoolean(data);
}

async function terminalFail(job: GenerationJob, error: ProcessingError): Promise<void> {
  const { data, error: rpcError } = await supabase.rpc("landing_fail_generation", {
    p_generation_id: job.id,
    p_worker_id: config.workerId,
    p_lease_token: job.lease_token,
    p_error_type: error.errorType,
    p_error_message: error.message,
    p_refund: true,
  });
  log(rpcError ? "error" : "warn", "generation_terminal_failed", {
    generationId: job.id,
    attempt: job.attempts,
    errorType: error.errorType,
    errorMessage: error.message,
    rpcError: rpcError?.message,
    result: data,
  });
}

async function handleFailure(job: GenerationJob, error: ProcessingError): Promise<void> {
  if (shouldRetry(error.retryable, job.attempts, job.max_attempts)) {
    const delay = retryDelaySeconds(job.attempts);
    const { data, error: rpcError } = await supabase.rpc("landing_retry_generation", {
      p_generation_id: job.id,
      p_worker_id: config.workerId,
      p_lease_token: job.lease_token,
      p_error_type: error.errorType,
      p_error_message: error.message,
      p_delay_seconds: delay,
    });
    if (rpcError) {
      log("error", "generation_retry_rpc_failed", {
        generationId: job.id,
        error: rpcError.message,
      });
      return;
    }
    if (!rpcBoolean(data)) {
      log("warn", "generation_retry_skipped_lease_lost", { generationId: job.id });
      return;
    }
    log("warn", "generation_retry_scheduled", {
      generationId: job.id,
      attempt: job.attempts,
      maxAttempts: job.max_attempts,
      delaySeconds: delay,
      errorType: error.errorType,
      errorMessage: error.message,
    });
    return;
  }
  await terminalFail(job, error);
}

async function runJob(job: GenerationJob): Promise<void> {
  const startedAt = Date.now();
  let leaseLost = false;
  let heartbeatRunning = false;
  const ensureLease = async (): Promise<void> => {
    if (leaseLost) throw new LeaseLostError();
    const owned = await heartbeat(job.id, job.lease_token);
    if (!owned) {
      leaseLost = true;
      throw new LeaseLostError();
    }
  };
  const heartbeatTimer = setInterval(() => {
    if (heartbeatRunning || leaseLost) return;
    heartbeatRunning = true;
    heartbeat(job.id, job.lease_token)
      .then((owned) => {
        if (!owned) {
          leaseLost = true;
          log("warn", "generation_lease_lost", { generationId: job.id });
        }
      })
      .finally(() => {
        heartbeatRunning = false;
      });
  }, config.heartbeatMs);
  heartbeatTimer.unref();

  try {
    const result = await processGeneration(
      supabase,
      job,
      shutdownController.signal,
      ensureLease,
    );
    await ensureLease();
    const { data: completed, error } = await supabase.rpc("landing_complete_generation", {
      p_generation_id: job.id,
      p_worker_id: config.workerId,
      p_lease_token: job.lease_token,
      p_result_bucket: RESULTS_BUCKET,
      p_result_path: result.resultPath,
    });
    if (error || !rpcBoolean(completed)) {
      const { data: committedRow, error: verifyError } = await supabase
        .from("landing_generations")
        .select("status,result_storage_bucket,result_storage_path")
        .eq("id", job.id)
        .maybeSingle();
      const committed =
        !verifyError &&
        committedRow?.status === "completed" &&
        committedRow.result_storage_bucket === RESULTS_BUCKET &&
        committedRow.result_storage_path === result.resultPath;
      if (!committed && !verifyError && !error) {
        const { error: cleanupError } = await supabase.storage
          .from(RESULTS_BUCKET)
          .remove([result.resultPath]);
        log(cleanupError ? "error" : "warn", "orphan_result_cleanup", {
          generationId: job.id,
          resultPath: result.resultPath,
          cleanupError: cleanupError?.message,
        });
      } else if (verifyError || (error && !committed)) {
        log("error", "completion_verification_failed", {
          generationId: job.id,
          resultPath: result.resultPath,
          error: verifyError?.message || error?.message,
          cleanupDeferred: true,
        });
      }
      if (!committed) {
        if (error) {
          throw new ProcessingError("completion_rpc_error", error.message, true);
        }
        leaseLost = true;
        throw new LeaseLostError();
      }
    }
    log("info", "generation_completed", {
      generationId: job.id,
      userId: job.user_id,
      resultPath: result.resultPath,
      attempt: job.attempts,
      durationMs: Date.now() - startedAt,
    });
    try {
      if (!job.create_ugc) {
        log("info", "ugc_creation_skipped", {
          generationId: job.id,
          reason: "disabled_for_request",
        });
        return;
      }
      const ugc = await createUgcCard(supabase, {
        generationId: job.id,
        userId: job.user_id,
        promptText: result.rawPrompt,
        resultBucket: RESULTS_BUCKET,
        resultPath: result.resultPath,
      });
      log("info", "ugc_creation_finished", {
        generationId: job.id,
        cardId: ugc?.cardId ?? null,
        slug: ugc?.slug ?? null,
      });
    } catch (error) {
      log("error", "ugc_creation_failed", {
        generationId: job.id,
        ...errorFields(error),
      });
    }
  } catch (error) {
    if (error instanceof LeaseLostError || leaseLost) {
      log("warn", "generation_stopped_after_lease_loss", { generationId: job.id });
      return;
    }
    const processingError =
      error instanceof ProcessingError
        ? error
        : new ProcessingError(
            "worker_error",
            error instanceof Error ? error.message : String(error),
            false,
          );
    const stillOwned = await heartbeat(job.id, job.lease_token);
    if (!stillOwned) {
      leaseLost = true;
      log("warn", "generation_failure_ignored_after_lease_loss", {
        generationId: job.id,
        errorType: processingError.errorType,
      });
      return;
    }
    await handleFailure(job, processingError);
    log("warn", "generation_attempt_finished_with_error", {
      generationId: job.id,
      attempt: job.attempts,
      durationMs: Date.now() - startedAt,
      errorType: processingError.errorType,
      retryable: processingError.retryable,
    });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

function startJob(job: GenerationJob): void {
  const taskKey = `${job.id}:${job.lease_token}`;
  if (inFlight.has(taskKey)) {
    log("warn", "duplicate_claim_ignored", {
      generationId: job.id,
      leaseToken: job.lease_token,
    });
    return;
  }
  inFlight.add(taskKey);
  let task: Promise<void>;
  task = runJob(job)
    .catch((error) => {
      log("error", "job_runner_unhandled", { generationId: job.id, ...errorFields(error) });
    })
    .finally(() => {
      inFlight.delete(taskKey);
      tasks.delete(task);
    });
  tasks.add(task);
}

async function poll(): Promise<void> {
  if (shuttingDown) return;
  lastLoopAt = Date.now();
  if (!config.processingEnabled) {
    pollTimer = setTimeout(poll, config.pollMs);
    return;
  }
  const capacity = config.concurrency - inFlight.size;
  if (capacity > 0) {
    const { data, error } = await supabase.rpc("landing_claim_generations", {
      p_worker_id: config.workerId,
      p_limit: capacity,
      p_lease_seconds: config.leaseSeconds,
      p_global_limit: config.globalCap,
      p_max_per_user: config.perUserCap,
    });
    if (error) {
      log("error", "claim_failed", { error: error.message });
    } else {
      for (const job of (data || []) as GenerationJob[]) startJob(job);
      if (data?.length) {
        log("info", "generations_claimed", {
          count: data.length,
          inFlight: inFlight.size,
        });
      }
    }
  }
  if (!shuttingDown) pollTimer = setTimeout(poll, config.pollMs);
}

async function reap(): Promise<void> {
  if (shuttingDown || !config.processingEnabled) return;
  const { data, error } = await supabase.rpc("landing_reap_stale_generations", {
    p_limit: config.reaperLimit,
  });
  if (error) log("error", "reaper_failed", { error: error.message });
  else if (data?.length) log("warn", "stale_generations_reaped", { jobs: data });
}

app.get("/health/live", (_request, response) => {
  response.status(200).json({ ok: true, service: "web-generation-worker" });
});

app.get("/health/ready", async (_request, response) => {
  const maxLoopAge = Math.max(config.pollMs * 3, 15000);
  const loopFresh = lastLoopAt > 0 && Date.now() - lastLoopAt <= maxLoopAge;
  const databaseReady = !shuttingDown && (await checkSupabase().catch(() => false));
  const ready = loopFresh && databaseReady;
  response.status(ready ? 200 : 503).json({
    ok: ready,
    supabase: databaseReady,
    loopFresh,
    inFlight: inFlight.size,
    processingEnabled: config.processingEnabled,
  });
});

app.get("/metrics", async (_request, response) => {
  try {
    const metrics = await readQueueMetrics();
    response.status(200).json({
      service: "web-generation-worker",
      timestamp: new Date().toISOString(),
      inFlight: inFlight.size,
      processingEnabled: config.processingEnabled,
      ...metrics,
    });
  } catch (error) {
    log("error", "queue_metrics_failed", errorFields(error));
    response.status(503).json({ ok: false, error: "queue_metrics_unavailable" });
  }
});

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", "shutdown_started", { signal, inFlight: inFlight.size });
  if (pollTimer) clearTimeout(pollTimer);
  if (reaperTimer) clearInterval(reaperTimer);
  shutdownController.abort();
  server.close();
  await Promise.race([
    Promise.allSettled([...tasks]),
    new Promise((resolve) => setTimeout(resolve, config.shutdownGraceMs)),
  ]);
  log("info", "shutdown_finished", { remaining: inFlight.size });
  process.exit(inFlight.size ? 1 : 0);
}

server = app.listen(config.port, () => {
  log("info", "worker_started", {
    port: config.port,
    workerId: config.workerId,
    concurrency: config.concurrency,
    globalCap: config.globalCap,
    perUserCap: config.perUserCap,
    leaseSeconds: config.leaseSeconds,
    processingEnabled: config.processingEnabled,
  });
  void poll();
  void reap();
  reaperTimer = setInterval(() => void reap(), config.reaperMs);
  reaperTimer.unref();
});

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  log("error", "uncaught_exception", errorFields(error));
  void shutdown("uncaughtException");
});
process.on("unhandledRejection", (error) => {
  log("error", "unhandled_rejection", errorFields(error));
  void shutdown("unhandledRejection");
});
