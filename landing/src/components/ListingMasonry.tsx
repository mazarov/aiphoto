import { type ReactNode } from "react";
import {
  FALLBACK_LISTING_ASPECT_RATIOS,
  LISTING_MASONRY_COLUMNS_CLASS,
  LISTING_MASONRY_ITEM_CLASS,
} from "@/lib/listing-masonry";

type MasonryProps = {
  children: ReactNode;
  loading?: boolean;
  className?: string;
};

export function ListingMasonry({
  children,
  loading = false,
  className,
}: MasonryProps) {
  return (
    <div
      className={`${LISTING_MASONRY_COLUMNS_CLASS} transition-opacity ${
        loading ? "opacity-55" : "opacity-100"
      }${className ? ` ${className}` : ""}`}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      {children}
    </div>
  );
}

export function ListingMasonryItem({ children }: { children: ReactNode }) {
  return <div className={LISTING_MASONRY_ITEM_CLASS}>{children}</div>;
}

type SkeletonProps = {
  count?: number;
  className?: string;
};

export function ListingMasonrySkeleton({
  count = 8,
  className,
}: SkeletonProps) {
  return (
    <ListingMasonry className={className} loading>
      <span className="sr-only">Загрузка карточек</span>
      {Array.from({ length: count }, (_, index) => (
        <ListingMasonryItem key={index}>
          <div
            className="w-full animate-pulse rounded-2xl bg-zinc-200/90"
            style={{
              aspectRatio:
                FALLBACK_LISTING_ASPECT_RATIOS[
                  index % FALLBACK_LISTING_ASPECT_RATIOS.length
                ],
            }}
          />
        </ListingMasonryItem>
      ))}
    </ListingMasonry>
  );
}
