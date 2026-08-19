import { moneyRub, moscowDayKey } from "./finance-pnl";
import type {
  FinanceAcquisitionCohortRow,
  FinanceAcquisitionDeliveryRow,
  FinanceDataQuality,
} from "./finance-types";

export type AcquisitionPayment = {
  provider: string | null | undefined;
  status: string | null | undefined;
  creditedAt: string | null | undefined;
  test?: boolean | null;
  amountRub: number | string | null | undefined;
};

export function safeRatio(
  numerator: number | string | null | undefined,
  denominator: number | string | null | undefined,
): number | null {
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;
  return top / bottom;
}

export function computeCtr(
  clicks: number | string | null | undefined,
  impressions: number | string | null | undefined,
): number | null {
  return safeRatio(clicks, impressions);
}

export function computeCpc(
  spendRub: number | string | null | undefined,
  clicks: number | string | null | undefined,
): number | null {
  const value = safeRatio(spendRub, clicks);
  return value == null ? null : moneyRub(value);
}

export function computeActivationRate(
  ahaVisitors: number | string | null | undefined,
  visitors: number | string | null | undefined,
): number | null {
  return safeRatio(ahaVisitors, visitors);
}

export function computeSignupRate(
  signupUsers: number | string | null | undefined,
  visitors: number | string | null | undefined,
): number | null {
  return safeRatio(signupUsers, visitors);
}

export function computePayerConversion(
  firstPayers: number | string | null | undefined,
  visitors: number | string | null | undefined,
): number | null {
  return safeRatio(firstPayers, visitors);
}

export function computeCpaAha(
  spendRub: number | string | null | undefined,
  ahaVisitors: number | string | null | undefined,
): number | null {
  const value = safeRatio(spendRub, ahaVisitors);
  return value == null ? null : moneyRub(value);
}

export function computeCac(
  spendRub: number | string | null | undefined,
  firstPayers: number | string | null | undefined,
): number | null {
  const value = safeRatio(spendRub, firstPayers);
  return value == null ? null : moneyRub(value);
}

export function computeGrossRoas(
  cumulativeRevenue: number | string | null | undefined,
  spendRub: number | string | null | undefined,
): number | null {
  return safeRatio(cumulativeRevenue, spendRub);
}

export function computeGrossRomi(
  cumulativeRevenue: number | string | null | undefined,
  spendRub: number | string | null | undefined,
): number | null {
  const revenue = Number(cumulativeRevenue);
  const spend = Number(spendRub);
  if (!Number.isFinite(revenue) || !Number.isFinite(spend) || spend === 0) return null;
  return (revenue - spend) / spend;
}

export function computeLtv(
  cumulativeRevenue: number | string | null | undefined,
  firstPayers: number | string | null | undefined,
): number | null {
  const value = safeRatio(cumulativeRevenue, firstPayers);
  return value == null ? null : moneyRub(value);
}

export function computeContributionMarginRate(input: {
  grossRub: number | string | null | undefined;
  netIncomeRub: number | string | null | undefined;
}): number | null {
  const rate = safeRatio(input.netIncomeRub, input.grossRub);
  if (rate == null) return null;
  return Math.max(0, Math.min(1, rate));
}

export function computeContributionLtv(
  grossLtv: number | string | null | undefined,
  contributionMarginRate: number | string | null | undefined,
): number | null {
  const ltv = Number(grossLtv);
  const rate = Number(contributionMarginRate);
  if (!Number.isFinite(ltv) || !Number.isFinite(rate) || ltv < 0 || rate < 0) {
    return null;
  }
  return moneyRub(ltv * Math.min(1, rate));
}

export function computeCacMax(
  contributionLtv: number | string | null | undefined,
  safetyFactor = 1,
): number | null {
  const ltv = Number(contributionLtv);
  const factor = Number(safetyFactor);
  if (
    !Number.isFinite(ltv) ||
    !Number.isFinite(factor) ||
    ltv < 0 ||
    factor < 0 ||
    factor > 1
  ) {
    return null;
  }
  return moneyRub(ltv * factor);
}

export function addCalendarDays(ymd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export function calendarDayDiff(fromYmd: string, toYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) return null;
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

export function asMoscowDay(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return moscowDayKey(typeof value === "string" ? value : value.toISOString());
}

export function cohortWindowMaturity(
  cohortDate: string,
  asOf: Date | string = new Date(),
): { d0: boolean; d7: boolean; d30: boolean } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cohortDate)) {
    return { d0: false, d7: false, d30: false };
  }
  const asOfDay = asMoscowDay(asOf);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDay)) {
    return { d0: false, d7: false, d30: false };
  }
  return {
    d0: asOfDay >= cohortDate,
    d7: asOfDay >= addCalendarDays(cohortDate, 7),
    d30: asOfDay >= addCalendarDays(cohortDate, 30),
  };
}

