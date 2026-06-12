import { ListingCardLoadingShell } from "./ListingCardLoadingShell";
import { LISTING_GRID_CLASSES } from "./ListingGrid";

type Props = {
  count?: number;
  /** Match catalog/search cards — no chrome footer pills in placeholders. */
  photoOnly?: boolean;
};

/**
 * Placeholders while fetching the next listing page — same outer shape as PromptCard / GroupedCard.
 */
export function ListingGridLoadingSkeleton({ count = 8, photoOnly = false }: Props) {
  return (
    <div className={`${LISTING_GRID_CLASSES} py-6`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка следующих карточек</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="min-w-0">
          <article className="relative isolate overflow-hidden rounded-2xl bg-transparent shadow-md shadow-zinc-900/[0.06] ring-1 ring-zinc-900/[0.06]">
            <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-200/90 aspect-[3/4] ring-1 ring-black/[0.04]">
              <ListingCardLoadingShell photoOnly={photoOnly} />
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
