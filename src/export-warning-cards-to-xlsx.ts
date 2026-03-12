import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import { parseDataset, type ParsedCard } from "./lib/prompt-export-parser";

function parseArgs() {
  const args = process.argv.slice(2);
  let dataset = "";
  let warning = "photo_prompt_count_mismatch";
  let outDir = path.resolve(process.cwd(), "export", "xlxs_parsed");
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--dataset") dataset = args[i + 1] ?? "";
    if (args[i] === "--warning") warning = args[i + 1] ?? warning;
    if (args[i] === "--out-dir") outDir = path.resolve(process.cwd(), args[i + 1] ?? outDir);
  }
  if (!dataset) throw new Error("Missing --dataset");
  return { dataset, warning, outDir };
}

function toRow(card: ParsedCard) {
  return {
    dataset_slug: card.datasetSlug,
    source_message_id: card.sourceMessageId,
    card_split_index: card.cardSplitIndex,
    card_split_total: card.cardSplitTotal,
    split_strategy: card.cardSplitStrategy,
    source_date: card.sourcePublishedAt,
    title: card.titleNormalized,
    photo_count: card.photoCount,
    prompt_count: card.promptCount,
    warnings: JSON.stringify(card.parseWarnings),
    media_indexes: card.media.map((m) => m.mediaIndex).join(", "),
    variant_indexes: card.variants.map((v) => v.variantIndex).join(", "),
    prompt_labels_ru: card.variants.map((v) => v.labelRaw ?? "").join(" | "),
    prompt_texts_ru: card.variants
      .map((v, idx) => `${v.labelRaw ? `${v.labelRaw}: ` : `Промпт ${idx + 1}: `}${v.promptTextRu}`)
      .join("\n\n"),
    mapping_strategy: card.variants[0]?.matchStrategy ?? "",
  };
}

async function main() {
  const { dataset, warning, outDir } = parseArgs();
  const parsed = await parseDataset(dataset);
  const filtered = parsed.cards.filter((c) => c.parseWarnings.includes(warning));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map(toRow)), "warnings");

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${dataset}-${warning}.xlsx`);
  XLSX.writeFile(wb, outPath);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ dataset, warning, totalCards: parsed.cards.length, matched: filtered.length, outPath }, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

