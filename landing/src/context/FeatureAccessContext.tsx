"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_PROMPT_CARD_GENERATION_AUTH,
  YM_GOAL_PROMPT_CARD_GENERATION_EXPOSURE,
} from "@/lib/yandex-metrika";

type FeatureVariant = "treatment" | "control";

type FeatureAccessContextValue = {
  promptCardGenerationEnabled: boolean;
  promptCardGenerationVariant: FeatureVariant;
  loading: boolean;
};

const FeatureAccessContext = createContext<FeatureAccessContextValue>({
  promptCardGenerationEnabled: false,
  promptCardGenerationVariant: "control",
  loading: true,
});

export function FeatureAccessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [variant, setVariant] = useState<FeatureVariant>("control");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/feature-access", {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`feature_access_${response.status}`);
        const payload = (await response.json()) as {
          enabled?: boolean;
          variant?: FeatureVariant;
          bucketBand?: number | null;
        };
        if (controller.signal.aborted) return;

        const nextVariant =
          payload.variant === "treatment" ? "treatment" : "control";
        setEnabled(payload.enabled === true);
        setVariant(nextVariant);

        const exposureKey = `promptshot_rollout_exposure:${nextVariant}:${payload.bucketBand ?? "internal"}`;
        if (window.sessionStorage.getItem(exposureKey) !== "1") {
          window.sessionStorage.setItem(exposureKey, "1");
          reachYandexMetrikaGoal(
            YM_GOAL_PROMPT_CARD_GENERATION_EXPOSURE,
            {
              feature_key: "prompt_card_generation",
              variant: nextVariant,
              bucket_band: payload.bucketBand ?? "internal",
            }
          );
        }
        if (user && payload.enabled === true) {
          const authKey = "promptshot_rollout_auth:prompt_card_generation";
          if (window.sessionStorage.getItem(authKey) !== "1") {
            window.sessionStorage.setItem(authKey, "1");
            reachYandexMetrikaGoal(
              YM_GOAL_PROMPT_CARD_GENERATION_AUTH,
              {
                feature_key: "prompt_card_generation",
                variant: "treatment",
                bucket_band: payload.bucketBand ?? "internal",
              }
            );
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[feature.access] failed", error);
          setEnabled(false);
          setVariant("control");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [authLoading, user?.id]);

  const value = useMemo(
    () => ({
      promptCardGenerationEnabled: enabled,
      promptCardGenerationVariant: variant,
      loading,
    }),
    [enabled, loading, variant]
  );

  return (
    <FeatureAccessContext.Provider value={value}>
      {children}
    </FeatureAccessContext.Provider>
  );
}

export function useFeatureAccess(): FeatureAccessContextValue {
  return useContext(FeatureAccessContext);
}
