import { isDenRozhdeniyaClusterPath } from "@/lib/den-rozhdeniya-cluster";
import {
  isGeneraciyaFotoParyPath,
  isPairsPromptAdLandingPath,
} from "@/lib/promty-dlya-foto-par-cluster";
import { readYclidFromSearch } from "@/lib/yandex-attribution";
import { YANDEX_TWO_CLUSTER_LAUNCH } from "@/lib/yandex-two-cluster-launch";
import {
  readAttributionFromSearch,
  sanitizeLandingPath,
} from "@/lib/traffic-source-attribution";

function launchCampaignByKey(key: string) {
  return YANDEX_TWO_CLUSTER_LAUNCH.campaigns.find(
    (campaign) => campaign.key === key,
  );
}

function landingPathFromCampaign(
  key: string,
  fallback: string,
): string {
  const raw = launchCampaignByKey(key)?.landingUrl;
  try {
    const path = new URL(raw ?? "").pathname.replace(/\/+$/, "");
    return path || fallback;
  } catch {
    return fallback;
  }
}

export function birthdayAdLandingPath(): string {
  return landingPathFromCampaign("birthday", "/sobytiya/den-rozhdeniya");
}

export function birthdayAdTitle(): string {
  return (
    launchCampaignByKey("birthday")?.groups[0].ads[0].title ??
    "Создайте фото на день рождения с ИИ по вашему фото"
  );
}

export function pairsGenerateAdTitle(): string {
  return (
    launchCampaignByKey("pairs_generate")?.groups[0].ads[0].title ??
    "Сделайте парное фото с ИИ по вашим фото"
  );
}

export function pairsPromptsAdTitle(): string {
  return (
    launchCampaignByKey("pairs_prompts")?.groups[0].ads[0].title ??
    "Промты для фото пары с ИИ"
  );
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
  if (!isPaidAdClickSearch(input.search)) return null;
  if (isDenRozhdeniyaClusterPath(path)) return birthdayAdTitle();
  if (isGeneraciyaFotoParyPath(path)) return pairsGenerateAdTitle();
  if (isPairsPromptAdLandingPath(path)) return pairsPromptsAdTitle();
  return null;
}