export function revenueWindowDay(
  cohortDate: string,
  creditedAt: string | null | undefined,
): number | null {
  if (!creditedAt) return null;
  return calendarDayDiff(cohortDate, asMoscowDay(creditedAt));
}

export function isRevenueInWindow(
  cohortDate: string,
  creditedAt: string | null | undefined,
  windowDays: number,
): boolean {
  const day = revenueWindowDay(cohortDate, creditedAt);
  return day != null && day >= 0 && day <= windowDays;
}

export function isNumericCampaignId(value: string | null | undefined): boolean {
  return /^\d+$/.test((value || "").trim());
}

/** Join spend only by numeric utm_campaign. yclid is never a campaign id. */
export function campaignIdForSpendJoin(input: {
  utmCampaign?: string | null;
  yclid?: string | null;
}): string | null {
  const campaign = (input.utmCampaign || "").trim();
  return isNumericCampaignId(campaign) ? campaign : null;
}

export function normalizeAcquisitionSource(raw: string | null | undefined): string | null {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "ya" || value === "yandex") return "yandex";
  return value;
}

export function isLiveAcquisitionPayment(payment: AcquisitionPayment): boolean {
  const provider = (payment.provider || "").trim().toLowerCase();
  if (provider === "stars" || provider === "telegram" || provider === "telegram_stars") return false;
  if (payment.test === true) return false;
  if ((payment.status || "").trim().toLowerCase() !== "succeeded") return false;
  if (!payment.creditedAt) return false;
  return provider === "yookassa" || provider === "yoo_kassa" || provider === "robokassa";
}

export function sumLiveGrossRevenue(payments: AcquisitionPayment[]): number {
  return moneyRub(
    payments
      .filter(isLiveAcquisitionPayment)
      .reduce((sum, payment) => sum + Number(payment.amountRub || 0), 0),
  );
}

export function buildAcquisitionQuality(input: {
  directVisits?: number | null;
  directVisitsWithYclid?: number | null;
  directVisitsWithNumericCampaign?: number | null;
  funnelFacts?: number | null;
  funnelFactsWithVisitor?: number | null;
  oauthUsers?: number | null;
  oauthUsersWithVisitorLink?: number | null;
  livePayments?: number | null;
  livePaymentsWithSnapshot?: number | null;
  guestOwnerFactsInUniqueUsers?: number | null;
  livePurchases?: number | null;
  mpSent?: number | null;
  mpError?: number | null;
  duplicateVisitorCount?: number | null;
  duplicateSessionCount?: number | null;
  duplicateLandingViewCount?: number | null;
  unmatchedSpendCampaigns?: string[] | null;
  timeToFirstAhaHours?: number | null;
}): FinanceDataQuality {
  return {
    directVisitsWithYclidRate: safeRatio(input.directVisitsWithYclid, input.directVisits),
    directVisitsWithNumericCampaignRate: safeRatio(
      input.directVisitsWithNumericCampaign,
      input.directVisits,
    ),
    funnelFactsWithVisitorRate: safeRatio(input.funnelFactsWithVisitor, input.funnelFacts),
    oauthUsersWithVisitorLinkRate: safeRatio(input.oauthUsersWithVisitorLink, input.oauthUsers),
    livePaymentsWithSnapshotRate: safeRatio(input.livePaymentsWithSnapshot, input.livePayments),
    guestOwnerFactsInUniqueUsers: nullableNumber(input.guestOwnerFactsInUniqueUsers),
    livePurchases: nullableNumber(input.livePurchases),
    mpSent: nullableNumber(input.mpSent),
    mpError: nullableNumber(input.mpError),
    duplicateVisitorCount: nullableNumber(input.duplicateVisitorCount),
    duplicateSessionCount: nullableNumber(input.duplicateSessionCount),
    duplicateLandingViewCount: nullableNumber(input.duplicateLandingViewCount),
    unmatchedSpendCampaigns: input.unmatchedSpendCampaigns ?? [],
    timeToFirstAhaHours: nullableNumber(input.timeToFirstAhaHours),
  };
}

