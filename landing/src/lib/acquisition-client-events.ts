"use client";

import {
  ACQUISITION_SESSION_HEADER,
  ACQUISITION_VISITOR_HEADER,
} from "./acquisition-request";
import { readOrCreateBrowserSessionId } from "./browser-session-id";
import { readOrCreateBrowserVisitorId } from "./visitor-id-browser";

export type AcquisitionClientEvent = "landing_view" | "prompt_copy";

export function browserAcquisitionIds(): {
  visitorId: string | null;
  sessionId: string | null;
} {
  return {
    visitorId: readOrCreateBrowserVisitorId(),
    sessionId: readOrCreateBrowserSessionId(),
  };
}

export function browserAcquisitionHeaders(): Record<string, string> {
  const { visitorId, sessionId } = browserAcquisitionIds();
  return {
    ...(visitorId ? { [ACQUISITION_VISITOR_HEADER]: visitorId } : {}),
    ...(sessionId ? { [ACQUISITION_SESSION_HEADER]: sessionId } : {}),
  };
}

export function recordAcquisitionClientEvent(
  event: AcquisitionClientEvent,
  input?: { path?: string | null; cardSlug?: string | null },
): void {
  const { visitorId, sessionId } = browserAcquisitionIds();
  if (!visitorId || !sessionId) return;
  void fetch("/api/client-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      event,
      visitorId,
      sessionId,
      path: input?.path || (typeof location === "undefined" ? null : location.pathname),
      cardSlug: input?.cardSlug || null,
    }),
  }).catch(() => {});
}
