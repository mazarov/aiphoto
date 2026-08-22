import assert from "node:assert/strict";
import test from "node:test";
import { aws4SignHeaders, awsAmzDate } from "./aws4";

test("awsAmzDate strips separators", () => {
  const { amzDate, dateStamp } = awsAmzDate(new Date("2026-08-22T06:00:00.000Z"));
  assert.equal(amzDate, "20260822T060000Z");
  assert.equal(dateStamp, "20260822");
});

test("aws4SignHeaders is stable for a fixed clock", () => {
  const headers = aws4SignHeaders({
    method: "POST",
    url: new URL("https://postbox.cloud.yandex.net/v2/email/outbound-emails"),
    region: "ru-central1",
    service: "ses",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    body: "{\"ok\":true}",
    now: new Date("2026-08-22T06:00:00.000Z"),
  });
  assert.equal(headers.host, "postbox.cloud.yandex.net");
  assert.equal(headers["x-amz-date"], "20260822T060000Z");
  assert.match(headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260822\/ru-central1\/ses\/aws4_request, SignedHeaders=/);
  assert.match(headers.authorization, /Signature=[0-9a-f]{64}$/);
  const again = aws4SignHeaders({
    method: "POST",
    url: new URL("https://postbox.cloud.yandex.net/v2/email/outbound-emails"),
    region: "ru-central1",
    service: "ses",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    body: "{\"ok\":true}",
    now: new Date("2026-08-22T06:00:00.000Z"),
  });
  assert.equal(again.authorization, headers.authorization);
});
