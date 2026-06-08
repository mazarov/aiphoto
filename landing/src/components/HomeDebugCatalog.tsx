"use client";

import { useEffect } from "react";
import { useDebug } from "./DebugFAB";
import { FilterableGrid } from "./CardFilters";

export function HomeDebugCatalog() {
  const debug = useDebug();
  const debugOpen = debug?.debugOpen ?? false;
  const pendingDataset = debug?.pendingDataset ?? null;

  useEffect(() => {
    if (!debugOpen) return;
    requestAnimationFrame(() => {
      document.getElementById("debug-catalog")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [debugOpen]);

  if (!debugOpen) return null;

  return (
    <section id="debug-catalog" className="mx-auto mb-10 max-w-7xl px-2 sm:px-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
          Debug
        </span>
        <h2 className="text-lg font-semibold text-zinc-900">Debug catalog</h2>
      </div>
      <FilterableGrid
        cards={[]}
        enableDebugPanel
        initialDataset={pendingDataset ?? undefined}
        onInitialDatasetApplied={() => debug?.setPendingDataset(null)}
      />
    </section>
  );
}
