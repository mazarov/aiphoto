import assert from "node:assert/strict";
import test from "node:test";
import { planLabel, renderMailTemplate } from "./mail-templates";

test("plan labels match PromptShot packages", () => {
  assert.equal(planLabel("trial"), "Пробный");
  assert.equal(planLabel("start"), "Оптимальный");
  assert.equal(planLabel("pro"), "Большой");
  assert.equal(planLabel("max"), "Максимум");
});

test("transactional templates do not add List-Unsubscribe", () => {
  const mail = renderMailTemplate(
    "tokens_credited",
    { display_name: "Максим", plan_id: "start", credits: 100 },
    "user@example.com",
  );
  assert.equal(mail.subject, "Токены PromptShot зачислены");
  assert.match(mail.text, /пакет «Оптимальный»/);
  assert.match(mail.text, /100/);
  assert.match(mail.text, /generaciya-foto/);
  assert.deepEqual(mail.headers, []);
});

test("welcome names the free daily analyzes", () => {
  const mail = renderMailTemplate("welcome", { display_name: "Максим" }, "user@example.com");
  assert.match(mail.text, /10 разборов/);
  assert.match(mail.text, /Пробный/);
  assert.deepEqual(mail.headers, []);
});

test("campaign templates add one-click unsubscribe headers when secret exists", () => {
  const prev = process.env.MAIL_UNSUBSCRIBE_SECRET;
  process.env.MAIL_UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
  try {
    const mail = renderMailTemplate(
      "campaign",
      { subject: "Новости", body_text: "Текст кампании", display_name: "Максим" },
      "user@example.com",
    );
    assert.equal(mail.subject, "Новости");
    assert.match(mail.text, /Текст кампании/);
    assert.match(mail.text, /\/unsubscribe\?t=/);
    assert.equal(mail.headers[0]?.Name, "List-Unsubscribe");
    assert.match(mail.headers[0]?.Value || "", /\/api\/mail\/unsubscribe\?t=/);
    assert.equal(mail.headers[1]?.Value, "List-Unsubscribe=One-Click");
  } finally {
    process.env.MAIL_UNSUBSCRIBE_SECRET = prev;
  }
});
