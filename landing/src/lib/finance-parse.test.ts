import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGeminiFamily,
  extractZipEntries,
  parseDelimitedLine,
  parseFinanceKind,
  parseFinanceNumber,
  parseFinancePeriod,
  parseFinanceUpload,
  parseGcpCogsCsv,
  parseUsdRubRate,
  parseYookassaRevenueCsv,
  FinanceParseError,
} from "./finance-parse";

const YOOKASSA = `РЕЕСТР ПЛАТЕЖЕЙ ПО ДОГОВОРУ НЭК.11322.23 (152368)
Дата платежей: 2022-12-15
Идентификатор платежа;Сумма платежа;Валюта платежа;Сумма за вычетом комиссии и НДС;Сумма комиссии без НДС;Время платежа;Идентификатор платежного средства;Описание;Тип платежа;Имя плательщика;Адрес плательщика;ИНН плательщика;НДС с комиссии
276a9776-000f-5000-a000-179a4d5c6bad;2.00;RUB;1.91;0.07;15.12.2022 12:37:07;41001860899377;Заказ №72;AC;Иван;Москва;7700000000;0,02
21b212e1-0016-50fb-9000-07aebf184c41;8.00;RUB;7.66;0.28;15.12.2022 15:43:01;41001860899377;Заказ №73;PC;;;0,06

Сумма принятых платежей: 10.00 RUB
Сумма принятых платежей за вычетом комиссии и НДС: 9.57 RUB
Число платежей: 2
`;

const GCP = `Date,Service description,Service ID,SKU description,SKU ID,Usage amount,Usage unit,List cost ($),Negotiated savings ($),Savings programs ($),Other savings ($),Unrounded subtotal ($),Subtotal ($)
2026-08-15,Gemini API,AEFD-7695-64FA,Generate_content image output token count for Gemini 2.5 Flash Native Image Generation,2A8D-CD62-0E04,"260,580",count,7.82,0.00,0.00,0.00,7.817400,7.82
2026-08-15,Gemini API,AEFD-7695-64FA,Generate content output token count gemini 2.5 flash short input text,911A-8880-A243,"622,403",count,1.56,0.00,0.00,0.00,1.555990,1.56
2026-08-14,Gemini API,AEFD-7695-64FA,Generate_content image output token count for Gemini 3 Pro Image,096D-0370-0236,"5,600",count,0.67,0.00,0.00,0.00,0.672000,0.67
`;

function crc32(data: Buffer): number {
  let crc = ~0;
  for (let index = 0; index < data.length; index += 1) {
    crc ^= data[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function createStoredZip(name: string, content: Buffer): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const crc = crc32(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  const localSize = 30 + nameBuf.length + content.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + nameBuf.length, 12);
  eocd.writeUInt32LE(localSize, 16);
  return Buffer.concat([local, nameBuf, content, central, nameBuf, eocd]);
}

test("finance period kind and rate reject unsupported values", () => {
  assert.equal(parseFinancePeriod("2026-08"), "2026-08-01");
  assert.equal(parseFinancePeriod("2026-13"), null);
  assert.equal(parseFinancePeriod("08-2026"), null);
  assert.equal(parseFinanceKind("REVENUE"), "revenue");
  assert.equal(parseFinanceKind("spend"), null);
  assert.equal(parseUsdRubRate(""), null);
  assert.equal(parseUsdRubRate("92.5"), 92.5);
  assert.equal(parseUsdRubRate("0"), undefined);
  assert.equal(parseUsdRubRate("abc"), undefined);
});

test("finance numbers distinguish thousands from decimals", () => {
  assert.equal(parseFinanceNumber('"260,580"'), 260580);
  assert.equal(parseFinanceNumber("7.82"), 7.82);
  assert.equal(parseFinanceNumber("0,02"), 0.02);
  assert.deepEqual(parseDelimitedLine('a,"b,c",d', ","), ["a", "b,c", "d"]);
});

test("yookassa parser skips title footer and payer PII", () => {
  const parsed = parseYookassaRevenueCsv(YOOKASSA);
  assert.equal(parsed.totals.count, 2);
  assert.equal(parsed.totals.gross, 10);
  assert.equal(parsed.totals.net, 9.57);
  assert.equal(parsed.totals.commission, 0.35);
  assert.equal(parsed.totals.vat, 0.08);
  assert.equal(parsed.lines[0].provider_payment_id, "276a9776-000f-5000-a000-179a4d5c6bad");
  assert.equal(parsed.lines[0].payment_type, "AC");
  assert.equal(parsed.lines[0].description, "Заказ №72");
  assert.ok(parsed.lines.every((line) => !JSON.stringify(line).includes("7700000000")));
  assert.ok(parsed.lines.every((line) => !JSON.stringify(line).includes("41001860899377")));
});

test("empty yookassa registry with header is valid", () => {
  const parsed = parseYookassaRevenueCsv(
    "Идентификатор платежа;Сумма платежа\nСумма принятых платежей: 0.00 RUB\n",
  );
  assert.equal(parsed.totals.count, 0);
});

test("duplicate yookassa payment id fails closed", () => {
  const header = "Идентификатор платежа;Сумма платежа;Сумма за вычетом комиссии и НДС";
  const row = "276a9776-000f-5000-a000-179a4d5c6bad;2.00;1.91";
  assert.throws(
    () => parseYookassaRevenueCsv(`${header}\n${row}\n${row}\n`),
    (error: unknown) => error instanceof FinanceParseError && error.code === "yookassa_duplicate_payment",
  );
});

test("gcp billing parser uses Subtotal and quoted usage", () => {
  const parsed = parseGcpCogsCsv(GCP);
  assert.equal(parsed.totals.count, 3);
  assert.equal(parsed.totals.subtotalUsd, 10.05);
  assert.equal(parsed.lines[0].usage_amount, 260580);
  assert.equal(classifyGeminiFamily(parsed.lines[0].sku_description), "gemini-2.5-flash-image");
  assert.equal(classifyGeminiFamily(parsed.lines[1].sku_description), "gemini-2.5-flash-text");
  assert.equal(classifyGeminiFamily(parsed.lines[2].sku_description), "gemini-3-pro-image");
});

test("zip extract finds csv and parseFinanceUpload accepts yookassa zip", () => {
  const zip = createStoredZip("payments.csv", Buffer.from(YOOKASSA, "utf8"));
  const entries = extractZipEntries(zip);
  assert.equal(entries[0].name, "payments.csv");
  const parsed = parseFinanceUpload("revenue", "registry.zip", zip);
  assert.equal(parsed.kind, "revenue");
  assert.equal(parsed.totals.count, 2);
});

test("xlsx-only zip asks for csv", () => {
  const zip = createStoredZip("report.xlsx", Buffer.from("not-csv"));
  assert.throws(
    () => parseFinanceUpload("revenue", "report.zip", zip),
    (error: unknown) => error instanceof FinanceParseError && error.code === "yookassa_csv_required",
  );
});
