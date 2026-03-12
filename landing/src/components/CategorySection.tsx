"use client";

import { useState } from "react";
import { CategoryCard } from "./CategoryCard";

export type CategoryItemDisplayData = {
  dimension: string;
  slug: string;
  total_count: number;
  photoUrl: string | null;
  secondPhotoUrl: string | null;
};

type CategoryItem = {
  label: string;
  href: string;
  data: CategoryItemDisplayData;
};

type Props = {
  title: string;
  items: CategoryItem[];
  isFirstSection?: boolean;
};

const COLLAPSED_LIMIT = 10;

export function CategorySection({ title, items, isFirstSection = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visible = items.filter((i) => i.data.total_count > 0);
  if (visible.length === 0) return null;

  const needsExpand = visible.length > COLLAPSED_LIMIT;
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_LIMIT);
  const hiddenForSeo = !expanded && needsExpand ? visible.slice(COLLAPSED_LIMIT) : [];

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-zinc-900">{title}</h2>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
        {shown.map((item, i) => (
          <CategoryCard
            key={`${item.data.dimension}:${item.data.slug}`}
            label={item.label}
            href={item.href}
            totalCount={item.data.total_count}
            photoUrl={item.data.photoUrl}
            secondPhotoUrl={item.data.secondPhotoUrl}
            priority={isFirstSection && i < 5}
          />
        ))}
      </div>

      {/* Hidden links rendered in DOM for SEO crawlers, visually hidden */}
      {hiddenForSeo.length > 0 && (
        <div className="sr-only" aria-hidden="true">
          {hiddenForSeo.map((item) => (
            <a key={`${item.data.dimension}:${item.data.slug}`} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {needsExpand && !expanded && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            Показать все ({visible.length})
          </button>
        </div>
      )}
    </section>
  );
}
