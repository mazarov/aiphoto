"use client";

import { useEffect } from "react";
import { useGenerateDock } from "@/context/GenerateDockContext";
import { NANO_BANANA_DEFAULT_MODEL_ID } from "@/lib/nano-banana-seo-copy";

/** Preselect Nano Banana for the next compose open without opening the dock. */
export function NanoBananaPreferModel() {
  const { preferModelId } = useGenerateDock();

  useEffect(() => {
    preferModelId(NANO_BANANA_DEFAULT_MODEL_ID);
  }, [preferModelId]);

  return null;
}
