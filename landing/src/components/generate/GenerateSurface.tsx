"use client";

import { CardInlineGeneratePanel } from "@/components/CardInlineGeneratePanel";
import { GenerateBlankShell } from "@/components/generate/GenerateBlankShell";
import type { GenerateEntry } from "@/context/GenerateMobileModalContext";

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
  if (props.presentation === "dock") {
    return (
      <GenerateBlankShell
        onBack={props.onBack}
        layout={props.layout}
      />
    );
  }

  return (
    <CardInlineGeneratePanel
      source="card"
      chrome="fullscreen"
      promptText={props.entry.promptText}
      cardId={props.entry.cardId}
      onBack={props.onBack}
      layout={props.layout}
    />
  );
}
