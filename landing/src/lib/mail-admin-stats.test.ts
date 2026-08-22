import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleMailAdminDailyStats,
  bucketMailOutboxEvents,
  bucketMailOutboxStatEvent,
  loadMailAdminDailyStats,
  mailAdminStatsWindow,
  mailMoscowDay,
  parseMailAdminStatsDays,
  resolveMailAdminStatsQuery,
} from "./mail-admin-stats";

const TODAY = "2026-08-22";
const YESTERDAY = "2026-08-21";
const NOW = new Date("2026-08-22T10:00:00+03:00");

const budget = {
  day: TODAY,
  sent: 11,
  queued: 74,
  remaining: 4915,
  cap: 5000,
};

test("sent_at today wins over created_at yesterday", () => {
  const bucket = bucketMailOutboxStatEvent({
    status: "sent",
    template_id: "welcome",
    kind: "transactional",
    created_at: "2026-08-21T10:00:00+03:00",
    sent_at: "2026-08-22T00:30:00+03:00",
    updated_at: "2026-08-22T00:30:00+03:00",
  });
  assert.equal(mailMoscowDay("2026-08-21T22:00:00Z"), TODAY);
  assert.equal(bucket?.day, TODAY);
  assert.equal(bucket?.status, "sent");
});

test("queued stays off past days and today sent matches budget", () => {
  const rows = bucketMailOutboxEvents([
    {
      status: "sent",
      template_id: "welcome",
      kind: "transactional",
      created_at: `${YESTERDAY}T10:00:00+03:00`,
      sent_at: `${TODAY}T00:30:00+03:00`,
    },
    ...Array.from({ length: 7 }, () => ({
      status: "sent" as const,
      template_id: "welcome",
      kind: "transactional",
      sent_at: `${TODAY}T09:00:00+03:00`,
    })),
    ...Array.from({ length: 3 }, () => ({
      status: "sent" as const,
      template_id: "onboard_d1",
      kind: "marketing",
      sent_at: `${TODAY}T11:00:00+03:00`,
    })),
    {
      status: "pending",
      template_id: "campaign",
      kind: "marketing",
      created_at: `${TODAY}T08:00:00+03:00`,
    },
    {
      status: "sent",
      template_id: "welcome",
      kind: "transactional",
      created_at: `${YESTERDAY}T09:00:00+03:00`,
      sent_at: `${YESTERDAY}T12:00:00+03:00`,
    },
  ]);
  const stats = assembleMailAdminDailyStats({
    from: YESTERDAY,
    to: TODAY,
    today: TODAY,
    rows,
    budget,
  });
  assert.equal(stats.days[0]?.day, TODAY);
  assert.equal(stats.days[0]?.sent, budget.sent);
  assert.equal(stats.days[0]?.queued, 74);
  assert.equal(stats.days[0]?.remaining, 4915);
  assert.deepEqual(
    stats.days[0]?.by_template.map((row) => [row.template_id, row.sent]),
    [
      ["welcome", 8],
      ["onboard_d1", 3],
    ],
  );
  assert.equal(stats.days[1]?.day, YESTERDAY);
  assert.equal(stats.days[1]?.sent, 1);
  assert.equal(stats.days[1]?.queued, 0);
  assert.equal(stats.days[1]?.remaining, null);
});

test("days over 30 or non-admin are rejected before RPC", () => {
  assert.deepEqual(parseMailAdminStatsDays("31"), { ok: false, error: "invalid_days" });
  assert.deepEqual(parseMailAdminStatsDays(null), { ok: true, days: 14 });
  assert.deepEqual(
    resolveMailAdminStatsQuery({
      admin: { ok: false, status: 401, error: "unauthorized" },
      daysParam: "14",
    }),
    { ok: false, status: 401, error: "unauthorized" },
  );
  assert.deepEqual(
    resolveMailAdminStatsQuery({
      admin: { ok: false, status: 403, error: "forbidden" },
      daysParam: "14",
    }),
    { ok: false, status: 403, error: "forbidden" },
  );
  assert.deepEqual(
    resolveMailAdminStatsQuery({ admin: { ok: true }, daysParam: "31" }),
    { ok: false, status: 400, error: "invalid_days" },
  );
});

test("loader keeps today sent aligned with daily budget", async () => {
  const window = mailAdminStatsWindow(14, NOW);
  assert.equal(window.to, TODAY);
  assert.equal(window.from, "2026-08-09");
  const calls: string[] = [];
  const stats = await loadMailAdminDailyStats({
    days: 14,
    now: NOW,
    rpc: async (fn, args) => {
      calls.push(fn);
      if (fn === "landing_mail_admin_daily_stats") {
        assert.deepEqual(args, { p_from: window.from, p_to: window.to });
        return {
          data: [
            { day: TODAY, template_id: "welcome", kind: "transactional", status: "sent", n: 8 },
            { day: TODAY, template_id: "onboard_d1", kind: "marketing", status: "sent", n: 3 },
          ],
          error: null,
        };
      }
      if (fn === "landing_mail_daily_budget") {
        return { data: budget, error: null };
      }
      return { data: null, error: { message: `missing ${fn}` } };
    },
  });
  assert.deepEqual(calls, ["landing_mail_admin_daily_stats", "landing_mail_daily_budget"]);
  assert.equal(stats.days[0]?.sent, budget.sent);
  assert.equal(stats.days[0]?.queued, budget.queued);
  assert.equal(stats.days[1]?.queued, 0);
  assert.equal(stats.days.length, 14);
});
