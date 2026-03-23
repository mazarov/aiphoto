import { ListingCardChromeSkeleton, ListingCardPhotoSkeleton } from "./ListingCardPhotoSkeleton";

const GRID =
  "columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-2 sm:gap-4";

type Props = {
  count?: number;
};

/**
 * Placeholders while fetching the next listing page — same outer shape as PromptCard / GroupedCard.
 */
export function ListingGridLoadingSkeleton({ count = 8 }: Props) {
  return (
    <div className={`${GRID} py-6`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка следующих карточек</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mb-2 sm:mb-4 break-inside-avoid">
          <article className="relative isolate overflow-hidden rounded-2xl bg-transparent shadow-md shadow-zinc-900/[0.06] ring-1 ring-zinc-900/[0.06]">
            <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-200/90 aspect-[3/4] ring-1 ring-black/[0.04]">
              <ListingCardPhotoSkeleton />
              <ListingCardChromeSkeleton />
            </div>
          </article>
        </div>
      ))}
    </div>
  );
}
