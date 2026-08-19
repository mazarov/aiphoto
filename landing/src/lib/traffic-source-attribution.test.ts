import assert from "node:assert/strict";
import test from "node:test";
import {
  attributionFromLocation,
  EMPTY_TRAFFIC_SOURCE_ATTRIBUTION,
  hasFirstKnownSource,
  normalizeUtmSourceForReport,
  parseAttributionCookie,
  readAttributionFromSearch,
  resolveFirstKnownAttribution,
  sanitizeAttributionBag,
  sanitizeLandingPath,
  sanitizeUtmField,
  serializeAttributionCookie,
  shouldAttemptClientAttributionPersist,
  shouldPersistAttributionOnServer,
  toAttributionPersistPayload,
  UTM_COOKIE_MAX_AGE_SEC,
  UTM_COOKIE_NAME,
} from "./traffic-source-attribution";

const PAID = {
  utm_source: "yandex",
  utm_medium: "cpc",
  utm_campaign: "123",
  utm_content: "456.premium.1",
  utm_term: "промпт",
  utm_landing_path: "/generaciya-foto",
};

test("sanitizeUtmField strips controls and caps length", () => {
  assert.equal(sanitizeUtmField("  yandex\u0001 "), "yandex");
  assert.equal(sanitizeUtmField("x".repeat(80)), "x".repeat(64));
  assert.equal(sanitizeUtmField(""), null);
  assert.equal(sanitizeUtmField(1), null);
});

test("sanitizeLandingPath keeps pathname without query or hash", () => {
  assert.equal(sanitizeLandingPath("/p/card?utm_source=yandex#top"), "/p/card");
  assert.equal(sanitizeLandingPath("https://promptshot.ru/pricing?x=1"), "/pricing");
  assert.equal(sanitizeLandingPath("pricing"), null);
  assert.equal(sanitizeLandingPath(`/${"a".repeat(250)}`), `/${"a".repeat(199)}`);
});

test("stored first-known UTM wins over a later campaign", () => {
  const later = { ...PAID, utm_campaign: "999", utm_landing_path: "/pricing" };
  const resolved = resolveFirstKnownAttribution(later, PAID);
  assert.deepEqual(resolved.attribution, PAID);
  assert.equal(resolved.persist, null);
});

test("direct then paid fills empty attribution atomically", () => {
  const resolved = resolveFirstKnownAttribution(PAID, EMPTY_TRAFFIC_SOURCE_ATTRIBUTION);
  assert.deepEqual(resolved.attribution, PAID);
  assert.deepEqual(resolved.persist, PAID);
  assert.equal(hasFirstKnownSource(EMPTY_TRAFFIC_SOURCE_ATTRIBUTION), false);
});

test("UTM bag does not require yclid and cookie round-trips without it", () => {
  const fromUrl = readAttributionFromSearch(
    "?utm_source=yandex&utm_medium=cpc&yclid=14264778086066946047",
  );
  assert.equal(fromUrl.utm_source, "yandex");
  assert.equal(fromUrl.utm_medium, "cpc");
  assert.equal("yclid" in fromUrl, false);
  const parsed = parseAttributionCookie(serializeAttributionCookie(fromUrl));
  assert.equal(parsed?.utm_source, "yandex");
  assert.equal(parsed && "yclid" in parsed, false);
});

test("attributionFromLocation adds first landing path from pathname", () => {
  assert.deepEqual(
    attributionFromLocation("utm_source=yandex&utm_medium=cpc", "/p/card?x=1"),
    {
      utm_source: "yandex",
      utm_medium: "cpc",
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      utm_landing_path: "/p/card",
    },
  );
});

test("invalid cookie JSON is ignored so a later paid URL can fill", () => {
  assert.equal(parseAttributionCookie("{"), null);
  assert.equal(parseAttributionCookie(JSON.stringify({ utm_medium: "cpc" })), null);
  const resolved = resolveFirstKnownAttribution(
    attributionFromLocation("?utm_source=yandex", "/"),
    parseAttributionCookie("{"),
  );
  assert.equal(resolved.persist?.utm_source, "yandex");
});

test("normalizeUtmSourceForReport maps ya/yandex but raw helpers keep ya", () => {
  assert.equal(sanitizeUtmField("ya"), "ya");
  assert.equal(normalizeUtmSourceForReport("ya"), "yandex");
  assert.equal(normalizeUtmSourceForReport("Yandex"), "yandex");
  assert.equal(normalizeUtmSourceForReport("vk"), "vk");
});

test("cookie contract matches yclid TTL and name", () => {
  assert.equal(UTM_COOKIE_NAME, "promptshot_utm");
  assert.equal(UTM_COOKIE_MAX_AGE_SEC, 21 * 24 * 60 * 60);
});

test("client persist skips callback, anonymous, and token-refresh duplicates", () => {
  const userId = "263dd707-e1ee-46d9-9a97-c11ad34c289d";
  assert.equal(
    shouldAttemptClientAttributionPersist({
      userId,
      isAnonymous: false,
      pathname: "/",
      alreadyPersistedUserId: null,
    }),
    true,
  );
  assert.equal(
    shouldAttemptClientAttributionPersist({
      userId,
      isAnonymous: true,
      pathname: "/",
      alreadyPersistedUserId: null,
    }),
    false,
  );
  assert.equal(
    shouldAttemptClientAttributionPersist({
      userId,
      isAnonymous: false,
      pathname: "/auth/callback",
      alreadyPersistedUserId: null,
    }),
    false,
  );
  assert.equal(
    shouldAttemptClientAttributionPersist({
      userId,
      isAnonymous: false,
      pathname: "/",
      alreadyPersistedUserId: userId,
    }),
    false,
  );
  assert.equal(
    shouldAttemptClientAttributionPersist({
      userId: null,
      isAnonymous: false,
      pathname: "/",
      alreadyPersistedUserId: null,
    }),
    false,
  );
});

test("server persist skips anonymous, guest owner, and missing visitor", () => {
  assert.equal(
    shouldPersistAttributionOnServer({
      isAnonymous: false,
      usedGuestOwner: false,
      visitorId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
    }),
    true,
  );
  assert.equal(
    shouldPersistAttributionOnServer({
      isAnonymous: true,
      usedGuestOwner: false,
      visitorId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
    }),
    false,
  );
  assert.equal(
    shouldPersistAttributionOnServer({
      isAnonymous: false,
      usedGuestOwner: true,
      visitorId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
    }),
    false,
  );
  assert.equal(
    shouldPersistAttributionOnServer({
      isAnonymous: false,
      usedGuestOwner: false,
      visitorId: null,
    }),
    false,
  );
});

test("persist payload keeps UTM and yclid independent", () => {
  assert.deepEqual(
    toAttributionPersistPayload({
      visitorId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
      sessionId: "11111111-2222-4333-8444-555555555555",
      attribution: sanitizeAttributionBag({ utm_source: "yandex" }),
      yclid: null,
    }),
    {
      visitorId: "263dd707-e1ee-46d9-9a97-c11ad34c289d",
      sessionId: "11111111-2222-4333-8444-555555555555",
      utm_source: "yandex",
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      utm_landing_path: null,
      yclid: null,
    },
  );
});