export function deriveAcquisitionMetrics(input: {
  cohortDate: string;
  source?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adId?: string | null;
  landingPath?: string | null;
  visitors?: number | string | null;
  ahaVisitors?: number | string | null;
  signupUsers?: number | string | null;
  firstPayers?: number | string | null;
  firstPayments?: number | string | null;
  repeatPayments?: number | string | null;
  spendRub?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  revenueD0?: number | string | null;
  revenueD7?: number | string | null;
  revenueD30?: number | string | null;
  retainedD1?: number | string | null;
  retainedD7?: number | string | null;
  asOf?: Date | string;
}): FinanceAcquisitionCohortRow {
  const visitors = wholeNumber(input.visitors);
  const ahaVisitors = wholeNumber(input.ahaVisitors);
  const signupUsers = wholeNumber(input.signupUsers);
  const firstPayers = wholeNumber(input.firstPayers);
  const spendRub = moneyRub(input.spendRub);
  const impressions = wholeNumber(input.impressions);
  const clicks = wholeNumber(input.clicks);
  const revenueD0 = moneyRub(input.revenueD0);
  const revenueD7 = moneyRub(input.revenueD7);
  const revenueD30 = moneyRub(input.revenueD30);
  return {
    cohortDate: input.cohortDate,
    source: normalizeAcquisitionSource(input.source),
    campaignId: input.campaignId || null,
    campaignName: input.campaignName || null,
    adId: input.adId || null,
    landingPath: input.landingPath || null,
    visitors,
    ahaVisitors,
    signupUsers,
    firstPayers,
    firstPayments: wholeNumber(input.firstPayments),
    repeatPayments: wholeNumber(input.repeatPayments),
    spendRub,
    impressions,
    clicks,
    revenueD0,
    revenueD7,
    revenueD30,
    ctr: computeCtr(clicks, impressions),
    cpc: computeCpc(spendRub, clicks),
    activationRate: computeActivationRate(ahaVisitors, visitors),
    signupRate: computeSignupRate(signupUsers, visitors),
    payerConversion: computePayerConversion(firstPayers, visitors),
    cpaAha: computeCpaAha(spendRub, ahaVisitors),
    cac: computeCac(spendRub, firstPayers),
    grossRoasD0: computeGrossRoas(revenueD0, spendRub),
    grossRoasD7: computeGrossRoas(revenueD7, spendRub),
    grossRoasD30: computeGrossRoas(revenueD30, spendRub),
    grossRomiD0: computeGrossRomi(revenueD0, spendRub),
    grossRomiD7: computeGrossRomi(revenueD7, spendRub),
    grossRomiD30: computeGrossRomi(revenueD30, spendRub),
    ltvD0: computeLtv(revenueD0, firstPayers),
    ltvD7: computeLtv(revenueD7, firstPayers),
    ltvD30: computeLtv(revenueD30, firstPayers),
    retainedD1: nullableNumber(input.retainedD1),
    retainedD7: nullableNumber(input.retainedD7),
    maturity: cohortWindowMaturity(input.cohortDate, input.asOf),
  };
}

export function deriveDeliveryMetrics(input: {
  day: string;
  spendRub?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  payments?: number | string | null;
  revenueRub?: number | string | null;
}): FinanceAcquisitionDeliveryRow {
  const spendRub = moneyRub(input.spendRub);
  const impressions = wholeNumber(input.impressions);
  const clicks = wholeNumber(input.clicks);
  return {
    day: input.day,
    spendRub,
    impressions,
    clicks,
    ctr: computeCtr(clicks, impressions),
    cpc: computeCpc(spendRub, clicks),
    payments: input.payments == null || input.payments === "" ? null : wholeNumber(input.payments),
    revenueRub: input.revenueRub == null || input.revenueRub === "" ? null : moneyRub(input.revenueRub),
  };
}

export function mapAcquisitionRpcPayload(
  raw: unknown,
  asOf?: Date | string,
): {
  delivery: FinanceAcquisitionDeliveryRow[];
  cohorts: FinanceAcquisitionCohortRow[];
  quality: FinanceDataQuality | null;
} {
  const split = splitAcquisitionRpc(raw);
  return {
    delivery: split.delivery
      .map(mapDeliveryRecord)
      .filter((row): row is FinanceAcquisitionDeliveryRow => row != null),
    cohorts: split.cohorts
      .map((row) => mapCohortRecord(row, asOf))
      .filter((row): row is FinanceAcquisitionCohortRow => row != null),
    quality: split.quality ? mapQualityRecord(split.quality) : null,
  };
}

