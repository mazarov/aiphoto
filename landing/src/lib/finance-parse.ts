import { inflateRawSync } from "node:zlib";
import type { GeminiFamilyId } from "./finance-types";

export type { GeminiFamilyId } from "./finance-types";
export { GEMINI_FAMILY_LABELS } from "./finance-types";

export const FINANCE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FINANCE_MAX_ROWS = 20_000;

export class FinanceParseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FinanceParseError";
    this.code = code;
  }
}

export type FinanceKind = "revenue" | "cogs";

export type RevenueLine = {
  provider_payment_id: string;
  paid_at: string | null;
  amount_gross: number;
  amount_net: number;
  commission: number;
  vat_on_commission: number;
  currency: string;
  payment_type: string | null;
  description: string | null;
};

export type CogsLine = {
  usage_date: string;
  sku_id: string;
  sku_description: string;
  usage_amount: number;
  subtotal_usd: number;
};

export type ParsedRevenueImport = {
  kind: "revenue";
  lines: RevenueLine[];
  totals: {
    gross: number;
    net: number;
    commission: number;
    vat: number;
    count: number;
    currency: string;
  };
};

export type ParsedCogsImport = {
  kind: "cogs";
  lines: CogsLine[];
  totals: { subtotalUsd: number; count: number };
};

const PAYMENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GCP_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;

export function parseFinanceKind(raw: string | null | undefined): FinanceKind | null {
  const value = (raw || "").trim().toLowerCase();
  return value === "revenue" || value === "cogs" ? value : null;
}

export function parseFinancePeriod(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

export function parseUsdRubRate(raw: string | null | undefined): number | null | undefined {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const value = parseFinanceNumber(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > 1000) return undefined;
  return value;
}

export function parseFinanceNumber(raw: string | null | undefined): number {
  const value = (raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\s|\u00a0/g, "");
  if (!value) return Number.NaN;
  if (/^-?\d{1,3}(,\d{3})+$/.test(value)) return Number(value.replace(/,/g, ""));
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(value)) {
    return Number(value.replace(/\./g, "").replace(",", "."));
  }
  if (value.includes(",") && !value.includes(".")) return Number(value.replace(",", "."));
  if (value.includes(",") && value.includes(".")) return Number(value.replace(/,/g, ""));
  return Number(value);
}

export function classifyGeminiFamily(skuDescription: string): GeminiFamilyId {
  const text = skuDescription.toLowerCase();
  if (text.includes("3.1 flash image") || text.includes("gemini 3.1 flash image")) {
    return "gemini-3.1-flash-image";
  }
  if (
    text.includes("3 pro image")
    || text.includes("gemini 3 pro image")
    || (text.includes("3 pro") && text.includes("image"))
  ) {
    return "gemini-3-pro-image";
  }
  if (
    text.includes("2.5 flash")
    && (text.includes("native image") || text.includes("image output") || text.includes("image input"))
  ) {
    return "gemini-2.5-flash-image";
  }
  if (text.includes("flash lite")) return "gemini-2.5-flash-lite";
  if (text.includes("3 pro")) return "gemini-3-pro-text";
  if (text.includes("2.5 flash")) return "gemini-2.5-flash-text";
  return "other";
}

export function decodeFinanceText(buffer: Uint8Array): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3));
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (looksLikeFinanceCsv(utf8)) return utf8;
  const cp1251 = decodeWindows1251(buffer);
  return looksLikeFinanceCsv(cp1251) ? cp1251 : utf8;
}

function looksLikeFinanceCsv(text: string): boolean {
  return /Идентификатор платежа|Date,Service description|Сумма платежа/i.test(text);
}

function decodeWindows1251(buffer: Uint8Array): string {
  try {
    return new TextDecoder("windows-1251").decode(buffer);
  } catch {
    let out = "";
    for (const byte of buffer) {
      if (byte < 0x80) out += String.fromCharCode(byte);
      else if (byte === 0xa8) out += "Ё";
      else if (byte === 0xb8) out += "ё";
      else if (byte >= 0xc0) out += String.fromCharCode(0x410 + (byte - 0xc0));
      else out += String.fromCharCode(byte);
    }
    return out;
  }
}

