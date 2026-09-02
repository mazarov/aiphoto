export type GeminiFamilyId =
  | "gemini-3.1-flash-image"
  | "gemini-3.1-flash-lite-image"
  | "gemini-3-pro-image"
  | "gemini-2.5-flash-image"
  | "gemini-2.5-flash-lite"
  | "gemini-3-pro-text"
  | "gemini-2.5-flash-text"
  | "veo-video"
  | "gemini-omni-video"
  | "grok-imagine-image"
  | "grok-imagine-video"
  | "seedream-image"
  | "flux-image"
  | "seedance-video"
  | "other";

export type FinanceCogsProvider = "google" | "xai" | "openrouter" | "other";

export const GEMINI_FAMILY_LABELS: Record<GeminiFamilyId, string> = {
  "gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
  "gemini-3.1-flash-lite-image": "Gemini 3.1 Flash Lite Image",
  "gemini-3-pro-image": "Gemini 3 Pro Image",
  "gemini-2.5-flash-image": "Gemini 2.5 Flash Image",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-3-pro-text": "Gemini 3 Pro text",
  "gemini-2.5-flash-text": "Gemini 2.5 Flash text",
  "veo-video": "Veo video",
  "gemini-omni-video": "Gemini Omni video",
  "grok-imagine-image": "Grok Imagine Image",
  "grok-imagine-video": "Grok Imagine Video",
  "seedream-image": "Seedream",
  "flux-image": "Flux",
  "seedance-video": "Seedance",
  other: "Прочее",
};

export const GEMINI_FAMILY_ORDER: GeminiFamilyId[] = [
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-lite",
  "gemini-3-pro-text",
  "gemini-2.5-flash-text",
  "veo-video",
  "gemini-omni-video",
  "grok-imagine-image",
  "grok-imagine-video",
  "seedream-image",
  "flux-image",
  "seedance-video",
  "other",
];

export const GEMINI_FAMILY_COLORS: Record<GeminiFamilyId, string> = {
  "gemini-3.1-flash-image": "#4f46e5",
  "gemini-3.1-flash-lite-image": "#65a30d",
  "gemini-3-pro-image": "#db2777",
  "gemini-2.5-flash-image": "#0d9488",
  "gemini-2.5-flash-lite": "#16a34a",
  "gemini-3-pro-text": "#d97706",
  "gemini-2.5-flash-text": "#7c3aed",
  "veo-video": "#0284c7",
  "gemini-omni-video": "#9333ea",
  "grok-imagine-image": "#111111",
  "grok-imagine-video": "#3f3f46",
  "seedream-image": "#ea580c",
  "flux-image": "#2563eb",
  "seedance-video": "#c026d3",
  other: "#71717a",
};

export const FINANCE_COGS_PROVIDER_LABELS: Record<FinanceCogsProvider, string> = {
  google: "Google",
  xai: "Grok / xAI",
  openrouter: "OpenRouter",
  other: "Прочее",
};

export type FinanceImportKind = "revenue" | "cogs" | "ads";
export type FinanceAdsVatMode = "unknown" | "included" | "excluded";
export type FinanceRevenueSource = "csv" | "live_ledger";
export type FinanceCogsSource = "csv" | "estimate";
export type FinanceAdsSource = "csv" | "direct_api";

