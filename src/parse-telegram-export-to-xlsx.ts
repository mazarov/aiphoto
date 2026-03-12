import path from "node:path";
import XLSX from "xlsx";
import { parseDataset, type ParsedCard } from "./lib/prompt-export-parser";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { dataset?: string; out?: string } = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--dataset") out.dataset = args[i + 1];
    if (token === "--out") out.out = args[i + 1];
  }
  if (!out.dataset) {
    throw new Error("Missing --dataset. Example: --dataset lexy_15.02.26");
  }
  return {
    datasetSlug: out.dataset,
    outputPath:
      out.out ??
      path.resolve(process.cwd(), "docs", "export", "parsed", `${out.dataset}-parsed.xlsx`),
  };
}


function toCardRow(card: ParsedCard) {
  const promptTextsRu = card.variants
    .map((v, idx) => {
      const label = v.labelRaw ? `${v.labelRaw}: ` : `Промпт ${idx + 1}: `;
      return `${label}${v.promptTextRu}`;
    })
    .join("\n\n");

  const promptTextsEn = card.variants
    .map((v, idx) => {
      const label = v.labelRaw ? `${v.labelRaw}: ` : `Prompt ${idx + 1}: `;
      return `${label}${v.promptTextEn ?? ""}`.trim();
    })
    .join("\n\n");

  return {
    dataset_slug: card.datasetSlug,
    source_message_id: card.sourceMessageId,
    card_split_index: card.cardSplitIndex,
    card_split_total: card.cardSplitTotal,
    split_strategy: card.cardSplitStrategy,
    source_date: card.sourcePublishedAt,
    title_raw: card.titleRaw ?? "",
    title_normalized: card.titleNormalized,
    photo_count: card.photoCount,
    prompt_count: card.promptCount,
    mapping_strategy: card.variants[0]?.matchStrategy ?? "",
    media_indexes: JSON.stringify(card.media.map((m) => m.mediaIndex)),
    variant_indexes: JSON.stringify(card.variants.map((v) => v.variantIndex)),
    prompt_labels_ru: JSON.stringify(card.variants.map((v) => v.labelRaw)),
    prompt_texts_ru: promptTextsRu,
    prompt_texts_en: promptTextsEn,
    hashtags: JSON.stringify(card.hashtags),
    parse_status: card.parseStatus,
    parse_warnings: JSON.stringify(card.parseWarnings),
  };
}

function toLinkRows(card: ParsedCard) {
  return card.variantMediaLinks.map((l) => ({
    dataset_slug: card.datasetSlug,
    source_message_id: card.sourceMessageId,
    variant_index: l.variantIndex,
    media_index: l.mediaIndex,
  }));
}

async function main() {
  const { datasetSlug, outputPath } = parseArgs();
  const parsed = await parseDataset(datasetSlug);
  const cards = parsed.cards;

  const cardRows = cards.map(toCardRow);
  const linkRows = cards.flatMap(toLinkRows);
  const workbook = XLSX.utils.book_new();
  const cardsSheet = XLSX.utils.json_to_sheet(cardRows);
  const linksSheet = XLSX.utils.json_to_sheet(linkRows);
  XLSX.utils.book_append_sheet(workbook, cardsSheet, "cards");
  XLSX.utils.book_append_sheet(workbook, linksSheet, "variant_media");

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbook, outputPath);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        datasetSlug,
        htmlFiles: parsed.htmlFiles,
        cards: cards.length,
        skippedNoBlockquote: parsed.skippedNoBlockquote,
        skippedNoPhoto: parsed.skippedNoPhoto,
        outputPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
