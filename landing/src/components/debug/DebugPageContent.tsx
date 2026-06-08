"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FilterableGrid } from "@/components/CardFilters";
import {
  disableDebugToolsSession,
  enableDebugToolsSession,
} from "@/lib/debug-tools-session";

function DebugPageContentInner() {
  const searchParams = useSearchParams();
  const initialDataset = searchParams.get("dataset")?.trim() || undefined;

  useEffect(() => {
    enableDebugToolsSession();
    return () => disableDebugToolsSession();
  }, []);

  return (
    <div>
      <h1 className="sr-only">Debug catalog</h1>
      <FilterableGrid
        cards={[]}
        hideHoverChrome
        variant="debug"
        initialDataset={initialDataset}
      />
    </div>
  );
}

export function DebugPageContent() {
  return (
    <Suspense fallback={null}>
      <DebugPageContentInner />
    </Suspense>
  );
}
