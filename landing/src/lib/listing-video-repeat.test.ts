import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_VIDEO_REPEAT_KIND,
  listingVideoRepeatFollowupIdempotencyKey,
  parseListingVideoRepeatClientPipeline,
  parseListingVideoRepeatSpec,
} from "./listing-video-repeat";

test("client pipeline accepts listing_video_repeat only", () => {
  assert.equal(parseListingVideoRepeatClientPipeline(null), null);
  assert.equal(parseListingVideoRepeatClientPipeline({ kind: "other" }), null);
  const parsed = parseListingVideoRepeatClientPipeline({
    kind: LISTING_VIDEO_REPEAT_KIND,
    videoPrompt: "Ветер в волосах",
    videoModel: "grok-imagine-video-1.5",
    durationSeconds: 4,
    aspectRatio: "9:16",
  });
  assert.equal(parsed?.kind, LISTING_VIDEO_REPEAT_KIND);
  assert.equal(parsed?.videoPrompt, "Ветер в волосах");
  assert.equal(parsed?.videoModel, "grok-imagine-video-1.5");
});

test("stored spec keeps only a short motion beat", () => {
  const spec = parseListingVideoRepeatSpec({
    kind: LISTING_VIDEO_REPEAT_KIND,
    videoPrompt: "Visual Hook:\nGold\n\nMotion:\nКрылья медленно раскрываются",
    videoModel: "grok-imagine-video-1.5",
    durationSeconds: 4,
    aspectRatio: "9:16",
    resolution: "720p",
    credits: 30,
  });
  assert.equal(spec?.videoPrompt, "Крылья медленно раскрываются");
  assert.equal(spec?.credits, 30);
  assert.equal(
    parseListingVideoRepeatSpec({
      kind: LISTING_VIDEO_REPEAT_KIND,
      videoPrompt: "Ветер",
      videoModel: "grok-imagine-video-1.5",
      durationSeconds: 4,
      aspectRatio: "9:16",
      resolution: "720p",
      credits: -1,
    }),
    null,
  );
});

test("followup idempotency is stable per image job", () => {
  assert.equal(
    listingVideoRepeatFollowupIdempotencyKey(" 11111111-1111-1111-1111-111111111111 "),
    "listing-video-repeat:11111111-1111-1111-1111-111111111111",
  );
});
