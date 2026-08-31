import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PUBLISH_REWARD_CONFIG,
  PUBLISH_REWARD_RETRY_WINDOW_MS,
  parsePublishRewardConfig,
  publishRewardAmount,
  publishRewardCreditsLabel,
  publishRewardKindForGeneration,
  publishRewardToastMessage,
  remainingPublishRewardToday,
  shouldAttemptPublishReward,
  visiblePublishRewardCredits,
} from "./publish-reward";

test("kind: video beats photoshoot discriminator", () => {
  assert.equal(
    publishRewardKindForGeneration({ modality: "video", editKind: "photoshoot" }),
    "video",
  );
});

test("kind: photoshoot and camera orbit", () => {
  assert.equal(
    publishRewardKindForGeneration({ modality: "image", editKind: "photoshoot" }),
    "photoshoot",
  );
  assert.equal(
    publishRewardKindForGeneration({ modality: "image", editKind: "camera_orbit" }),
    "photo",
  );
});

test("amounts match product table", () => {
  const amounts = DEFAULT_PUBLISH_REWARD_CONFIG;
  assert.equal(publishRewardAmount("photo", amounts), 1);
  assert.equal(publishRewardAmount("video", amounts), 5);
  assert.equal(publishRewardAmount("photoshoot", amounts), 2);
});

test("visible +N hidden when remaining below amount", () => {
  assert.equal(
    visiblePublishRewardCredits({
      enabled: true,
      isPublished: false,
      amount: 5,
      remainingToday: 3,
    }),
    null,
  );
  assert.equal(
    visiblePublishRewardCredits({
      enabled: true,
      isPublished: false,
      amount: 5,
      remainingToday: 5,
    }),
    5,
  );
  assert.equal(
    visiblePublishRewardCredits({
      enabled: true,
      isPublished: true,
      amount: 1,
      remainingToday: 20,
    }),
    null,
  );
});

test("credit noun for grant copy", () => {
  assert.equal(publishRewardCreditsLabel(1), "+1 кредит");
  assert.equal(publishRewardCreditsLabel(2), "+2 кредита");
  assert.equal(publishRewardCreditsLabel(5), "+5 кредитов");
});

test("promised +N stays visible while reward flag is off", () => {
  assert.equal(
    visiblePublishRewardCredits({
      enabled: false,
      isPublished: false,
      amount: 1,
      remainingToday: 0,
    }),
    1,
  );
});

test("remaining today floors at zero", () => {
  assert.equal(remainingPublishRewardToday(20, 4), 16);
  assert.equal(remainingPublishRewardToday(20, 25), 0);
});

test("first publish attempts grant even before first_published_at is echoed", () => {
  assert.equal(
    shouldAttemptPublishReward({
      enabled: true,
      alreadyPublished: false,
      firstPublishedAt: null,
    }),
    true,
  );
});

test("legacy cards and disabled flag skip grant", () => {
  assert.equal(
    shouldAttemptPublishReward({
      enabled: false,
      alreadyPublished: false,
      firstPublishedAt: new Date().toISOString(),
    }),
    false,
  );
});

test("retry window covers first-publish crash, not old admin publish", () => {
  const now = Date.parse("2026-08-31T12:00:00.000Z");
  assert.equal(
    shouldAttemptPublishReward({
      enabled: true,
      alreadyPublished: true,
      firstPublishedAt: new Date(now - 60_000).toISOString(),
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    shouldAttemptPublishReward({
      enabled: true,
      alreadyPublished: true,
      firstPublishedAt: new Date(
        now - PUBLISH_REWARD_RETRY_WINDOW_MS - 1,
      ).toISOString(),
      nowMs: now,
    }),
    false,
  );
});

test("toast copy for grant, cap, and prompts", () => {
  assert.equal(
    publishRewardToastMessage({
      wasPublished: false,
      reward: { status: "granted", credits: 1, reason: "granted" },
    }),
    "Опубликовано · +1 кредит",
  );
  assert.equal(
    publishRewardToastMessage({
      wasPublished: false,
      reward: { status: "daily_cap", credits: 0, reason: "daily_cap" },
    }),
    "Опубликовано. Бонус на сегодня закончился",
  );
  assert.equal(
    publishRewardToastMessage({
      wasPublished: true,
      promptsReady: true,
    }),
    "Промпты обновлены",
  );
});

test("config parser is fail-closed", () => {
  const parsed = parsePublishRewardConfig({
    publish_reward_enabled: "true",
    publish_reward_photo: "1",
    publish_reward_video: "5",
    publish_reward_photoshoot: "2",
    publish_reward_daily_cap: "20",
  });
  assert.deepEqual(parsed, {
    enabled: true,
    photo: 1,
    video: 5,
    photoshoot: 2,
    dailyCap: 20,
  });
  assert.equal(parsePublishRewardConfig({}).enabled, false);
});
