import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPOSE_EXAMPLE_AUDIENCE_CACHE_VERSION,
  composeExampleAudienceListingUrl,
  composeExampleMatchPhotoKey,
  peekComposeExampleAudience,
  peekComposeExampleListing,
  readComposeExampleAudience,
  rememberComposeExampleAudience,
  rememberComposeExampleListing,
} from "./compose-example-audience-client";

test("composeExampleMatchPhotoKey versions guest data URLs and library ids", () => {
  const dataUrl = "data:image/jpeg;base64,abc";
  assert.equal(
    composeExampleMatchPhotoKey({ id: "ephemeral", dataUrl }),
    `${COMPOSE_EXAMPLE_AUDIENCE_CACHE_VERSION}:data:${dataUrl.length}:${dataUrl.slice(0, 40)}:${dataUrl.slice(-24)}`,
  );
  assert.equal(
    composeExampleMatchPhotoKey({ id: "photo-1" }),
    `${COMPOSE_EXAMPLE_AUDIENCE_CACHE_VERSION}:photo-1`,
  );
});

test("readComposeExampleAudience uses photo tag then memory cache", () => {
  assert.equal(
    readComposeExampleAudience({ id: "a", audienceTag: "devushka" }, true),
    "devushka",
  );
  assert.equal(
    readComposeExampleAudience({ id: "a", audienceTag: "devushka" }, false),
    null,
  );
  const photo = { id: "cached-boy" };
  rememberComposeExampleAudience(photo, "malchik");
  assert.equal(peekComposeExampleAudience(photo), "malchik");
  assert.equal(readComposeExampleAudience(photo, true), "malchik");
});

test("composeExampleAudienceListingUrl warms newest and tagged first pages", () => {
  assert.equal(
    composeExampleAudienceListingUrl(null),
    "/api/listing?limit=12&sort=new",
  );
  assert.equal(
    composeExampleAudienceListingUrl("devochka"),
    "/api/listing?limit=12&sort=new&audience_tag=devochka&strict=1",
  );
});

test("example listing memory cache hydrates the picker without a second fetch", () => {
  const url = "/api/listing?limit=12&sort=new";
  rememberComposeExampleListing(url, {
    cards: [],
    ranked_batch_size: 12,
    total_count: 0,
  });
  assert.deepEqual(peekComposeExampleListing(url), {
    cards: [],
    ranked_batch_size: 12,
    total_count: 0,
  });
});
