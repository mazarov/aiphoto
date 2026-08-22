import assert from "node:assert/strict";
import test from "node:test";
import {
  mailOneClickUnsubscribeUrl,
  mailUnsubscribeUrl,
  signMailUnsubscribeToken,
  verifyMailUnsubscribeToken,
} from "./mail-unsubscribe";

const SECRET = "test-unsubscribe-secret";

test("unsubscribe token round-trips and rejects tampering", () => {
  const token = signMailUnsubscribeToken("User@Example.com", SECRET);
  assert.equal(verifyMailUnsubscribeToken(token, SECRET), "user@example.com");
  assert.equal(verifyMailUnsubscribeToken(`${token}x`, SECRET), null);
  assert.equal(verifyMailUnsubscribeToken(token, "other"), null);
});

test("public and one-click URLs carry the signed token", () => {
  const prevSecret = process.env.MAIL_UNSUBSCRIBE_SECRET;
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.MAIL_UNSUBSCRIBE_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = "https://promptshot.ru";
  try {
    const page = mailUnsubscribeUrl("user@example.com");
    const api = mailOneClickUnsubscribeUrl("user@example.com");
    assert.match(page, /^https:\/\/promptshot\.ru\/unsubscribe\?t=/);
    assert.match(api, /^https:\/\/promptshot\.ru\/api\/mail\/unsubscribe\?t=/);
  } finally {
    process.env.MAIL_UNSUBSCRIBE_SECRET = prevSecret;
    process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
});