function splitAcquisitionRpc(raw: unknown): {
  delivery: Record<string, unknown>[];
  cohorts: Record<string, unknown>[];
  quality: Record<string, unknown> | null;
} {
  if (raw == null) return { delivery: [], cohorts: [], quality: null };
  if (Array.isArray(raw)) {
    if (
      raw.length === 1
      && raw[0]
      && typeof raw[0] === "object"
      && ("cohorts" in raw[0] || "delivery" in raw[0] || "data_quality" in raw[0] || "quality" in raw[0])
    ) {
      return splitAcquisitionRpc(raw[0]);
    }
    const delivery: Record<string, unknown>[] = [];
    const cohorts: Record<string, unknown>[] = [];
    let quality: Record<string, unknown> | null = null;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const kind = String(row.row_type || row.report_kind || row.kind || "").toLowerCase();
      if (kind === "quality" || kind === "data_quality") quality = row;
      else if (kind === "delivery") delivery.push(row);
      else if (row.cohort_date || row.cohortDate || row.first_seen_date) cohorts.push(row);
      else if (row.spend_date || row.day || row.delivery_date) delivery.push(row);
      else cohorts.push(row);
    }
    return { delivery, cohorts, quality };
  }
  if (typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    const economics = asRecordArray(
      row.campaign_economics || row.campaignEconomics,
    );
    return {
      delivery: asRecordArray(row.delivery || row.delivery_rows),
      // Spend is campaign-grain. Prefer economics rows so a campaign's spend is
      // not repeated for every landing-path row when calculating CAC/ROAS.
      cohorts: economics.length
        ? economics
        : asRecordArray(row.cohorts || row.cohort_rows || row.rows),
      quality: asRecord(row.quality || row.data_quality || row.dataQuality),
    };
  }
  return { delivery: [], cohorts: [], quality: null };
}

function mapDeliveryRecord(row: Record<string, unknown>): FinanceAcquisitionDeliveryRow | null {
  const day = String(row.day || row.spend_date || row.delivery_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return deriveDeliveryMetrics({
    day,
    spendRub: pickNumber(row, ["spend_rub", "spendRub", "cost_rub", "costRub"]),
    impressions: pickNumber(row, ["impressions"]),
    clicks: pickNumber(row, ["clicks"]),
    payments: pickNumber(row, ["payments", "live_payments", "payment_count"]),
    revenueRub: pickNumber(row, ["gross_revenue_rub", "revenue_rub", "revenueRub", "gross_revenue", "gross_rub"]),
  });
}

function mapCohortRecord(
  row: Record<string, unknown>,
  asOf?: Date | string,
): FinanceAcquisitionCohortRow | null {
  const cohortDate = String(row.cohort_date || row.cohortDate || row.first_seen_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cohortDate)) return null;
  return deriveAcquisitionMetrics({
    cohortDate,
    source: pickString(row, ["source", "utm_source", "normalized_source"]),
    campaignId: pickString(row, ["campaign_id", "campaignId", "utm_campaign"]),
    campaignName: pickString(row, ["campaign_name", "campaignName"]),
    adId: pickString(row, ["ad_id", "adId"]),
    landingPath: pickString(row, ["landing_path", "landingPath", "utm_landing_path"]),
    visitors: pickNumber(row, ["visitors"]),
    ahaVisitors: pickNumber(row, ["aha_visitors", "ahaVisitors", "aha"]),
    signupUsers: pickNumber(row, ["signup_users", "signupUsers", "signups"]),
    firstPayers: pickNumber(row, ["first_payers", "firstPayers"]),
    firstPayments: pickNumber(row, ["first_payments", "firstPayments"]),
    repeatPayments: pickNumber(row, ["repeat_payments", "repeatPayments"]),
    spendRub: pickNumber(row, ["spend_rub", "spendRub", "cost_rub"]),
    impressions: pickNumber(row, ["impressions"]),
    clicks: pickNumber(row, ["clicks"]),
    revenueD0: pickNumber(row, ["revenue_d0", "revenueD0", "cumulative_revenue_d0"]),
    revenueD7: pickNumber(row, ["revenue_d7", "revenueD7", "cumulative_revenue_d7"]),
    revenueD30: pickNumber(row, ["revenue_d30", "revenueD30", "cumulative_revenue_d30"]),
    retainedD1: pickNumber(row, ["d1_retained", "retained_d1", "retainedD1", "d1_repeat_aha"]),
    retainedD7: pickNumber(row, ["d7_retained", "retained_d7", "retainedD7", "d7_repeat_aha"]),
    asOf,
  });
}

