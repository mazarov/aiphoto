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
    daily: { day: string; gross: number; net: number; count: number }[];
    byType: { paymentType: string; gross: number; net: number; count: number }[];
  } | null;
  cogs: {
    import: FinanceImportMeta;
    kpi: { subtotalUsd: number; count: number };
    daily: { day: string; subtotalUsd: number }[];
    byFamily: { family: GeminiFamilyId; label: string; subtotalUsd: number }[];
    bySku: { skuId: string; skuDescription: string; subtotalUsd: number; usageAmount: number }[];
  } | null;
  usdRubRate: number | null;
  spendRubEstimate: number | null;
  marginRubEstimate: number | null;
};
