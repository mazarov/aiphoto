"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GenerateBlankShell } from "@/components/generate/GenerateBlankShell";
import { useFeatureAccess } from "@/context/FeatureAccessContext";
import {
  reachYandexMetrikaGoal,
  YM_GOAL_GENERATE_SHELL_OPEN,
} from "@/lib/yandex-metrika";

const ENTRY_SOURCE_STORAGE_KEY = "promptshot_generate_entry_source";

function consumeEntrySource(): "sidebar" | "route" {
  try {
    const value = window.sessionStorage.getItem(ENTRY_SOURCE_STORAGE_KEY);
    window.sessionStorage.removeItem(ENTRY_SOURCE_STORAGE_KEY);
    if (value === "sidebar") return "sidebar";
  } catch {
    /* ignore */
  }
  return "route";
}

/**
 * /generate history page. Floating dock is global (PageLayout GenerateListingDockHost).
 */
export function GeneratePageClient() {
  const router = useRouter();
  const {
    promptCardGenerationEnabled,
    promptCardGenerationVariant,
    promptCardGenerationBucketBand,
    loading,
  } = useFeatureAccess();

  useEffect(() => {
    if (loading) return;
    if (!promptCardGenerationEnabled) {
      router.replace("/");
      return;
    }
    const entrySource = consumeEntrySource();
    reachYandexMetrikaGoal(YM_GOAL_GENERATE_SHELL_OPEN, {
      entry_source: entrySource,
      variant: promptCardGenerationVariant,
      bucket_band: promptCardGenerationBucketBand ?? "internal",
      feature_key: "prompt_card_generation",
    });
  }, [
    loading,
    promptCardGenerationBucketBand,
    promptCardGenerationEnabled,
    promptCardGenerationVariant,
    router,
  ]);

  if (loading || !promptCardGenerationEnabled) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-zinc-500">
        Загрузка…
      </div>
    );
  }

  return (
    <main className="relative bg-white">
      <GenerateBlankShell
        onBack={() => router.push("/")}
        layout="desktop"
      />
    </main>
  );
}
