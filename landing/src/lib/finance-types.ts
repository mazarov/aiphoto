export type GeminiFamilyId =
  | "gemini-3.1-flash-image"
  | "gemini-3-pro-image"
  | "gemini-2.5-flash-image"
  | "gemini-2.5-flash-lite"
  | "gemini-3-pro-text"
  | "gemini-2.5-flash-text"
  | "other";

export const GEMINI_FAMILY_LABELS: Record<GeminiFamilyId, string> = {
  "gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
  "gemini-3-pro-image": "Gemini 3 Pro Image",
  "gemini-2.5-flash-image": "Gemini 2.5 Flash Image",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-3-pro-text": "Gemini 3 Pro text",
  "gemini-2.5-flash-text": "Gemini 2.5 Flash text",
  other: "Прочее",
};

export const GEMINI_FAMILY_ORDER: GeminiFamilyId[] = [
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-lite",
  "gemini-3-pro-text",
  "gemini-2.5-flash-text",
  "other",
];

export const GEMINI_FAMILY_COLORS: Record<GeminiFamilyId, string> = {
  "gemini-3.1-flash-image": "#4f46e5",
  "gemini-3-pro-image": "#db2777",
  "gemini-2.5-flash-image": "#0d9488",
  "gemini-2.5-flash-lite": "#16a34a",
  "gemini-3-pro-text": "#d97706",
  "gemini-2.5-flash-text": "#7c3aed",
  other: "#71717a",
};

export type FinanceImportMeta = {
  id: string;
  kind: "revenue" | "cogs";
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

export type FinancePnl = {
  usdRubRate: number;
  taxRate: number;
  grossRub: number | null;
  yookassaFeesRub: number | null;
  taxRub: number | null;
  spendUsd: number | null;
  spendRub: number | null;
  netIncomeRub: number | null;
  missingCogs: boolean;
};

export type FinanceDailyPoint = {
  day: string;
  revenueRub: number;
  costRub: number;
  profitRub: number;
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

export type FinanceMonthData = {
  month: string;
  revenue: {
    import: FinanceImportMeta;
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
    import: FinanceImportMeta;
    kpi: { subtotalUsd: number; subtotalRub: number; count: number };
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
  daily: FinanceDailyPoint[];
  modelDaily: FinanceModelDailyPoint[];
  liability: FinanceLiability;
  pnl: FinancePnl;
};
