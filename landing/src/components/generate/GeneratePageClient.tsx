"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GenerateBlankShell } from "@/components/generate/GenerateBlankShell";
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

  useEffect(() => {
    const entrySource = consumeEntrySource();
    reachYandexMetrikaGoal(YM_GOAL_GENERATE_SHELL_OPEN, {
      entry_source: entrySource,
    });
  }, []);

  return (
    <main className="relative bg-white">
      <GenerateBlankShell
        onBack={() => router.push("/")}
        layout="desktop"
      />
    </main>
  );
}
