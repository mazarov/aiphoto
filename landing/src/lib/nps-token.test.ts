import assert from "node:assert/strict";
import test from "node:test";
import {
  npsOcenkaUrl,
  npsScoreLines,
  parseNpsComment,
  parseNpsScore,
  signNpsToken,
  verifyNpsToken,
} from "./nps-token";

const SECRET = "test-nps-secret";
const SURVEY_ID = "11111111-1111-4111-8111-111111111111";

test("NPS token round-trips and rejects tampering", () => {
  const previous = process.env.MAIL_UNSUBSCRIBE_SECRET;
  process.env.MAIL_UNSUBSCRIBE_SECRET = SECRET;
  try {
    const token = signNpsToken(SURVEY_ID);
    assert.equal(verifyNpsToken(token), SURVEY_ID);
    assert.equal(verifyNpsToken(`${token}x`), null);
    assert.equal(verifyNpsToken("v1.not-a-token.abc"), null);
    assert.equal(signNpsToken("not-a-uuid"), "");
  } finally {
    process.env.MAIL_UNSUBSCRIBE_SECRET = previous;
  }
});

test("parseNpsScore accepts only 1-10 integers", () => {
  assert.equal(parseNpsScore("7"), 7);
  assert.equal(parseNpsScore(10), 10);
  assert.equal(parseNpsScore("0"), null);
  assert.equal(parseNpsScore("11"), null);
  assert.equal(parseNpsScore("7.5"), null);
  assert.equal(parseNpsScore(""), null);
});

test("parseNpsComment trims and caps length", () => {
  assert.equal(parseNpsComment("  ок  "), "ок");
  assert.equal(parseNpsComment("   "), null);
  assert.equal(parseNpsComment("x".repeat(2500))?.length, 2000);
});

test("ocenka links include token and score", () => {
  const previous = process.env.MAIL_UNSUBSCRIBE_SECRET;
  process.env.MAIL_UNSUBSCRIBE_SECRET = SECRET;
  try {
    const url = npsOcenkaUrl(SURVEY_ID, 9, "https://promptshot.ru");
    assert.match(url, /^https:\/\/promptshot\.ru\/ocenka\?t=/);
    assert.match(url, /s=9$/);
    const lines = npsScoreLines(SURVEY_ID);
    assert.equal(lines.length, 10);
    assert.match(lines[0], /^1 — /);
    assert.match(lines[9], /^10 — /);
  } finally {
    process.env.MAIL_UNSUBSCRIBE_SECRET = previous;
  }
});
