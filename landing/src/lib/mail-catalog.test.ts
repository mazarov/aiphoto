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
};

test("catalog lists every product letter once", () => {
  const ids = listMailCatalog().map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("welcome"));
  assert.ok(ids.includes("yk_abandon_5m"));
  assert.ok(ids.includes("yk_abandon_40m"));
  assert.ok(ids.includes("winback_30"));
});

test("previews render from the same templates", () => {
  const welcome = listMailCatalogPreviews().find((row) => row.id === "welcome");
  assert.ok(welcome);
  assert.match(welcome.text, /10 разборов/);
  assert.equal(welcome.discountPercent, 0);
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
