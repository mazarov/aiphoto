import os from "node:os";
import { createLokiTransport, type LokiTransport } from "./loki-transport";

let transport: LokiTransport | null = null;

function ensure(instance: string): LokiTransport {
  if (!transport) {
    transport = createLokiTransport({
      pushUrl: process.env.LOKI_PUSH_URL?.trim() ?? "",
      basicAuth: process.env.LOKI_BASIC_AUTH?.trim() ?? "",
      service: "web-generation-worker",
      envLabel: process.env.LOG_ENV?.trim() || "prod",
      instance: instance || os.hostname(),
    });
  }
  return transport;
}

export function syncWorkerLokiInstance(instance: string): void {
  ensure(instance).setInstance(instance);
}

export function pushWorkerLog(line: string, level: string): void {
  try {
    ensure(os.hostname()).push(line, level);
  } catch {
    // logging must not break the worker
  }
}

export async function flushWorkerLoki(): Promise<void> {
  if (!transport) return;
  try {
    await transport.flush();
  } catch {
    // logging must not break shutdown
  }
}