export type FinanceImportMeta = {
  id: string;
  kind: FinanceImportKind;
  periodMonth: string;
  sourceFilename: string;
  fileSha256: string;
  uploadedByEmail: string;
  rowCount: number;
  usdRubRate: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Static admin FX until a live rate is wired. */
export const FINANCE_USD_RUB_RATE = 90;
/** УСН 6% from YooKassa gross (выручка), not from net after acquiring. */
export const FINANCE_REVENUE_TAX_RATE = 0.06;
/** Fulfillment cost: 1 generation = 5 credits = 2.5 ₽. */
export const FINANCE_CREDITS_PER_GENERATION = 5;
export const FINANCE_GENERATION_COST_RUB = 2.5;
export const FINANCE_RUB_PER_CREDIT =
  FINANCE_GENERATION_COST_RUB / FINANCE_CREDITS_PER_GENERATION;
/** YooKassa acquiring estimate when registry CSV is missing. */
export const FINANCE_YOOKASSA_FEE_RATE = 0.035;
export const FINANCE_YOOKASSA_FEE_VAT_RATE = 0.22;
/** Direct cabinet is without VAT; P&L multiplies by this. */
export const FINANCE_ADS_VAT_MULTIPLIER = 1.22;

export type FinanceCogsByProvider = Record<FinanceCogsProvider, number>;

export type FinancePnl = {
  usdRubRate: number;
  taxRate: number;
  grossRub: number | null;
  yookassaFeesRub: number | null;
  taxRub: number | null;
  spendUsd: number | null;
  spendRub: number | null;
  cogsByProviderRub: FinanceCogsByProvider;
  operatingRub: number | null;
  adsCabinetRub: number | null;
  adsWithVatRub: number | null;
  adsVatRub: number | null;
  afterAdsRub: number | null;
  netIncomeRub: number | null;
  missingCogs: boolean;
  missingAds: boolean;
  revenueSource: FinanceRevenueSource | null;
  cogsSource: FinanceCogsSource | null;
  adsSource: FinanceAdsSource | null;
};

export type FinanceDailyPoint = {
  day: string;
  revenueRub: number;
  yookassaFeesRub: number;
  taxRub: number;
  cogsByProviderRub: FinanceCogsByProvider;
  costRub: number;
  profitRub: number;
  operatingRub: number;
};

export type FinanceModelDailyPoint = {
  day: string;
  totalRub: number;
  byFamily: Partial<Record<GeminiFamilyId, number>>;
};

export type FinanceLiability = {
  creditsTotal: number;
  liabilityRubEstimate: number | null;
};

export type FinanceAdsDailyPoint = {
  day: string;
  costRub: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  cpc: number | null;
};

export type FinanceAdsBreakdownRow = {
  campaignId: string;
  campaignName: string;
  adId?: string | null;
  costRub: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  cpc: number | null;
};

export type FinanceAcquisitionDeliveryRow = {
  day: string;
  spendRub: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  payments: number | null;
  revenueRub: number | null;
};

export type FinanceAcquisitionCohortRow = {
  cohortDate: string;
  source: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adId: string | null;
  landingPath: string | null;
  visitors: number;
  ahaVisitors: number;
  signupUsers: number;
  firstPayers: number;
  firstPayments: number;
  repeatPayments: number;
  spendRub: number;
  impressions: number;
  clicks: number;
  revenueD0: number;
  revenueD7: number;
  revenueD30: number;
  ctr: number | null;
  cpc: number | null;
  activationRate: number | null;
  signupRate: number | null;
  payerConversion: number | null;
  cpaAha: number | null;
  cac: number | null;
  grossRoasD0: number | null;
  grossRoasD7: number | null;
  grossRoasD30: number | null;
  grossRomiD0: number | null;
  grossRomiD7: number | null;
  grossRomiD30: number | null;
  ltvD0: number | null;
  ltvD7: number | null;
  ltvD30: number | null;
  retainedD1: number | null;
  retainedD7: number | null;
  maturity: { d0: boolean; d7: boolean; d30: boolean };
};

export type FinanceDataQuality = {
  directVisitsWithYclidRate: number | null;
  directVisitsWithNumericCampaignRate: number | null;
  funnelFactsWithVisitorRate: number | null;
  oauthUsersWithVisitorLinkRate: number | null;
  livePaymentsWithSnapshotRate: number | null;
  guestOwnerFactsInUniqueUsers: number | null;
  livePurchases: number | null;
  mpSent: number | null;
  mpError: number | null;
  duplicateVisitorCount: number | null;
  duplicateSessionCount: number | null;
  duplicateLandingViewCount: number | null;
  unmatchedSpendCampaigns: string[];
  timeToFirstAhaHours: number | null;
};

export type FinanceAcquisitionReport = {
  delivery: FinanceAcquisitionDeliveryRow[];
  cohorts: FinanceAcquisitionCohortRow[];
  quality: FinanceDataQuality | null;
};

export type FinanceMonthData = {
  month: string;
  from: string;
  to: string;
  csvOverride: boolean;
  csvAvailable: {
    revenue: FinanceImportMeta | null;
    cogs: FinanceImportMeta | null;
    ads: FinanceImportMeta | null;
  };
  revenue: {
    import: FinanceImportMeta | null;
    source: FinanceRevenueSource;
    kpi: {
      gross: number;
      net: number;
      commission: number;
      vat: number;
      count: number;
      currency: string;
    };
    daily: { day: string; gross: number; net: number; fees: number; count: number }[];
    byType: { paymentType: string; gross: number; net: number; count: number }[];
  } | null;
  cogs: {
    import: FinanceImportMeta | null;
    source: FinanceCogsSource;
    kpi: { subtotalUsd: number; subtotalRub: number; count: number; billedUsd?: number; estimatedUsd?: number };
    daily: { day: string; subtotalUsd: number; subtotalRub: number }[];
    dailyByFamily: { day: string; family: GeminiFamilyId; subtotalUsd: number; subtotalRub: number }[];
    byFamily: { family: GeminiFamilyId; label: string; subtotalUsd: number; subtotalRub: number }[];
    bySku: {
      skuId: string;
      skuDescription: string;
      subtotalUsd: number;
      subtotalRub: number;
      usageAmount: number;
    }[];
  } | null;
  ads: {
    import: FinanceImportMeta | null;
    source: FinanceAdsSource;
    kpi: {
      costRub: number;
      clicks: number;
      impressions: number;
      count: number;
      currency: string;
      vatMode: FinanceAdsVatMode;
      droppedOutsideMonth: number;
      ctr: number | null;
      cpc: number | null;
    };
    daily: FinanceAdsDailyPoint[];
    byCampaign: FinanceAdsBreakdownRow[];
    byAd: FinanceAdsBreakdownRow[];
  } | null;
  acquisition: FinanceAcquisitionReport | null;
  daily: FinanceDailyPoint[];
  modelDaily: FinanceModelDailyPoint[];
  liability: FinanceLiability;
  pnl: FinancePnl;
};
