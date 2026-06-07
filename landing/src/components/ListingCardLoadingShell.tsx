import { ListingCardChromeSkeleton, ListingCardPhotoSkeleton } from "./ListingCardPhotoSkeleton";

type Props = {
  /** When false, skeleton omits the bottom CTA capsule (title-only footer). */
  hasPrompts?: boolean;
  /** Catalog/search: no hover chrome — photo shimmer only, no footer pills. */
  photoOnly?: boolean;
};

/**
 * Unified loading shell for listing cards — same visual as pagination skeleton,
 * safe over `bg-zinc-200` (no backdrop-blur glass over unpainted photo).
 */
export function ListingCardLoadingShell({ hasPrompts = true, photoOnly = false }: Props) {
  return (
    <>
      <ListingCardPhotoSkeleton overlay fullFrame={photoOnly} />
      {!photoOnly && <ListingCardChromeSkeleton hasPrompts={hasPrompts} />}
    </>
  );
}
