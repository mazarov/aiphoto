import assert from "node:assert/strict";
import test from "node:test";
import { GENERACIYA_KARTINKA_PO_OPISANIYU_PATH } from "./generaciya-foto-routes";
import { PROMTY_DLYA_FOTO_PAR_HUB_PATH } from "./promty-dlya-foto-par-cluster";
import {
  adminHeroCards,
  decidePageHeroPin,
  isHeroCuratablePath,
  parsePageHeroWrite,
  publicHeroCards,
  seedShouldSkip,
  takeSeedCardIds,
  type HeroMembershipCard,
} from "./page-hero";
import { listHeroSeedPlans } from "./page-hero-seed";

const SEEDED_AT = "2026-11-01T00:00:00.000Z";

function card(
  id: string,
  popularityScore: number | null,
  createdAt: string,
  extras: Partial<HeroMembershipCard> = {},
): HeroMembershipCard {
  return {
    id,
    isPublished: true,
    hasPhoto: true,
    popularityScore,
    createdAt,
    pinnedAt: SEEDED_AT,
    ...extras,
  };
}

test("hero allowlist accepts hub, home, generaciya and nano paths", () => {
  assert.equal(isHeroCuratablePath("/"), true);
  assert.equal(isHeroCuratablePath(PROMTY_DLYA_FOTO_PAR_HUB_PATH), true);
  assert.equal(isHeroCuratablePath(`${PROMTY_DLYA_FOTO_PAR_HUB_PATH}/`), true);
  assert.equal(isHeroCuratablePath("/generaciya/po-foto/pary"), true);
  assert.equal(isHeroCuratablePath("/nano-banana"), true);
  assert.equal(isHeroCuratablePath("/nano-banana/pro"), true);
  assert.equal(isHeroCuratablePath("/search"), false);
  assert.equal(isHeroCuratablePath("/ii-fotosessiya"), false);
  assert.equal(isHeroCuratablePath("/p/some-card"), false);
});

test("latest pin leads the hero, before any seeded card", () => {
  const rows = [
    card("seeded-popular", 99, "2020-01-01T00:00:00.000Z"),
    card("pinned-earlier", 1, "2026-01-01T00:00:00.000Z", {
      pinnedAt: "2026-11-05T00:00:00.000Z",
    }),
    card("pinned-latest", 0, "2019-01-01T00:00:00.000Z", {
      pinnedAt: "2026-11-08T08:00:00.000Z",
    }),
  ];
  assert.deepEqual(
    publicHeroCards(rows).map((row) => row.id),
    ["pinned-latest", "pinned-earlier", "seeded-popular"],
  );
});

test("hero has no cap", () => {
  const rows = Array.from({ length: 40 }, (_, index) =>
    card(`c${index}`, index, "2024-01-01T00:00:00.000Z"),
  );
  assert.equal(publicHeroCards(rows).length, 40);
});

test("seeded rows share a pin time, so popularity orders them", () => {
  const rows = [
    card("old-popular", 10, "2020-01-01T00:00:00.000Z"),
    card("new-quiet", 1, "2026-01-01T00:00:00.000Z"),
    card("hidden", 99, "2026-02-01T00:00:00.000Z", { isPublished: false }),
    card("no-photo", 50, "2026-03-01T00:00:00.000Z", { hasPhoto: false }),
    card("tied-b", 10, "2024-01-01T00:00:00.000Z"),
    card("tied-a", 10, "2024-01-01T00:00:00.000Z"),
  ];
  assert.deepEqual(
    publicHeroCards(rows).map((row) => row.id),
    ["tied-b", "tied-a", "old-popular", "new-quiet"],
  );
  assert.deepEqual(
    adminHeroCards(rows).map((row) => row.id),
    ["hidden", "no-photo", "tied-b", "tied-a", "old-popular", "new-quiet"],
  );
});

test("pin inserts, a repeat pin is a no-op, unpin deletes", () => {
  assert.deepEqual(decidePageHeroPin({ op: "pin", alreadyPinned: false }), { action: "insert" });
  assert.deepEqual(decidePageHeroPin({ op: "pin", alreadyPinned: true }), { action: "noop" });
  assert.deepEqual(decidePageHeroPin({ op: "unpin", alreadyPinned: false }), { action: "noop" });
  assert.deepEqual(decidePageHeroPin({ op: "unpin", alreadyPinned: true }), { action: "delete" });
});

test("seed skips a path that already has rows and keeps photo cards only", () => {
  assert.equal(seedShouldSkip(0), false);
  assert.equal(seedShouldSkip(1), true);
  assert.deepEqual(
    takeSeedCardIds([
      { id: "a", photoUrl: "https://cdn/a.jpg" },
      { id: "b", photoUrl: null },
      { id: "a", photoUrl: "https://cdn/a.jpg" },
      { id: "c", photoUrl: "https://cdn/c.jpg" },
    ]),
    ["a", "c"],
  );
});

test("seed plans are popular, unique, and stay on the allowlist", () => {
  const plans = listHeroSeedPlans();
  const paths = plans.map((plan) => plan.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes(PROMTY_DLYA_FOTO_PAR_HUB_PATH));
  assert.ok(paths.includes(GENERACIYA_KARTINKA_PO_OPISANIYU_PATH));
  for (const plan of plans) {
    assert.equal(isHeroCuratablePath(plan.path), true);
    if (plan.kind === "rpc") assert.equal(plan.params.sort, "popular");
  }
  const kartinka = plans.find((plan) => plan.path === GENERACIYA_KARTINKA_PO_OPISANIYU_PATH);
  assert.equal(kartinka?.kind, "kartinka");
  const pairs = plans.find((plan) => plan.path === PROMTY_DLYA_FOTO_PAR_HUB_PATH);
  assert.equal(pairs?.kind, "rpc");
  if (pairs?.kind === "rpc") assert.equal(pairs.params.audience_tag, "para");
});

test("write parser rejects unknown pages and accepts an id or slug", () => {
  assert.equal(parsePageHeroWrite({ path: "/search", op: "pin", query: "abc" }).ok, false);
  const pinned = parsePageHeroWrite({
    path: PROMTY_DLYA_FOTO_PAR_HUB_PATH,
    op: "pin",
    cardId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(pinned.ok, true);
  if (pinned.ok) assert.equal(pinned.value.path, PROMTY_DLYA_FOTO_PAR_HUB_PATH);
  const bySlug = parsePageHeroWrite({
    path: "/",
    op: "unpin",
    query: "portret-v-lesu",
  });
  assert.equal(bySlug.ok, true);
});
