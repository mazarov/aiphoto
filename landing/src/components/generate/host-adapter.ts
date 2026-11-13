"use client";

import { createContext, useContext } from "react";
import type { GenerateDockComposeIntent } from "@/lib/generate-dock-seed";

export type GenerateExampleInitialFilter = {
  label?: string;
  dimension: string;
  value: string;
};

/**
 * Seam between the generation control and its host environment.
 * On `promptshot.ru` the default adapter uses same-origin cookies, PricingModal,
 * and Yandex Metrika. External embeds (Stage 2) supply `apiBaseUrl` + Bearer headers.
 */
export type GenerateHostAdapter = {
  apiBaseUrl: string;
  credentialsMode: RequestCredentials;
  getAuthHeaders?: () =>
    | Record<string, string>
    | Promise<Record<string, string>>;
  openPricing: () => void;
  trackGoal: (
    goal: string,
    params?: Record<string, string | number | boolean>,
  ) => void;
  resolveInitialIntent: () => GenerateDockComposeIntent | null;
  resolveInitialExampleFilter: () => GenerateExampleInitialFilter | null;
};

export const DEFAULT_GENERATE_HOST_ADAPTER: GenerateHostAdapter = {
  apiBaseUrl: "",
  credentialsMode: "include",
  openPricing: () => {
    if (typeof window !== "undefined") {
      window.location.assign("/pricing");
    }
  },
  trackGoal: () => {},
  resolveInitialIntent: () => null,
  resolveInitialExampleFilter: () => null,
};

export function resolveGenerateApiUrl(
  apiBaseUrl: string | undefined,
  path: string,
): string {
  const base = (apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchGenerateHostApi(
  path: string,
  init?: RequestInit,
  adapter?: Partial<
    Pick<
      GenerateHostAdapter,
      "apiBaseUrl" | "credentialsMode" | "getAuthHeaders"
    >
  >,
): Promise<Response> {
  const url = resolveGenerateApiUrl(adapter?.apiBaseUrl, path);
  const authHeaders = adapter?.getAuthHeaders
    ? await adapter.getAuthHeaders()
    : undefined;
  const mergedHeaders: HeadersInit | undefined =
    authHeaders || init?.headers
      ? {
          ...(authHeaders ?? {}),
          ...(init?.headers instanceof Headers
            ? Object.fromEntries(init.headers.entries())
            : Array.isArray(init?.headers)
              ? Object.fromEntries(init.headers)
              : (init?.headers ?? {})),
        }
      : undefined;

  return fetch(url, {
    ...init,
    credentials:
      init?.credentials ?? adapter?.credentialsMode ?? "include",
    ...(mergedHeaders ? { headers: mergedHeaders } : {}),
  });
}

const GenerateHostAdapterContext = createContext<GenerateHostAdapter>(
  DEFAULT_GENERATE_HOST_ADAPTER,
);

export const GenerateHostAdapterProvider = GenerateHostAdapterContext.Provider;

export function useGenerateHostAdapter(): GenerateHostAdapter {
  return useContext(GenerateHostAdapterContext);
}
