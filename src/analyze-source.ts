/**
 * Analyze a new Telegram export to help write a SourceProfile.
 *
 * Usage: npx tsx src/analyze-source.ts <dataset-slug>
 *
 * Inspects the HTML and reports:
 * - Channel name
 * - Total messages, photos, blockquotes, pre tags
 * - Sample posts with their structure
 * - Recommended profile settings
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { findSourceProfile } from "./lib/source-profiles";

const datasetSlug = process.argv[2];
if (!datasetSlug) {
  console.error("Usage: npx tsx src/analyze-source.ts <dataset-slug>");
  process.exit(1);
}

const existing = findSourceProfile(datasetSlug);
if (existing) {
  console.log(`✅ Profile already exists: "${existing.displayName}" (prefix: ${existing.slugPrefix})`);
  console.log(`   promptContainer: ${existing.promptContainerSelector}`);
  console.log(`   minPromptLength: ${existing.minPromptLength}`);
  console.log(`   groupingStrategy: ${existing.groupingStrategy}`);
  console.log("");
}

const root = path.resolve(process.cwd(), "docs", "export");
const datasetDir = path.resolve(root, datasetSlug);

async function main() {
  const entries = await fs.readdir(datasetDir).catch(() => {
    console.error(`Directory not found: ${datasetDir}`);
    process.exit(1);
    return [] as string[];
  });

  const htmlFiles = entries.filter((name) => /^messages(\d+)?\.html$/.test(name));
  if (htmlFiles.length === 0) {
    console.error(`No messages*.html found in ${datasetDir}`);
    process.exit(1);
  }

  let channelTitle = "";
  let totalMessages = 0;
  let totalPhotos = 0;
  let totalBlockquotes = 0;
  let totalPre = 0;
  let totalService = 0;
  let totalJoined = 0;
  let totalDefault = 0;

  const blockquoteLengths: number[] = [];
  const preLengths: number[] = [];

  interface SamplePost {
    msgId: string;
    hasPhoto: boolean;
    hasBlockquote: boolean;
    hasPre: boolean;
    isJoined: boolean;
    promptLengths: number[];
    textPreview: string;
  }
  const samples: SamplePost[] = [];

  for (const htmlFile of htmlFiles) {
    const html = await fs.readFile(path.join(datasetDir, htmlFile), "utf-8");
    const $ = cheerio.load(html);

    const header = $(".page_header .text.bold").first().text().trim();
    if (header && !channelTitle) channelTitle = header;

    $(".history > .message").each((_i, el) => {
      totalMessages++;
      const classes = ($(el).attr("class") ?? "").trim();
      const isService = classes.includes("service");
      const isJoined = classes.includes("joined");

      if (isService) { totalService++; return; }
      if (isJoined) totalJoined++;
      else totalDefault++;

      const msgHtml = $.html(el);
      const $m = cheerio.load(`<div>${msgHtml}</div>`);

      const photos = $m("a.photo_wrap").length;
      totalPhotos += photos;

      const bqLens: number[] = [];
      $m("blockquote").each((_j, bq) => {
        totalBlockquotes++;
        const len = $m(bq).text().trim().length;
        blockquoteLengths.push(len);
        bqLens.push(len);
      });

      const preLens: number[] = [];
      $m("pre").each((_j, pre) => {
        totalPre++;
        const len = $m(pre).text().trim().length;
        preLengths.push(len);
        preLens.push(len);
      });

      if (samples.length < 15 && (photos > 0 || bqLens.length > 0 || preLens.length > 0)) {
        const textPreview = $m(".text").first().text().trim().slice(0, 100);
        samples.push({
          msgId: $(el).attr("id") ?? "?",
          hasPhoto: photos > 0,
          hasBlockquote: bqLens.length > 0,
          hasPre: preLens.length > 0,
          isJoined,
          promptLengths: [...bqLens, ...preLens],
          textPreview,
        });
      }
    });
  }

  console.log("═══════════════════════════════════════════════════");
  console.log(`Source Analysis: ${datasetSlug}`);
  console.log("═══════════════════════════════════════════════════");
  console.log(`Channel:        ${channelTitle || "(unknown)"}`);
  console.log(`HTML files:     ${htmlFiles.length}`);
  console.log(`Total messages: ${totalMessages}`);
  console.log(`  service:      ${totalService}`);
  console.log(`  default:      ${totalDefault}`);
  console.log(`  joined:       ${totalJoined}`);
  console.log(`Total photos:   ${totalPhotos}`);
  console.log(`Total <blockquote>: ${totalBlockquotes}`);
  console.log(`Total <pre>:        ${totalPre}`);

  console.log("\n─── Prompt container lengths ───");
  if (blockquoteLengths.length > 0) {
    blockquoteLengths.sort((a, b) => a - b);
    console.log(`<blockquote> (${blockquoteLengths.length}):`);
    console.log(`  min=${blockquoteLengths[0]} max=${blockquoteLengths[blockquoteLengths.length - 1]} median=${blockquoteLengths[Math.floor(blockquoteLengths.length / 2)]}`);
    const short = blockquoteLengths.filter((l) => l < 80);
    if (short.length > 0) {
      console.log(`  ⚠️  ${short.length} blockquotes shorter than 80 chars: [${short.slice(0, 10).join(", ")}${short.length > 10 ? "..." : ""}]`);
    }
  }
  if (preLengths.length > 0) {
    preLengths.sort((a, b) => a - b);
    console.log(`<pre> (${preLengths.length}):`);
    console.log(`  min=${preLengths[0]} max=${preLengths[preLengths.length - 1]} median=${preLengths[Math.floor(preLengths.length / 2)]}`);
    const short = preLengths.filter((l) => l < 80);
    if (short.length > 0) {
      console.log(`  ⚠️  ${short.length} pre tags shorter than 80 chars: [${short.slice(0, 10).join(", ")}${short.length > 10 ? "..." : ""}]`);
    }
  }

  console.log("\n─── Sample posts ───");
  for (const s of samples) {
    const flags = [
      s.hasPhoto ? "📷" : "",
      s.hasBlockquote ? "BQ" : "",
      s.hasPre ? "PRE" : "",
      s.isJoined ? "joined" : "default",
    ].filter(Boolean).join(" ");
    console.log(`  ${s.msgId} [${flags}] lens=[${s.promptLengths.join(",")}] "${s.textPreview.slice(0, 60)}..."`);
  }

  console.log("\n─── Recommendation ───");
  const usesPre = totalPre > 0;
  const usesBq = totalBlockquotes > 0;
  const allLengths = [...blockquoteLengths, ...preLengths].sort((a, b) => a - b);
  const suggestedMinLen = allLengths.length > 0 ? Math.max(20, allLengths[Math.floor(allLengths.length * 0.05)] - 10) : 80;

  const selector = usesBq && usesPre ? '"blockquote, pre"' : usesPre ? '"pre"' : '"blockquote"';
  console.log(`  promptContainerSelector: ${selector}`);
  console.log(`  minPromptLength: ${suggestedMinLen} (5th percentile - 10)`);
  console.log(`  groupingStrategy: "self-contained-split" (check manually if text-only prompts follow photo-only msgs)`);

  if (!existing) {
    console.log(`\n⚠️  No SourceProfile found for "${datasetSlug}".`);
    console.log(`Add one to src/lib/source-profiles.ts before running ingest.`);
    console.log(`\nSuggested profile:\n`);
    console.log(`  {`);
    console.log(`    slugPrefix: "${datasetSlug.split("_")[0]}",`);
    console.log(`    displayName: "${channelTitle || datasetSlug}",`);
    console.log(`    promptContainerSelector: ${selector},`);
    console.log(`    minPromptLength: ${suggestedMinLen},`);
    console.log(`    groupingStrategy: "self-contained-split",`);
    console.log(`  },`);
  }
}

main();
