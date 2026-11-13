"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { CardInlineGeneratePanel } from "@/components/CardInlineGeneratePanel";
import { GenerateBlankShell } from "@/components/generate/GenerateBlankShell";
import {
  GenerateHostAdapterProvider,
  type GenerateHostAdapter,
} from "@/components/generate/host-adapter";
import type { GenerateEntry } from "@/context/GenerateMobileModalContext";
import { usePricingModal } from "@/context/PricingModalContext";
import {
  listingComposeExampleInitialFilter,
  listingGenerateIdleIntent,
} from "@/lib/generate-dock-path";
import { reachYandexMetrikaGoal } from "@/lib/yandex-metrika";

export type GeneratePresentation = "dock" | "modal";

type BaseProps = {
  layout: "desktop" | "mobile";
  onBack: () => void;
};

type DockProps = BaseProps & {
  /** Floating composer over generations listing (/generate). */
  presentation: "dock";
};

type ModalProps = BaseProps & {
  /** Card compose: desktop aside swap or mobile fullscreen portal. */
  presentation: "modal";
  entry: Extract<GenerateEntry, { source: "card" }>;
};

export type GenerateSurfaceProps = DockProps | ModalProps;

/**
 * Single generate module host — two presentations of one composer:
 * - dock: listing + floating CardInlineGeneratePanel (chrome=dock)
 * - modal: CardInlineGeneratePanel fullscreen chrome (card aside or mobile portal)
 */
export function GenerateSurface(props: GenerateSurfaceProps) {
  const pathname = usePathname();
  const { open: openPricing } = usePricingModal();
  const hostAdapter = useMemo<GenerateHostAdapter>(
    () => ({
      apiBaseUrl: "",
      credentialsMode: "include",
      openPricing,
      trackGoal: (goal, params) => reachYandexMetrikaGoal(goal, params),
      resolveInitialIntent: () => listingGenerateIdleIntent(pathname),
      resolveInitialExampleFilter: () =>
        listingComposeExampleInitialFilter(pathname),
    }),
    [openPricing, pathname],
  );

  if (props.presentation === "dock") {
    return (
      <GenerateBlankShell
        onBack={props.onBack}
        layout={props.layout}
      />
    );
  }

  return (
    <GenerateHostAdapterProvider value={hostAdapter}>
      <CardInlineGeneratePanel
        source="card"
        chrome="fullscreen"
        promptText={props.entry.promptText}
        cardId={props.entry.cardId}
        onBack={props.onBack}
        layout={props.layout}
      />
    </GenerateHostAdapterProvider>
  );
}
