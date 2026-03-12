import { parseDataset } from "./lib/prompt-export-parser";

async function main() {
  const datasetSlug = process.argv[2];
  if (!datasetSlug) {
    throw new Error("Usage: tsx src/analyze-parser-warnings.ts <datasetSlug>");
  }

  const parsed = await parseDataset(datasetSlug);
  const warningCounts = new Map<string, number>();
  for (const card of parsed.cards) {
    for (const warning of card.parseWarnings) {
      warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1);
    }
  }

  const warnings = Array.from(warningCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([warning, count]) => ({ warning, count }));

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        dataset: datasetSlug,
        htmlFiles: parsed.htmlFiles,
        cards: parsed.cards.length,
        skippedNoBlockquote: parsed.skippedNoBlockquote,
        skippedNoPhoto: parsed.skippedNoPhoto,
        warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

