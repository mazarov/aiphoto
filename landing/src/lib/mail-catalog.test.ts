import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateMailDue,
  listMailCatalog,
  listMailCatalogPreviews,
} from "./mail-catalog";

const baseFacts = {
  sharedUserId: "user-1",
  displayName: "Максим",
  hasGeneration: false,
  lastGenerationAt: null,
  hasAnalyze: false,
  hasYookassaRow: false,
  hasCredited: false,
  credits: 0,
  hasCreditBlock: false,
  latestUncreditedPlanId: null,
  marketingSentToday: false,
  winbackSentToday: 0,
  lastCreditsEmptyAt: null,
  npsAfter2Sent: false,
  npsEmptySent: false,
};

test("catalog lists every product letter once", () => {
  const ids = listMailCatalog().map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("welcome"));
  assert.ok(ids.includes("yk_abandon_5m"));
  assert.ok(ids.includes("yk_abandon_40m"));
  assert.ok(ids.includes("low_balance_upgrade"));
  assert.ok(ids.includes("winback_30"));
  assert.ok(ids.includes("nps_after_2"));
  assert.ok(ids.includes("nps_credits_empty"));
});

test("previews render from the same templates", () => {
  const welcome = listMailCatalogPreviews().find((row) => row.id === "welcome");
  assert.ok(welcome);
  assert.match(welcome.text, /10 разборов/);
  assert.equal(welcome.discountPercent, 0);
  const nps = listMailCatalogPreviews().find((row) => row.id === "nps_after_2");
  assert.ok(nps);
  assert.equal(nps.kind, "transactional");
  assert.match(nps.text, /1 — /);
});

test("no_credits is not a zero-balance letter", () => {
  const zero = evaluateMailDue("no_credits", baseFacts);
  assert.deepEqual(zero, { action: "skip", reason: "no_credits_stop" });
  const blocked = evaluateMailDue("no_credits", { ...baseFacts, hasCreditBlock: true });
  assert.equal(blocked.action, "send");
});

test("yk_abandon_5m sends 25 percent unless already credited", () => {
  const ready = evaluateMailDue("yk_abandon_5m", baseFacts);
  assert.equal(ready.action, "send");
  if (ready.action === "send") assert.equal(ready.discountPercent, 25);
  const paid = evaluateMailDue("yk_abandon_5m", { ...baseFacts, hasCredited: true });
  assert.deepEqual(paid, { action: "skip", reason: "credited" });
});

test("payment row stops onboard", () => {
  const skipped = evaluateMailDue("onboard_d7", { ...baseFacts, hasYookassaRow: true });
  assert.equal(skipped.action, "skip");
});

test("low-balance upgrade does not mint another grant", () => {
  const decision = evaluateMailDue("low_balance_upgrade", {
    ...baseFacts,
    hasCredited: true,
    credits: 10,
  });
  assert.equal(decision.action, "send");
  if (decision.action === "send") {
    assert.equal(decision.discountPercent, 20);
  }
});

test("credits_empty waits 14 days between sends", () => {
  const now = Date.parse("2026-08-22T12:00:00.000Z");
  const recent = evaluateMailDue(
    "credits_empty",
    {
      ...baseFacts,
      hasCredited: true,
      credits: 0,
      lastGenerationAt: "2026-08-20T12:00:00.000Z",
      lastCreditsEmptyAt: "2026-08-15T12:00:00.000Z",
    },
    now,
  );
  assert.equal(recent.action, "skip");
  const ready = evaluateMailDue(
    "credits_empty",
    {
      ...baseFacts,
      hasCredited: true,
      credits: 0,
      lastGenerationAt: "2026-08-20T12:00:00.000Z",
      lastCreditsEmptyAt: "2026-07-01T12:00:00.000Z",
    },
    now,
  );
  assert.equal(ready.action, "send");
});

test("nps after 2 sends once", () => {
  const ready = evaluateMailDue("nps_after_2", baseFacts);
  assert.equal(ready.action, "send");
  if (ready.action === "send") assert.equal(ready.kind, "transactional");
  const sent = evaluateMailDue("nps_after_2", { ...baseFacts, npsAfter2Sent: true });
  assert.deepEqual(sent, { action: "skip", reason: "nps_already_sent" });
});

test("nps empty waits for after_2 and skips a refill", () => {
  const waiting = evaluateMailDue("nps_credits_empty", baseFacts);
  assert.deepEqual(waiting, { action: "skip", reason: "nps_empty_wait_after_2" });
  const refilled = evaluateMailDue("nps_credits_empty", {
    ...baseFacts,
    npsAfter2Sent: true,
    credits: 12,
  });
  assert.deepEqual(refilled, { action: "skip", reason: "nps_empty_refilled" });
  const ready = evaluateMailDue("nps_credits_empty", {
    ...baseFacts,
    npsAfter2Sent: true,
    credits: 0,
  });
  assert.equal(ready.action, "send");
});
