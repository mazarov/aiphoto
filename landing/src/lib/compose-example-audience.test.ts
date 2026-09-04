import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPOSE_EXAMPLE_AUDIENCE_CONFIDENCE_MIN,
  composeExampleAudienceChipLabel,
  composeExamplePickerListingAudience,
  isComposeExampleAudienceTag,
  mapComposeAudienceClassification,
  parseComposeExampleMatchDailyLimit,
} from "./compose-example-audience";

test("mapComposeAudienceClassification keeps solo adult gender", () => {
  assert.equal(
    mapComposeAudienceClassification({
      audience: "devushka",
      peopleCount: 1,
      hasVisibleFace: true,
      hasChild: false,
      confidence: 0.9,
    }),
    "devushka",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "muzhchina",
      peopleCount: 1,
      hasVisibleFace: true,
      confidence: 0.8,
    }),
    "muzhchina",
  );
});

test("mapComposeAudienceClassification rejects low confidence and no face", () => {
  assert.equal(
    mapComposeAudienceClassification({
      audience: "devushka",
      peopleCount: 1,
      hasVisibleFace: true,
      confidence: COMPOSE_EXAMPLE_AUDIENCE_CONFIDENCE_MIN - 0.01,
    }),
    null,
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "devushka",
      peopleCount: 1,
      hasVisibleFace: false,
      confidence: 0.99,
    }),
    null,
  );
});

test("mapComposeAudienceClassification does not guess couple on a selfie", () => {
  assert.equal(
    mapComposeAudienceClassification({
      audience: "para",
      peopleCount: 1,
      hasVisibleFace: true,
      confidence: 0.95,
    }),
    null,
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "semya",
      peopleCount: 1,
      hasVisibleFace: true,
      hasChild: false,
      confidence: 0.95,
    }),
    null,
  );
});

test("mapComposeAudienceClassification maps groups only with enough people", () => {
  assert.equal(
    mapComposeAudienceClassification({
      audience: "para",
      peopleCount: 2,
      hasVisibleFace: true,
      confidence: 0.9,
    }),
    "para",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "semya",
      peopleCount: 3,
      hasVisibleFace: true,
      hasChild: true,
      confidence: 0.88,
    }),
    "semya",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "none",
      peopleCount: 2,
      hasVisibleFace: true,
      hasChild: true,
      confidence: 0.9,
    }),
    "semya",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "devushka",
      peopleCount: 2,
      hasVisibleFace: true,
      confidence: 0.9,
    }),
    null,
  );
});

test("mapComposeAudienceClassification maps solo child to catalog child tags", () => {
  assert.equal(
    mapComposeAudienceClassification({
      audience: "devochka",
      peopleCount: 1,
      hasVisibleFace: true,
      hasChild: true,
      confidence: 0.95,
    }),
    "devochka",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "malchik",
      peopleCount: 1,
      hasVisibleFace: true,
      hasChild: true,
      confidence: 0.92,
    }),
    "malchik",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "devushka",
      peopleCount: 1,
      hasVisibleFace: true,
      hasChild: true,
      confidence: 0.95,
    }),
    "devochka",
  );
  assert.equal(
    mapComposeAudienceClassification({
      audience: "none",
      peopleCount: 1,
      hasVisibleFace: true,
      hasChild: true,
      confidence: 0.9,
    }),
    "malysh",
  );
});

test("composeExamplePickerListingAudience drops on search or dismiss", () => {
  assert.equal(
    composeExamplePickerListingAudience({
      query: "",
      dismissed: false,
      audienceMatch: "devushka",
    }),
    "devushka",
  );
  assert.equal(
    composeExamplePickerListingAudience({
      query: "осень",
      dismissed: false,
      audienceMatch: "devushka",
    }),
    null,
  );
  assert.equal(
    composeExamplePickerListingAudience({
      query: "",
      dismissed: true,
      audienceMatch: "devushka",
    }),
    null,
  );
  assert.equal(
    composeExamplePickerListingAudience({
      query: "",
      dismissed: false,
      audienceMatch: "s_mamoy",
    }),
    null,
  );
});

test("audience tag helper and chip label", () => {
  assert.equal(isComposeExampleAudienceTag("devushka"), true);
  assert.equal(isComposeExampleAudienceTag("malchik"), true);
  assert.equal(isComposeExampleAudienceTag("s_mamoy"), false);
  assert.equal(composeExampleAudienceChipLabel("devushka"), "Девушки");
  assert.equal(composeExampleAudienceChipLabel("muzhchina"), "Мужчины");
  assert.equal(composeExampleAudienceChipLabel("malchik"), "Мальчик");
  assert.equal(composeExampleAudienceChipLabel("devochka"), "Девочка");
  assert.equal(composeExampleAudienceChipLabel("malysh"), "Малыш");
});

test("parseComposeExampleMatchDailyLimit", () => {
  assert.equal(parseComposeExampleMatchDailyLimit("40", 10), 40);
  assert.equal(parseComposeExampleMatchDailyLimit("", 10), 10);
  assert.equal(parseComposeExampleMatchDailyLimit("0", 10), 10);
});
