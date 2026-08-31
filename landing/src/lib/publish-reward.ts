import { PHOTOSHOOT_EDIT_KIND } from "./photoshoot";

export const PUBLISH_REWARD_RETRY_WINDOW_MS = 15 * 60 * 1000;

export type PublishRewardKind = "photo" | "video" | "photoshoot";

export type PublishRewardAmounts = {
  photo: number;
  video: number;
  photoshoot: number;
};

export type PublishRewardConfig = {
  enabled: boolean;
  photo: number;
  video: number;
  photoshoot: number;
  dailyCap: number;
};

export type PublishRewardResult = {
  status: string;
  credits: number;
  reason?: string | null;
  kind?: PublishRewardKind | string | null;
  balance?: number | null;
};

export const DEFAULT_PUBLISH_REWARD_CONFIG: PublishRewardConfig = {
  enabled: false,
  photo: 1,
  video: 5,
  photoshoot: 2,
  dailyCap: 20,
};

const FLAG_ON = new Set(["1", "true", "yes", "on"]);

export function isPublishRewardFlagOn(value: string | undefined): boolean {
  return FLAG_ON.has(String(value || "").trim().toLowerCase());
}

export function parsePublishRewardInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function parsePublishRewardConfig(
  config: Record<string, string | undefined>,
): PublishRewardConfig {
  return {
    enabled: isPublishRewardFlagOn(config.publish_reward_enabled),
    photo: parsePublishRewardInt(
      config.publish_reward_photo,
      DEFAULT_PUBLISH_REWARD_CONFIG.photo,
    ),
    video: parsePublishRewardInt(
      config.publish_reward_video,
      DEFAULT_PUBLISH_REWARD_CONFIG.video,
    ),
    photoshoot: parsePublishRewardInt(
      config.publish_reward_photoshoot,
      DEFAULT_PUBLISH_REWARD_CONFIG.photoshoot,
    ),
    dailyCap: parsePublishRewardInt(
      config.publish_reward_daily_cap,
      DEFAULT_PUBLISH_REWARD_CONFIG.dailyCap,
    ),
  };
}

export function publishRewardKindForGeneration(input: {
  modality?: string | null;
  editKind?: string | null;
}): PublishRewardKind {
  if (String(input.modality || "").trim() === "video") return "video";
  if (String(input.editKind || "").trim() === PHOTOSHOOT_EDIT_KIND) {
    return "photoshoot";
  }
  return "photo";
}

export function publishRewardAmount(
  kind: PublishRewardKind,
  amounts: PublishRewardAmounts,
): number {
  return amounts[kind];
}

export function publishRewardCreditsNoun(credits: number): string {
  if (credits === 1) return "кредит";
  if (credits < 5) return "кредита";
  return "кредитов";
}

export function publishRewardCreditsLabel(credits: number): string {
  return `+${credits} ${publishRewardCreditsNoun(credits)}`;
}

export function visiblePublishRewardCredits(input: {
  enabled: boolean;
  isPublished: boolean;
  amount: number;
  remainingToday: number;
}): number | null {
  if (input.isPublished) return null;
  if (input.amount <= 0) return null;
  if (input.enabled && input.remainingToday < input.amount) return null;
  return input.amount;
}

export function remainingPublishRewardToday(
  dailyCap: number,
  grantedToday: number,
): number {
  return Math.max(0, dailyCap - Math.max(0, grantedToday));
}

export function shouldAttemptPublishReward(input: {
  enabled: boolean;
  alreadyPublished: boolean;
  firstPublishedAt: string | null | undefined;
  nowMs?: number;
}): boolean {
  if (!input.enabled) return false;
  if (!input.alreadyPublished) return true;
  const at = input.firstPublishedAt ? Date.parse(input.firstPublishedAt) : NaN;
  if (!Number.isFinite(at)) return false;
  return (
    (input.nowMs ?? Date.now()) - at <= PUBLISH_REWARD_RETRY_WINDOW_MS
  );
}

export function parsePublishRewardRpc(value: unknown): PublishRewardResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const credits = Number(row.credits);
  return {
    status: typeof row.status === "string" ? row.status : "unknown",
    credits: Number.isFinite(credits) ? credits : 0,
    reason: typeof row.reason === "string" ? row.reason : null,
    kind: typeof row.kind === "string" ? row.kind : null,
    balance: typeof row.balance === "number" ? row.balance : null,
  };
}

export function publishRewardToastMessage(input: {
  promptsReady?: boolean;
  wasPublished: boolean;
  reward?: PublishRewardResult | null;
}): string {
  if (input.wasPublished && input.promptsReady !== false) {
    return "Промпты обновлены";
  }
  if (input.promptsReady === false) {
    return "Опубликовано. Промпты появятся через минуту";
  }
  const credits = input.reward?.credits ?? 0;
  const reason = input.reward?.reason ?? input.reward?.status;
  if (credits > 0) {
    return `Опубликовано · ${publishRewardCreditsLabel(credits)}`;
  }
  if (reason === "daily_cap") {
    return "Опубликовано. Бонус на сегодня закончился";
  }
  return "Карточка опубликована";
}
