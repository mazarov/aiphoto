"use client";

import { useEffect } from "react";
import { useGenerateDock } from "@/context/GenerateDockContext";

/** Preselect a Nano Banana family model without opening the dock. */
export function NanoBananaPreferModel({ modelId }: { modelId: string }) {
  const { preferModelId } = useGenerateDock();

  useEffect(() => {
    preferModelId(modelId);
  }, [modelId, preferModelId]);

  return null;
}