export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function splitLines(text: string): string[] {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/);
}

function isZipBuffer(buffer: Uint8Array): boolean {
  return buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);
}

type ZipEntry = { name: string; data: Buffer };

function findEocdOffset(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 22 - 65535);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD) return offset;
  }
  throw new FinanceParseError("zip_invalid", "Некорректный ZIP-архив");
}

export function extractZipEntries(input: Uint8Array): ZipEntry[] {
  const buffer = Buffer.from(input);
  const eocd = findEocdOffset(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const cdSize = buffer.readUInt32LE(eocd + 12);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new FinanceParseError("zip_unsupported", "ZIP64 не поддерживается");
  }
  const entries: ZipEntry[] = [];
  let cursor = cdOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL) {
      throw new FinanceParseError("zip_invalid", "Некорректный ZIP-архив");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = (flags & 0x800)
      ? nameBytes.toString("utf8")
      : decodeWindows1251(nameBytes);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    if (flags & 0x1) {
      throw new FinanceParseError("zip_unsupported", "Зашифрованный ZIP не поддерживается");
    }
    if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL) {
      throw new FinanceParseError("zip_invalid", "Некорректный ZIP-архив");
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data: Buffer;
    if (compression === 0) data = Buffer.from(compressed);
    else if (compression === 8) data = inflateRawSync(compressed);
    else {
      throw new FinanceParseError("zip_unsupported", `Метод сжатия ZIP ${compression} не поддерживается`);
    }
    if (uncompressedSize && data.length !== uncompressedSize) {
      throw new FinanceParseError("zip_invalid", "Размер файла в ZIP не совпал");
    }
    entries.push({ name, data });
  }
  return entries;
}

function pickYookassaCsv(entries: ZipEntry[]): Buffer {
  const files = entries.filter((entry) => entry.data.length > 0);
  const csv = files.find((entry) => /\.csv$/i.test(entry.name));
  if (csv) return csv.data;
  const spreadsheet = files.find((entry) => /\.xlsx?$/i.test(entry.name));
  if (spreadsheet) {
    throw new FinanceParseError(
      "yookassa_csv_required",
      "В архиве только Excel. Выгрузите реестр ЮKassa в CSV.",
    );
  }
  throw new FinanceParseError("yookassa_csv_missing", "В архиве нет CSV реестра ЮKassa.");
}

