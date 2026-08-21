import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGeminiFamily,
  extractZipEntries,
  parseDelimitedLine,
  parseDirectAdsCsv,
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
21b212e1-0016-50fb-9000-07aebf184c41;8.00;RUB;7.66;0.28;15.12.2022 15:43:01;41001860899377;Заказ №73;PC;;;;0,06

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
  assert.equal(parseFinanceKind("ADS"), "ads");
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

test("classifyGeminiFamily maps Grok Imagine image SKUs", () => {
  assert.equal(classifyGeminiFamily("Grok Imagine Image 2.0"), "grok-imagine-image");
  assert.equal(classifyGeminiFamily("xAI Grok Imagine image output"), "grok-imagine-image");
});

test("gcp billing parser uses Subtotal and quoted usage", () => {
  const parsed = parseGcpCogsCsv(GCP);
  assert.equal(parsed.totals.count, 3);
  assert.equal(parsed.totals.subtotalUsd, 10.05);
  const byFamily = new Map(
    parsed.lines.map((line) => [classifyGeminiFamily(line.sku_description), line]),
  );
  assert.equal(byFamily.get("gemini-2.5-flash-image")?.usage_amount, 260580);
  assert.ok(byFamily.has("gemini-2.5-flash-text"));
  assert.ok(byFamily.has("gemini-3-pro-image"));
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

const DIRECT_EN = `Date,CampaignId,CampaignName,AdId,CriterionId,Impressions,Clicks,Cost,Currency
01.08.2026,100,Brand,10,77,1000,20,500.50,RUB
01.08.2026,100,Brand,10,77,200,5,100.25,RUB
02.08.2026,200,Promo,,,50,2,80,RUB
`;

const DIRECT_RU = `Дата;ID кампании;Название кампании;ID объявления;ID условия показа;Показы;Клики;Расход (руб.);Валюта
01.08.2026;100;Бренд;10;77;1000;20;500,50;RUB
03.07.2026;100;Бренд;10;77;10;1;5,00;RUB
Итого;;;;;—;1010;21;505,50;
`;

function encodeWindows1251(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 0x80) bytes.push(code);
    else if (char === "Ё") bytes.push(0xa8);
    else if (char === "ё") bytes.push(0xb8);
    else if (code >= 0x410 && code <= 0x44f) bytes.push(0xc0 + (code - 0x410));
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

test("direct parser merges duplicate grain and accepts EN headers", () => {
  const parsed = parseDirectAdsCsv(DIRECT_EN, "2026-08-01");
  assert.equal(parsed.kind, "ads");
  assert.equal(parsed.totals.count, 2);
  assert.equal(parsed.totals.costRub, 680.75);
  assert.equal(parsed.totals.clicks, 27);
  assert.equal(parsed.totals.impressions, 1250);
  assert.equal(parsed.totals.droppedOutsideMonth, 0);
  assert.equal(parsed.totals.grain, "campaign_ad_criterion_day");
  assert.equal(parsed.lines[0].campaign_id, "100");
  assert.equal(parsed.lines[0].cost_rub, 600.75);
  assert.equal(parsed.lines[0].ad_id, "10");
  assert.equal(parsed.lines[1].ad_id, null);
});

test("direct parser skips footer empty campaign and outside-month rows", () => {
  const parsed = parseDirectAdsCsv(DIRECT_RU, "2026-08-01");
  assert.equal(parsed.totals.count, 1);
  assert.equal(parsed.totals.costRub, 500.5);
  assert.equal(parsed.totals.droppedOutsideMonth, 1);
  assert.equal(parsed.lines[0].spend_date, "2026-08-01");
});

test("direct parser ignores title lines before the header", () => {
  const parsed = parseDirectAdsCsv(
    `Отчет по кампаниям\nПериод: 01.08.2026 - 31.08.2026\n${DIRECT_RU}`,
    "2026-08-01",
  );
  assert.equal(parsed.totals.count, 1);
  assert.equal(parsed.lines[0].campaign_name, "Бренд");
});

test("empty direct header-only csv is a valid replace", () => {
  const parsed = parseDirectAdsCsv("Date;CampaignId;CampaignName;Impressions;Clicks;Cost\n", "2026-08-01");
  assert.equal(parsed.totals.count, 0);
  assert.equal(parsed.totals.costRub, 0);
  assert.equal(parsed.totals.droppedOutsideMonth, 0);
});

test("direct parser skips impossible calendar dates before database import", () => {
  const parsed = parseDirectAdsCsv(
    "Date,CampaignId,Cost\n31.02.2026,100,10\n",
    "2026-02-01",
  );
  assert.equal(parsed.totals.count, 0);
});

test("direct parser reads windows-1251 russian headers", () => {
  const parsed = parseFinanceUpload("ads", "direct.csv", encodeWindows1251(DIRECT_RU), "2026-08-01");
  assert.equal(parsed.kind, "ads");
  assert.equal(parsed.totals.count, 1);
  assert.equal(parsed.totals.droppedOutsideMonth, 1);
});

test("direct parser rejects non-RUB zip and excel", () => {
  assert.throws(
    () => parseDirectAdsCsv("Date,CampaignId,Cost,Currency\n01.08.2026,100,10,USD\n"),
    (error: unknown) => error instanceof FinanceParseError && error.code === "ads_currency_not_supported",
  );
  const zip = createStoredZip("direct.csv", Buffer.from(DIRECT_EN, "utf8"));
  assert.throws(
    () => parseFinanceUpload("ads", "direct.zip", zip, "2026-08-01"),
    (error: unknown) => error instanceof FinanceParseError && error.code === "ads_csv_required",
  );
  assert.throws(
    () => parseFinanceUpload("ads", "direct.xlsx", Buffer.from(DIRECT_EN, "utf8"), "2026-08-01"),
    (error: unknown) => error instanceof FinanceParseError && error.code === "ads_csv_required",
  );
});
