import assert from "node:assert/strict";
import test from "node:test";
import type { CardPageData } from "./supabase";
import {
  canLoadMoreListingNavigation,
  isListingNavigationLoadingMore,
  primeListingNavigationCardData,
  readListingNavigationCard,
  requestListingNavigationLoadMore,
  resetListingNavigationRuntimeForTests,
  subscribeListingNavigationLoadMore,
  syncListingNavigationPaginationState,
  writeListingNavigationContext,
} from "./listing-card-navigation-context";

function makeCard(slug: string): CardPageData {
  return {
    id: `id-${slug}`,
    slug,
    title_ru: slug,
    title_en: null,
    seo_tags: null,
    hashtags: [],
    source_date: null,
    source_dataset_slug: null,
    source_message_id: null,
    seo_readiness_score: null,
    promptTexts: ["prompt"],
    photoUrls: ["https://cdn.example/a.jpg"],
    photoMeta: [],
    photoDimensions: [],
    beforePhotoUrl: null,
    videoUrl: null,
    mainPhotoUrl: "https://cdn.example/a.jpg",
    card_split_index: 0,
    card_split_total: 1,
    siblings: [],
    groupFirstSlug: null,
    likesCount: 0,
    dislikesCount: 0,
    viewCount: 0,
    isPublished: true,
    moderationStatus: "none",
    authorUserId: null,
    authorAvatarUrl: null,
    authorDisplayName: null,
    viewerIsOwner: false,
  };
}

test.afterEach(() => {
  resetListingNavigationRuntimeForTests();
});

test("priming a secondary carousel does not wipe main listing card cache", () => {
  primeListingNavigationCardData([makeCard("grid-1"), makeCard("grid-2")]);
  primeListingNavigationCardData([makeCard("hero-1")]);

  assert.equal(readListingNavigationCard("grid-1")?.slug, "grid-1");
  assert.equal(readListingNavigationCard("grid-2")?.slug, "grid-2");
  assert.equal(readListingNavigationCard("hero-1")?.slug, "hero-1");
});

test("canLoadMoreListingNavigation requires both hasMore=true and a matching mounted subscriber", () => {
  writeListingNavigationContext(["a", "b"], {
    sourceId: "main-grid",
    hasMore: true,
  });
  // No mounted subscriber yet (e.g. standalone /p/[slug] tab).
  assert.equal(canLoadMoreListingNavigation(), false);

  const unsubCarousel = subscribeListingNavigationLoadMore(() => {}, {
    sourceId: "hero-carousel",
  });
  assert.equal(canLoadMoreListingNavigation(), false);

  const unsubGrid = subscribeListingNavigationLoadMore(() => {}, {
    sourceId: "main-grid",
  });
  assert.equal(canLoadMoreListingNavigation(), true);

  // Clicking inside the non-paginated hero carousel switches active owner to hero-carousel.
  writeListingNavigationContext(["h1", "h2"], {
    sourceId: "hero-carousel",
    hasMore: false,
  });
  assert.equal(canLoadMoreListingNavigation(), false);

  // Main grid background pagination update must not clobber active hero-carousel state.
  syncListingNavigationPaginationState({
    sourceId: "main-grid",
    hasMore: true,
  });
  assert.equal(canLoadMoreListingNavigation(), false);

  // Clicking back into main grid restores pagination capability.
  writeListingNavigationContext(["a", "b"], {
    sourceId: "main-grid",
    hasMore: true,
  });
  assert.equal(canLoadMoreListingNavigation(), true);

  syncListingNavigationPaginationState({
    sourceId: "main-grid",
    hasMore: false,
  });
  assert.equal(canLoadMoreListingNavigation(), false);

  unsubCarousel();
  unsubGrid();
});

test("requestListingNavigationLoadMore deduplicates concurrent calls and routes only to active source", async () => {
  let gridCalls = 0;
  let carouselCalls = 0;

  const unsubCarousel = subscribeListingNavigationLoadMore(
    async () => {
      carouselCalls += 1;
    },
    { sourceId: "carousel" }
  );
  const unsubGrid = subscribeListingNavigationLoadMore(
    async () => {
      gridCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
    },
    { sourceId: "grid" }
  );

  writeListingNavigationContext(["c1", "c2"], {
    sourceId: "grid",
    hasMore: true,
  });

  const p1 = requestListingNavigationLoadMore();
  const p2 = requestListingNavigationLoadMore();
  assert.equal(isListingNavigationLoadingMore(), true);

  await Promise.all([p1, p2]);
  assert.equal(isListingNavigationLoadingMore(), false);
  assert.equal(gridCalls, 1);
  assert.equal(carouselCalls, 0);

  unsubCarousel();
  unsubGrid();
});