function parseYookassaDate(raw: string): string | null {
  const value = raw.trim();
  const match = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}T${match[4] || "00"}:${match[5] || "00"}:${match[6] || "00"}+03:00`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

function headerIndex(headers: string[], predicate: (name: string) => boolean): number {
  return headers.findIndex((name) => predicate(name.toLowerCase().replace(/\s+/g, " ")));
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] || "").trim() : "";
}

function isSummaryLine(line: string): boolean {
  const trimmed = line.trim();
  return /^(сумма принятых|сумма возвратов|число платежей|число возвратов|кому:|по договору)/i.test(trimmed);
}

export function parseYookassaRevenueCsv(text: string): ParsedRevenueImport {
  const lines = splitLines(text);
  const byId = new Map<string, RevenueLine>();
  let seenHeader = false;
  let headers: string[] | null = null;
  let idIdx = -1;
  let grossIdx = -1;
  let netIdx = -1;
  let commissionIdx = -1;
  let vatIdx = -1;
  let timeIdx = -1;
  let typeIdx = -1;
  let currencyIdx = -1;
  let descriptionIdx = -1;

  const bindHeaders = (row: string[]) => {
    const normalized = row.map((name) => name.trim());
    if (!normalized.some((name) => /идентификатор платежа/i.test(name))) return false;
    headers = normalized;
    seenHeader = true;
    idIdx = headerIndex(normalized, (name) => name.includes("идентификатор платежа"));
    grossIdx = headerIndex(normalized, (name) => name === "сумма платежа" || name.startsWith("сумма платежа"));
    netIdx = headerIndex(normalized, (name) => name.includes("вычетом комиссии"));
    commissionIdx = headerIndex(normalized, (name) => name.includes("сумма комиссии"));
    vatIdx = headerIndex(normalized, (name) => name.includes("ндс с комиссии") || name === "ндс с комиссии");
    timeIdx = headerIndex(normalized, (name) => name.includes("время платежа"));
    typeIdx = headerIndex(normalized, (name) => name.includes("тип платежа"));
    currencyIdx = headerIndex(normalized, (name) => name.includes("валюта платежа"));
    descriptionIdx = headerIndex(normalized, (name) => name === "описание");
    return idIdx >= 0;
  };

  for (const line of lines) {
    if (!line.trim()) {
      if (headers && byId.size > 0) continue;
      continue;
    }
    if (isSummaryLine(line)) {
      headers = null;
      continue;
    }
    const delimiter = line.includes(";") ? ";" : ",";
    const row = parseDelimitedLine(line, delimiter);
    if (!headers) {
      bindHeaders(row);
      continue;
    }
    const paymentId = cell(row, idIdx);
    if (!PAYMENT_ID_RE.test(paymentId)) {
      if (row.some((value) => /идентификатор платежа/i.test(value))) bindHeaders(row);
      continue;
    }
    if (byId.has(paymentId)) {
      throw new FinanceParseError(
        "yookassa_duplicate_payment",
        `Дублируется идентификатор платежа ${paymentId}`,
      );
    }
    const gross = parseFinanceNumber(cell(row, grossIdx));
    const netRaw = parseFinanceNumber(cell(row, netIdx));
    const commissionRaw = parseFinanceNumber(cell(row, commissionIdx));
    const vat = Number.isFinite(parseFinanceNumber(cell(row, vatIdx)))
      ? parseFinanceNumber(cell(row, vatIdx))
      : 0;
    if (!Number.isFinite(gross)) {
      throw new FinanceParseError("yookassa_invalid_amount", `Нет суммы платежа у ${paymentId}`);
    }
    const commission = Number.isFinite(commissionRaw) ? commissionRaw : 0;
    const net = Number.isFinite(netRaw) ? netRaw : roundMoney(gross - commission - (Number.isFinite(vat) ? vat : 0));
    byId.set(paymentId, {
      provider_payment_id: paymentId,
      paid_at: parseYookassaDate(cell(row, timeIdx)),
      amount_gross: roundMoney(gross),
      amount_net: roundMoney(net),
      commission: roundMoney(commission),
      vat_on_commission: roundMoney(Number.isFinite(vat) ? vat : 0),
      currency: (cell(row, currencyIdx) || "RUB").toUpperCase(),
      payment_type: cell(row, typeIdx) || null,
      description: clipText(cell(row, descriptionIdx), 240),
    });
    if (byId.size > FINANCE_MAX_ROWS) {
      throw new FinanceParseError("too_many_rows", `Больше ${FINANCE_MAX_ROWS} строк в реестре`);
    }
  }

  if (!seenHeader) {
    throw new FinanceParseError("yookassa_header_missing", "Не найдена шапка реестра ЮKassa");
  }

  const parsed = [...byId.values()];
  const currency = parsed[0]?.currency || "RUB";
  return {
    kind: "revenue",
    lines: parsed,
    totals: {
      gross: roundMoney(parsed.reduce((sum, line) => sum + line.amount_gross, 0)),
      net: roundMoney(parsed.reduce((sum, line) => sum + line.amount_net, 0)),
      commission: roundMoney(parsed.reduce((sum, line) => sum + line.commission, 0)),
      vat: roundMoney(parsed.reduce((sum, line) => sum + line.vat_on_commission, 0)),
      count: parsed.length,
      currency,
    },
  };
}

export function parseGcpCogsCsv(text: string): ParsedCogsImport {
  const lines = splitLines(text).filter((line) => line.trim());
  if (!lines.length) {
    throw new FinanceParseError("gcp_header_missing", "Пустой отчёт Google Cloud Billing");
  }
  const header = parseDelimitedLine(lines[0], ",");
  const dateIdx = header.findIndex((name) => /^date$/i.test(name));
  const skuIdIdx = header.findIndex((name) => /^sku id$/i.test(name));
  const skuIdx = header.findIndex((name) => /^sku description$/i.test(name));
  const usageIdx = header.findIndex((name) => /^usage amount$/i.test(name));
  const subtotalIdx = header.findIndex((name) => /subtotal \(\$\)$/i.test(name));
  if (dateIdx < 0 || skuIdIdx < 0 || skuIdx < 0 || subtotalIdx < 0) {
    throw new FinanceParseError("gcp_header_missing", "Нет колонок Date / SKU / Subtotal ($) в Billing CSV");
  }

  const merged = new Map<string, CogsLine>();
  for (const line of lines.slice(1)) {
    const row = parseDelimitedLine(line, ",");
    const usageDate = cell(row, dateIdx);
    if (!GCP_DATE_RE.test(usageDate)) continue;
    const skuId = cell(row, skuIdIdx) || "unknown";
    const skuDescription = cell(row, skuIdx) || skuId;
    const usageAmount = parseFinanceNumber(cell(row, usageIdx));
    const subtotalUsd = parseFinanceNumber(cell(row, subtotalIdx));
    if (!Number.isFinite(subtotalUsd)) continue;
    const key = `${usageDate}|${skuId}`;
    const current = merged.get(key);
    if (current) {
      current.usage_amount += Number.isFinite(usageAmount) ? usageAmount : 0;
      current.subtotal_usd = roundUsd(current.subtotal_usd + subtotalUsd);
    } else {
      merged.set(key, {
        usage_date: usageDate,
        sku_id: skuId,
        sku_description: skuDescription,
        usage_amount: Number.isFinite(usageAmount) ? usageAmount : 0,
        subtotal_usd: roundUsd(subtotalUsd),
      });
    }
    if (merged.size > FINANCE_MAX_ROWS) {
      throw new FinanceParseError("too_many_rows", `Больше ${FINANCE_MAX_ROWS} строк в Billing CSV`);
    }
  }

  const parsed = [...merged.values()].sort((left, right) => {
    if (left.usage_date === right.usage_date) return left.sku_id.localeCompare(right.sku_id);
    return left.usage_date.localeCompare(right.usage_date);
  });
  return {
    kind: "cogs",
    lines: parsed,
    totals: {
      subtotalUsd: roundUsd(parsed.reduce((sum, line) => sum + line.subtotal_usd, 0)),
      count: parsed.length,
    },
  };
}

export function parseFinanceUpload(kind: FinanceKind, filename: string, bytes: Uint8Array): ParsedRevenueImport | ParsedCogsImport {
  if (bytes.length === 0) {
    throw new FinanceParseError("empty_file", "Файл пустой");
  }
  if (bytes.length > FINANCE_MAX_FILE_BYTES) {
    throw new FinanceParseError("file_too_large", "Файл больше 10 MB");
  }
  const lower = filename.toLowerCase();
  if (kind === "revenue") {
    const csvBytes = isZipBuffer(bytes) || lower.endsWith(".zip")
      ? pickYookassaCsv(extractZipEntries(bytes))
      : Buffer.from(bytes);
    return parseYookassaRevenueCsv(decodeFinanceText(csvBytes));
  }
  if (isZipBuffer(bytes) || lower.endsWith(".zip")) {
    throw new FinanceParseError("gcp_csv_required", "Для затрат нужен CSV Google Cloud Billing, не ZIP");
  }
  return parseGcpCogsCsv(decodeFinanceText(bytes));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clipText(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