function mapQualityRecord(row: Record<string, unknown>): FinanceDataQuality {
  const rates = {
    directVisitsWithYclidRate: pickNumber(row, [
      "direct_yclid_rate",
      "direct_visits_with_yclid_rate",
      "directVisitsWithYclidRate",
    ]),
    directVisitsWithNumericCampaignRate: pickNumber(row, [
      "direct_numeric_campaign_rate",
      "direct_visits_with_numeric_campaign_rate",
      "directVisitsWithNumericCampaignRate",
    ]),
    funnelFactsWithVisitorRate: pickNumber(row, [
      "funnel_visitor_rate",
      "funnel_facts_with_visitor_rate",
      "funnelFactsWithVisitorRate",
    ]),
    oauthUsersWithVisitorLinkRate: pickNumber(row, [
      "oauth_visitor_link_rate",
      "oauth_users_with_visitor_link_rate",
      "oauthUsersWithVisitorLinkRate",
    ]),
    livePaymentsWithSnapshotRate: pickNumber(row, [
      "live_payment_snapshot_rate",
      "live_payments_with_snapshot_rate",
      "livePaymentsWithSnapshotRate",
    ]),
  };
  const built = buildAcquisitionQuality({
    directVisits: pickNumber(row, ["direct_visits", "directVisits"]),
    directVisitsWithYclid: pickNumber(row, ["direct_visits_with_yclid", "directVisitsWithYclid"]),
    directVisitsWithNumericCampaign: pickNumber(row, [
      "direct_visits_with_numeric_campaign",
      "directVisitsWithNumericCampaign",
    ]),
    funnelFacts: pickNumber(row, ["funnel_facts", "funnelFacts"]),
    funnelFactsWithVisitor: pickNumber(row, ["funnel_facts_with_visitor", "funnelFactsWithVisitor"]),
    oauthUsers: pickNumber(row, ["oauth_users", "oauthUsers"]),
    oauthUsersWithVisitorLink: pickNumber(row, [
      "oauth_users_with_visitor_link",
      "oauthUsersWithVisitorLink",
    ]),
    livePayments: pickNumber(row, ["live_payments", "livePayments"]),
    livePaymentsWithSnapshot: pickNumber(row, [
      "live_payments_with_snapshot",
      "livePaymentsWithSnapshot",
    ]),
    guestOwnerFactsInUniqueUsers: pickNumber(row, [
      "guest_owner_facts",
      "guest_owner_facts_in_unique_users",
      "guestOwnerFactsInUniqueUsers",
    ]),
    livePurchases: pickNumber(row, ["live_payments", "live_purchases", "livePurchases", "promptshot_live_purchases"]),
    mpSent: pickNumber(row, ["mp_sent", "mpSent"]),
    mpError: pickNumber(row, ["mp_error", "mpError"]),
    duplicateVisitorCount: pickNumber(row, [
      "visitors_linked_to_multiple_users",
      "duplicate_visitor_count",
      "duplicateVisitorCount",
    ]),
    duplicateSessionCount: pickNumber(row, [
      "duplicate_landing_view_sessions",
      "duplicate_session_count",
      "duplicateSessionCount",
    ]),
    duplicateLandingViewCount: pickNumber(row, [
      "duplicate_landing_view_sessions",
      "duplicate_landing_view_count",
      "duplicateLandingViewCount",
    ]),
    unmatchedSpendCampaigns: pickStringArray(row, [
      "unmatched_spend_campaigns",
      "unmatchedSpendCampaigns",
    ]),
    timeToFirstAhaHours: pickNumber(row, [
      "time_to_first_aha_hours",
      "timeToFirstAhaHours",
    ]),
  });
  return {
    ...built,
    directVisitsWithYclidRate: rates.directVisitsWithYclidRate ?? built.directVisitsWithYclidRate,
    directVisitsWithNumericCampaignRate:
      rates.directVisitsWithNumericCampaignRate ?? built.directVisitsWithNumericCampaignRate,
    funnelFactsWithVisitorRate: rates.funnelFactsWithVisitorRate ?? built.funnelFactsWithVisitorRate,
    oauthUsersWithVisitorLinkRate: rates.oauthUsersWithVisitorLinkRate ?? built.oauthUsersWithVisitorLinkRate,
    livePaymentsWithSnapshotRate: rates.livePaymentsWithSnapshotRate ?? built.livePaymentsWithSnapshotRate,
  };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in row) || row[key] == null || row[key] === "") continue;
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function pickStringArray(
  row: Record<string, unknown>,
  keys: string[],
): string[] {
  for (const key of keys) {
    const value = row[key];
    if (!Array.isArray(value)) continue;
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }
  return [];
}

function wholeNumber(value: number | string | null | undefined): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function nullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}
