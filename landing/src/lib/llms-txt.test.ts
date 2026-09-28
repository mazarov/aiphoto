import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLlmsTxt,
  isLlmsTxtFormatValid,
  LLMS_TXT_MIN_CHARS,
} from "./llms-txt";

test("llms.txt matches Lighthouse Agentic Browsing format checks", () => {
  const body = buildLlmsTxt("https://promptshot.ru");
  assert.equal(isLlmsTxtFormatValid(body), true);
  assert.ok(body.length > LLMS_TXT_MIN_CHARS);
  assert.match(body, /^# PromptShot$/m);
  assert.match(body, /\[Nano Banana\]\(https:\/\/promptshot\.ru\/nano-banana\)/);
  assert.match(
    body,
    /\[Nano Banana Pro\]\(https:\/\/promptshot\.ru\/nano-banana\/pro\)/
  );
  assert.match(body, /\[Сделать фото по описанию\]\(https:\/\/promptshot\.ru\/generaciya\/foto-po-opisaniyu\)/);
  assert.match(body, /\[Сгенерировать картинку по описанию\]\(https:\/\/promptshot\.ru\/generaciya\/kartinka-po-opisaniyu\)/);
  assert.match(body, /\[Сделать фото ИИ по своему фото\]\(https:\/\/promptshot\.ru\/generaciya\/po-foto\)/);
  assert.doesNotMatch(body, /generaciya-foto/);
});

test("llms.txt format helper rejects stubs that Lighthouse would fail", () => {
  assert.equal(isLlmsTxtFormatValid(""), false);
  assert.equal(isLlmsTxtFormatValid("# Title\nshort"), false);
  assert.equal(
    isLlmsTxtFormatValid("# Title\nhttps://promptshot.ru/nano-banana ".repeat(5)),
    false
  );
});
