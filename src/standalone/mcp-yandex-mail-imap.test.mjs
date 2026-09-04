import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSearchCriteria,
  decodeModifiedUtf7,
  decodeRfc2047,
  extractReadableBody,
  htmlToText,
  imapQuote,
  parseAddressField,
  parseContentType,
  parseExists,
  parseFetchLine,
  parseListMailbox,
  parseSearchUids,
  parseStatusCounts,
  summarizeFetchedMessage,
} from "./mcp-yandex-mail-imap.mjs";

test("imapQuote escapes quotes and backslashes", () => {
  assert.equal(imapQuote(`a"b\\c`), `"a\\"b\\\\c"`);
});

test("RFC 2047 subject decodes UTF-8 base64 and Q", () => {
  assert.equal(
    decodeRfc2047("=?UTF-8?B?0JLQvtC30LLRgNCw0YIg0YLQvtC60LXQvdC+0LI=?="),
    "Возврат токенов",
  );
  assert.equal(decodeRfc2047("=?UTF-8?Q?=D0=9F=D1=80=D0=B8=D0=B2=D0=B5=D1=82?="), "Привет");
});

test("modified UTF-7 mailbox names decode", () => {
  assert.equal(decodeModifiedUtf7("INBOX"), "INBOX");
  assert.equal(decodeModifiedUtf7("&BB4EQgQ,BEAEMAQyBDsENQQ9BD0ESwQ1-"), "Отправленные");
});

test("content-type parser keeps quoted boundary", () => {
  const ct = parseContentType(
    `multipart/alternative; boundary="----=_Part_1"; charset=UTF-8`,
  );
  assert.equal(ct.type, "multipart");
  assert.equal(ct.subtype, "alternative");
  assert.equal(ct.params.boundary, "----=_Part_1");
});

test("htmlToText strips tags and entities", () => {
  assert.equal(
    htmlToText("<p>Привет&nbsp;<b>мир</b></p>"),
    "Привет мир",
  );
});

test("extractReadableBody prefers plain over html and lists attachments", () => {
  const rfc822 = [
    "From: A <a@example.com>",
    "To: support_ru@promptshot.ru",
    "Subject: =?UTF-8?B?0YLQtdGB0YI=?=",
    "Content-Type: multipart/mixed; boundary=mix",
    "",
    "--mix",
    "Content-Type: multipart/alternative; boundary=alt",
    "",
    "--alt",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Plain body",
    "--alt",
    "Content-Type: text/html; charset=UTF-8",
    "",
    "<p>HTML body</p>",
    "--alt--",
    "--mix",
    "Content-Type: image/png; name=shot.png",
    "Content-Disposition: attachment; filename=shot.png",
    "Content-Transfer-Encoding: base64",
    "",
    "AAAA",
    "--mix--",
  ].join("\r\n");
  const extracted = extractReadableBody(rfc822);
  assert.equal(extracted.body, "Plain body");
  assert.equal(extracted.html_only, false);
  assert.equal(extracted.headers.subject, "тест");
  assert.equal(extracted.attachments[0]?.filename, "shot.png");
});

test("extractReadableBody falls back from html when no plain part", () => {
  const rfc822 = [
    "Subject: only html",
    "Content-Type: text/html; charset=UTF-8",
    "",
    "<p>Hello<br>world</p>",
  ].join("\r\n");
  const extracted = extractReadableBody(rfc822);
  assert.match(extracted.body, /Hello/);
  assert.match(extracted.body, /world/);
  assert.equal(extracted.html_only, true);
});

test("IMAP SEARCH / EXISTS / STATUS parsers", () => {
  assert.deepEqual(parseSearchUids("* SEARCH 12 15 99"), [12, 15, 99]);
  assert.deepEqual(parseSearchUids("* SEARCH"), []);
  assert.equal(parseExists("* 142 EXISTS"), 142);
  assert.deepEqual(parseStatusCounts("* STATUS INBOX (MESSAGES 10 UNSEEN 2)"), {
    messages: 10,
    unseen: 2,
  });
});

test("parseListMailbox skips noselect and decodes quoted names", () => {
  assert.equal(
    parseListMailbox(`* LIST (\\Noselect) "/" "[Gmail]"`),
    null,
  );
  const sent = parseListMailbox(`* LIST (\\HasNoChildren \\Sent) "/" "Sent"`);
  assert.equal(sent.name, "Sent");
  assert.equal(sent.sent, true);
});

test("parseFetchLine reads UID flags and literal header marker", () => {
  const line =
    `* 3 FETCH (UID 88 FLAGS (\\Seen) INTERNALDATE " 4-Sep-2026 10:53:00 +0300" BODY[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)] \u0001LIT0\u0001)`;
  const headers = [
    "From: Петряева Александра <art3meva.av@yandex.ru>",
    "Subject: Токены",
    "Date: Fri, 4 Sep 2026 10:40:00 +0300",
    "",
  ].join("\r\n");
  const fetch = parseFetchLine(line, [Buffer.from(headers, "utf8")]);
  assert.equal(fetch.uid, 88);
  assert.equal(fetch.seen, true);
  const summary = summarizeFetchedMessage(fetch);
  assert.equal(summary.from_email, "art3meva.av@yandex.ru");
  assert.equal(summary.subject, "Токены");
});

test("buildSearchCriteria quotes FROM/SUBJECT", () => {
  assert.equal(buildSearchCriteria({ unreadOnly: true }), "UNSEEN");
  assert.equal(
    buildSearchCriteria({ from: "a@b.ru", subject: "токены" }),
    `FROM "a@b.ru" SUBJECT "токены"`,
  );
});

test("parseAddressField extracts email", () => {
  assert.deepEqual(parseAddressField("Name <user@yandex.ru>"), {
    display: "Name <user@yandex.ru>",
    email: "user@yandex.ru",
  });
});
