"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type GenerationContextValue = {
  openGenerationModal: (options?: {
    cardId?: string;
    initialPrompt?: string;
    sourceImageUrl?: string;
  }) => void;
  closeGenerationModal: () => void;
  isOpen: boolean;
  initialCardId: string | null;
  initialPrompt: string | null;
  sourceImageUrl: string | null;
};

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function useGeneration() {
  return useContext(GenerationContext);
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialCardId, setInitialCardId] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);

  const openGenerationModal = useCallback(
    (options?: { cardId?: string; initialPrompt?: string; sourceImageUrl?: string }) => {
      setInitialCardId(options?.cardId ?? null);
      setInitialPrompt(options?.initialPrompt ?? null);
      setSourceImageUrl(options?.sourceImageUrl?.trim() || null);
      setIsOpen(true);
    },
    []
  );

  const closeGenerationModal = useCallback(() => {
    setIsOpen(false);
    setInitialCardId(null);
    setInitialPrompt(null);
    setSourceImageUrl(null);
  }, []);

  const value: GenerationContextValue = {
    openGenerationModal,
    closeGenerationModal,
    isOpen,
    initialCardId,
    initialPrompt,
    sourceImageUrl,
  };

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}
