import { Suspense } from "react";
import {
  CatalogWithFilters,
  type CatalogWithFiltersProps,
} from "@/components/CatalogWithFilters";

/**
 * RSC entry for listing explorers. `CatalogWithFilters` reads `useSearchParams`
 * (filters/sort); Next 15 prerender requires a parent Suspense boundary.
 */
export function CatalogExplorer(props: CatalogWithFiltersProps) {
  return (
    <Suspense fallback={null}>
      <CatalogWithFilters {...props} />
    </Suspense>
  );
}
