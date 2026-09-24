import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_HUB_FILTER_CHIPS,
  AVATAR_HUB_PATH,
  AVATAR_LEGACY_PATH,
  avatarChildRedirectPath,
  avatarHubFilterHref,
  avatarHubHeroFetchParams,
  getAvatarHubFilterNavItems,
  isAvatarClusterPath,
  isAvatarHubPath,
  toAvatarHubHeroCarouselCards,
} from "./foto-na-avatarku-cluster";

test("avatar hub path is /promty-dlya-foto/na-avatarku", () => {
  assert.equal(AVATAR_HUB_PATH, "/promty-dlya-foto/na-avatarku");
  assert.equal(isAvatarHubPath(AVATAR_HUB_PATH), true);
  assert.equal(isAvatarHubPath(`${AVATAR_HUB_PATH}/`), true);
  assert.equal(isAvatarHubPath(AVATAR_LEGACY_PATH), false);
  assert.equal(isAvatarClusterPath(AVATAR_LEGACY_PATH), true);
  assert.equal(avatarChildRedirectPath(AVATAR_LEGACY_PATH), AVATAR_HUB_PATH);
  assert.equal(avatarChildRedirectPath(`${AVATAR_LEGACY_PATH}/portret`), AVATAR_HUB_PATH);
  assert.equal(avatarChildRedirectPath(`${AVATAR_HUB_PATH}/portret`), AVATAR_HUB_PATH);
  assert.equal(avatarChildRedirectPath(AVATAR_HUB_PATH), null);
});

test("avatar hero stays on object_tag=na_avatarku and ignores query filters", () => {
  const params = avatarHubHeroFetchParams({
    audience_tag: "devushka",
    style_tag: "portret",
    occasion_tag: null,
    object_tag: "osen",
    doc_task_tag: null,
  });
  assert.equal(params.object_tag, "na_avatarku");
  assert.equal(params.audience_tag, null);
  assert.equal(params.style_tag, null);
  assert.equal(params.sort, "new");
});

test("avatar chips stay on the hub and do not replace the object tag", () => {
  assert.ok(AVATAR_HUB_FILTER_CHIPS.every((chip) => chip.queryKey !== "object"));
  assert.equal(
    avatarHubFilterHref(AVATAR_HUB_FILTER_CHIPS[0]),
    `${AVATAR_HUB_PATH}?audience=devushka`,
  );
  const items = getAvatarHubFilterNavItems({ style: "portret" });
  assert.equal(items.find((item) => item.label === "Портрет")?.active, true);
  assert.equal(items.find((item) => item.label === "Девушка")?.active, false);
});

test("avatar hero carousel drops cards without a photo", () => {
  const cards = toAvatarHubHeroCarouselCards([
    { photoUrl: null, id: "a" },
    { photoUrl: "https://cdn.example/avatar.jpg", id: "b" },
  ]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "b");
});
