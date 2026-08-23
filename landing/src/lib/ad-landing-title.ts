import { isDenRozhdeniyaClusterPath } from "@/lib/den-rozhdeniya-cluster";
import { readYclidFromSearch } from "@/lib/yandex-attribution";
import { YANDEX_TWO_CLUSTER_LAUNCH } from "@/lib/yandex-two-cluster-launch";
import {
  readAttributionFromSearch,
  sanitizeLandingPath,
} from "@/lib/traffic-source-attribution";

export function birthdayAdLandingPath(): string {
  const raw = YANDEX_TWO_CLUSTER_LAUNCH.campaigns[0]?.landingUrl;
  try {
    const path = new URL(raw).pathname.replace(/\/+$/, "");
    return path || "/";
  } catch {
    return "/sobytiya/den-rozhdeniya";
  }
}

export function birthdayAdTitle(): string {
  return YANDEX_TWO_CLUSTER_LAUNCH.campaigns[0].groups[0].ads[0].title;
}

export function isPaidAdClickSearch(search: string): boolean {
  if (readYclidFromSearch(search)) return true;
  const utm = readAttributionFromSearch(search);
  return utm.utm_source === "yandex" && utm.utm_medium === "cpc";
}

export function resolveAdLandingTitle(input: {
  path: string;
  search: string;
}): string | null {
  const path = (sanitizeLandingPath(input.path) ?? "").replace(/\/+$/, "") || "/";
  if (!isDenRozhdeniyaClusterPath(path)) return null;
  if (!isPaidAdClickSearch(input.search)) return null;
  return birthdayAdTitle();
}
