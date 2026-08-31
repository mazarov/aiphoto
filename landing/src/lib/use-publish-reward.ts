"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PUBLISH_REWARD_CONFIG,
  type PublishRewardConfig,
} from "@/lib/publish-reward";
import { IMAGE_GENERATION_MODALITY } from "@/lib/generation/image-options";

export function usePublishReward(enabled = true) {
  const [config, setConfig] = useState<PublishRewardConfig>(
    DEFAULT_PUBLISH_REWARD_CONFIG,
  );
  const [remainingToday, setRemainingToday] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void Promise.all([
      fetch(`/api/generation-config?modality=${IMAGE_GENERATION_MODALITY}`, {
        credentials: "include",
        signal: controller.signal,
      }),
      fetch("/api/me", {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      }),
    ])
      .then(async ([configRes, meRes]) => {
        const configData = configRes.ok
          ? ((await configRes.json().catch(() => ({}))) as {
              publishReward?: PublishRewardConfig;
            })
          : {};
        const meData = meRes.ok
          ? ((await meRes.json().catch(() => ({}))) as {
              publishRewardRemainingToday?: number;
            })
          : {};
        if (configData.publishReward) {
          setConfig({
            ...DEFAULT_PUBLISH_REWARD_CONFIG,
            ...configData.publishReward,
          });
        }
        const remaining = Number(meData.publishRewardRemainingToday);
        setRemainingToday(Number.isFinite(remaining) ? remaining : 0);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => controller.abort();
  }, [enabled]);

  return { config, remainingToday, setRemainingToday };
}
