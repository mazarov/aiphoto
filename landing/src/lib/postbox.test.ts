import assert from "node:assert/strict";
import test from "node:test";
import { buildPostboxSendEmailBody, sendPostboxEmail, type PostboxConfig } from "./postbox";

const config: PostboxConfig = {
  endpoint: "https://postbox.cloud.yandex.net",
  region: "ru-central1",
  accessKeyId: "AKID",
  secretAccessKey: "secret",
  from: "noreply@promptshot.ru",
  replyTo: "support_ru@promptshot.ru",
};

test("send body is one To address and never uses a proxy host", () => {
  const body = JSON.parse(
    buildPostboxSendEmailBody(config, "user@example.com", {
      subject: "Тема",
      text: "Текст",
      html: "<p>Текст</p>",
      headers: [],
    }),
  );
  assert.deepEqual(body.Destination.ToAddresses, ["user@example.com"]);
  assert.equal(body.FromEmailAddress, "noreply@promptshot.ru");
  assert.deepEqual(body.ReplyToAddresses, ["support_ru@promptshot.ru"]);
});

test("sendPostboxEmail posts SESv2 to Postbox and maps retryable errors", async () => {
  const calls: Array<{ url: URL | RequestInfo; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ MessageId: "msg-1" }), { status: 200 });
  };
  const ok = await sendPostboxEmail(
    config,
    "user@example.com",
    { subject: "Тема", text: "Текст", html: "<p>Текст</p>", headers: [] },
    fetchImpl,
  );
  assert.deepEqual(ok, { ok: true, messageId: "msg-1" });
  assert.equal(String(calls[0]?.url), "https://postbox.cloud.yandex.net/v2/email/outbound-emails");
  assert.equal(calls[0]?.init?.method, "POST");

  const fail = await sendPostboxEmail(
    config,
    "user@example.com",
    { subject: "Тема", text: "Текст", html: "<p>Текст</p>", headers: [] },
    async () => new Response("busy", { status: 429 }),
  );
  assert.equal(fail.ok, false);
  if (!fail.ok) {
    assert.equal(fail.retryable, true);
    assert.equal(fail.code, "http_429");
  }
});
