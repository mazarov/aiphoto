import os from "node:os";
import {
  createLokiTransport,
  installConsoleLokiSink,
  installLokiProcessHooks,
  type LokiTransport,
} from "./loki-transport";

let transport: LokiTransport | null = null;

export function installPaymentLoki(): void {
  if (transport) return;
  transport = createLokiTransport({
    pushUrl: process.env.LOKI_PUSH_URL?.trim() ?? "",
    basicAuth: process.env.LOKI_BASIC_AUTH?.trim() ?? "",
    service: "payment-bot",
    envLabel: process.env.LOG_ENV?.trim() || "prod",
    instance: os.hostname(),
  });
  installConsoleLokiSink(transport);
  installLokiProcessHooks(transport);
  console.info(
    JSON.stringify({
      event: "process_start",
      pid: process.pid,
      hostname: os.hostname(),
      node: process.version,
    }),
  );
}

export async function flushPaymentLoki(): Promise<void> {
  if (!transport) return;
  try {
    await transport.flush();
  } catch {
    // logging must not break shutdown
  }
}
