"use client";

import { useEffect } from "react";
import { useGenerateDock } from "@/context/GenerateDockContext";

/** Preselect Nano Banana Pro on `/nano-banana/pro`. Hub does not stuff Flash. */
export function NanoBananaPreferModel({ modelId }: { modelId: string }) {
  const { preferModelId } = useGenerateDock();

  useEffect(() => {
    preferModelId(modelId);
  }, [modelId, preferModelId]);

  return null;
}
