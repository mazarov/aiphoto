import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

export type MediaType = "photo" | "video";
export type MatchStrategy = "direct_index" | "label_based" | "fallback_all" | "fallback_tail";
export type CardSplitStrategy = "single_card" | "split_one_to_one" | "split_even_chunks" | "split_distribute_remainder";
export type ParseStatus = "parsed" | "parsed_with_warnings" | "failed";

export interface PromptVariant {
  variantIndex: number;
  labelRaw: string | null;
  promptTextRu: string;
  promptTextEn: string | null;
  matchStrategy: MatchStrategy;
}

export interface MediaItem {
  mediaIndex: number;
  mediaType: MediaType;
  sourceRelativePath: string;
  thumbRelativePath: string | null;
  isPrimary: boolean;
}

export interface VariantMediaLink {
  variantIndex: number;
  mediaIndex: number;
}

export interface ParsedCard {
  datasetSlug: string;
  channelTitle: string;
  sourceMessageId: number;
  sourceMessageIds: number[];
  sourcePublishedAt: string;
  rawTextHtml: string;
  rawTextPlain: string;
  titleRaw: string | null;
  titleNormalized: string;
  cardSlug: string | null;
  hashtags: string[];
  parseStatus: ParseStatus;
  parseWarnings: string[];
  parserVersion: string;
  cardSplitIndex: number;
  cardSplitTotal: number;
  cardSplitStrategy: CardSplitStrategy;
  photoCount: number;
  promptCount: number;
  media: MediaItem[];
  variants: PromptVariant[];
  variantMediaLinks: VariantMediaLink[];
}

interface MessageNode {
  id: string;
  classes: string;
  html: string;
}

export interface ParseDatasetResult {
  datasetSlug: string;
  cards: ParsedCard[];
  htmlFiles: number;
  skippedNoBlockquote: number;
  skippedNoPhoto: number;
}

export const PARSER_VERSION = "v0.4.0";

// Blockquotes shorter than this are treated as decorative headers, not prompts.
// Based on data: all real prompts >= 89 chars, all decorative <= 65 chars.
const MIN_PROMPT_LENGTH = 80;

function dedupeWarnings(input: string[]): string[] {
  return Array.from(new Set(input));
}

function parseMessageId(id: string): number | null {
  const match = id.match(/^message(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
}

function normalizePlainText(input: string): string {
  return input
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTitle(input: string): string {
  const cleaned = input
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}\s\-–—:]+$/u, "")
    .trim();
  return cleaned.slice(0, 120);
}

function parseFrameLabel(rawText: string): string | null {
  const regex = /(Кадр\s*\d+|Промпт|Вариант\s*\d+|Scene\s*\d+)\s*:?\s*$/i;
  const match = rawText.match(regex);
  return match ? match[1].trim() : null;
}

function hasExplicitIndexedLabels(variants: PromptVariant[]): boolean {
  return variants.every((v) => Boolean(v.labelRaw && /\d+/.test(v.labelRaw)));
}

function hasIndexedFrameHints(text: string, variantsCount: number): boolean {
  const upper = Math.min(Math.max(variantsCount, 0), 9);
  if (upper <= 1) return false;
  for (let i = 1; i <= upper; i += 1) {
    const re = new RegExp(`(?:кадр|вариант|scene|prompt)\\s*${i}\\b`, "i");
    if (!re.test(text)) return false;
  }
  return true;
}

function splitPromptByLanguage(promptText: string): { ru: string; en: string | null } {
  const cyrillicMatches = promptText.match(/[А-Яа-яЁё]/g) || [];
  const latinMatches = promptText.match(/[A-Za-z]/g) || [];
  const cyrCount = cyrillicMatches.length;
  const latinCount = latinMatches.length;

  // English-only (or mostly-English) prompts should not pollute RU field.
  if (latinCount > 0 && cyrCount === 0) {
    return { ru: "", en: promptText };
  }
  if (latinCount > 0 && cyrCount > 0 && latinCount >= cyrCount * 2) {
    return { ru: "", en: promptText };
  }

  return { ru: promptText, en: null };
}

function mapVariantsToMedia(
  variants: PromptVariant[],
  photos: MediaItem[],
): { links: VariantMediaLink[]; warning?: string; strategy: MatchStrategy } {
  if (variants.length === 0 || photos.length === 0) {
    return { links: [], strategy: "fallback_all" };
  }
  if (variants.length === 1) {
    return {
      links: photos.map((p) => ({ variantIndex: 0, mediaIndex: p.mediaIndex })),
      strategy: "fallback_all",
    };
  }
  if (variants.length === photos.length) {
    return {
      links: variants.map((v, i) => ({ variantIndex: v.variantIndex, mediaIndex: photos[i].mediaIndex })),
      strategy: "direct_index",
    };
  }

  const labelNumbers = variants.map((v) => {
    if (!v.labelRaw) return null;
    const m = v.labelRaw.match(/(\d+)/);
    return m ? Number(m[1]) : null;
  });
  const hasLabelNumbers = labelNumbers.some((n) => n !== null);
  if (hasLabelNumbers) {
    const links: VariantMediaLink[] = [];
    for (let i = 0; i < variants.length; i += 1) {
      const labelNum = labelNumbers[i];
      const mediaIdx =
        labelNum && labelNum > 0 && labelNum <= photos.length
          ? photos[labelNum - 1].mediaIndex
          : photos[Math.min(i, photos.length - 1)].mediaIndex;
      links.push({ variantIndex: variants[i].variantIndex, mediaIndex: mediaIdx });
    }
    return { links, warning: "photo_prompt_count_mismatch", strategy: "label_based" };
  }

  const links: VariantMediaLink[] = [];
  for (let i = 0; i < variants.length; i += 1) {
    links.push({
      variantIndex: variants[i].variantIndex,
      mediaIndex: i < photos.length ? photos[i].mediaIndex : photos[photos.length - 1].mediaIndex,
    });
  }
  if (photos.length > variants.length) {
    for (let i = variants.length; i < photos.length; i += 1) {
      links.push({ variantIndex: variants[variants.length - 1].variantIndex, mediaIndex: photos[i].mediaIndex });
    }
  }
  return { links, warning: "photo_prompt_count_mismatch", strategy: "fallback_tail" };
}

function splitItemsByPromptCount<T>(items: T[], promptCount: number): T[][] {
  if (promptCount <= 0) return [];
  const chunks: T[][] = Array.from({ length: promptCount }, () => []);
  if (items.length === 0) return chunks;

  const baseSize = Math.floor(items.length / promptCount);
  const remainder = items.length % promptCount;
  let cursor = 0;
  for (let i = 0; i < promptCount; i += 1) {
    const size = baseSize + (i < remainder ? 1 : 0);
    if (size > 0) {
      chunks[i] = items.slice(cursor, cursor + size);
      cursor += size;
    }
  }

  // For photos < prompts we ensure every chunk gets at least one item by cycling.
  if (items.length < promptCount) {
    for (let i = 0; i < promptCount; i += 1) {
      if (chunks[i].length === 0) {
        chunks[i] = [items[i % items.length]];
      }
    }
  }

  return chunks;
}

function reindexMedia(media: MediaItem[]): MediaItem[] {
  return media.map((m, idx) => ({
    ...m,
    mediaIndex: idx,
    isPrimary: idx === 0 && m.mediaType === "photo",
  }));
}

async function readHtmlParts(datasetDir: string): Promise<string[]> {
  const entries = await fs.readdir(datasetDir);
  const htmls = entries.filter((name) => /^messages(\d+)?\.html$/.test(name));
  htmls.sort((a, b) => {
    if (a === "messages.html") return -1;
    if (b === "messages.html") return 1;
    const an = Number(a.match(/^messages(\d+)\.html$/)?.[1] ?? "0");
    const bn = Number(b.match(/^messages(\d+)\.html$/)?.[1] ?? "0");
    return an - bn;
  });
  return htmls.map((name) => path.join(datasetDir, name));
}

function groupMessageNodes(nodes: MessageNode[]): MessageNode[][] {
  const extractTitleSignal = (nodeHtml: string): string | null => {
    const $n = cheerio.load(`<div>${nodeHtml}</div>`);
    const strong = $n(".text strong").first().text().trim();
    if (!strong) return null;
    const normalized = normalizeTitle(strong);
    return normalized || null;
  };

  const groups: MessageNode[][] = [];
  let current: MessageNode[] = [];
  let currentTitleSignal: string | null = null;
  for (const node of nodes) {
    const isService = node.classes.includes("service");
    const isJoined = node.classes.includes("joined");
    const isDefault = node.classes.includes("default") && node.classes.includes("clearfix");
    if (isService) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
        currentTitleSignal = null;
      }
      continue;
    }
    if (isDefault && !isJoined) {
      if (current.length > 0) groups.push(current);
      current = [node];
      currentTitleSignal = extractTitleSignal(node.html);
      continue;
    }
    if (isJoined) {
      if (current.length === 0) {
        current = [node];
        currentTitleSignal = extractTitleSignal(node.html);
      } else {
        const joinedTitleSignal = extractTitleSignal(node.html);
        const shouldSplitByTitleShift =
          Boolean(currentTitleSignal) &&
          Boolean(joinedTitleSignal) &&
          currentTitleSignal !== joinedTitleSignal;

        if (shouldSplitByTitleShift) {
          groups.push(current);
          current = [node];
          currentTitleSignal = joinedTitleSignal;
        } else {
          current.push(node);
          if (!currentTitleSignal && joinedTitleSignal) {
            currentTitleSignal = joinedTitleSignal;
          }
        }
      }
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function parseGroupToCards(group: MessageNode[], datasetSlug: string, channelTitle: string): ParsedCard[] {
  const warnings: string[] = [];
  const groupHtml = group.map((g) => g.html).join("\n");
  const $g = cheerio.load(`<div id="root">${groupHtml}</div>`);

  const sourceMessageIds = group
    .map((n) => parseMessageId(n.id))
    .filter((v): v is number => v !== null);
  const sourceMessageId = sourceMessageIds[0];
  if (!sourceMessageId) return [];

  const dateAttr = $g(".pull_right.date.details").first().attr("title") ?? "";
  if (!dateAttr) warnings.push("missing_date");

  const textNodes = $g(".text").toArray();
  const rawTextHtml = textNodes.map((n) => $g(n).html() ?? "").join("\n\n").trim();
  const rawTextPlain = normalizePlainText(textNodes.map((n) => $g(n).text() ?? "").join("\n\n"));

  const firstStrong = $g(".text strong").first().text().trim() || null;
  const titleRaw = firstStrong;
  const titleNormalized = normalizeTitle(
    firstStrong ?? rawTextPlain.split("\n").find((s) => s.trim()) ?? `message-${sourceMessageId}`,
  );

  const media: MediaItem[] = [];
  $g("a.photo_wrap, a.video_file_wrap").each((idx, el) => {
    const href = $g(el).attr("href")?.trim() ?? "";
    if (!href) return;
    const thumb = $g(el).find("img").first().attr("src")?.trim() ?? null;
    media.push({
      mediaIndex: idx,
      mediaType: $g(el).hasClass("photo_wrap") ? "photo" : "video",
      sourceRelativePath: href,
      thumbRelativePath: thumb,
      isPrimary: false,
    });
  });
  const firstPhoto = media.find((m) => m.mediaType === "photo");
  if (firstPhoto) firstPhoto.isPrimary = true;

  const variants: PromptVariant[] = [];
  let variantIdx = 0;
  $g("blockquote").each((_idx, el) => {
    const promptTextRaw = normalizePlainText($g(el).text() ?? "");
    if (!promptTextRaw) return;
    if (promptTextRaw.length < MIN_PROMPT_LENGTH) return;
    const byLang = splitPromptByLanguage(promptTextRaw);
    if (!byLang.ru && !byLang.en) return;
    const label = parseFrameLabel($g(el).parent().text());
    variants.push({
      variantIndex: variantIdx,
      labelRaw: label,
      promptTextRu: byLang.ru,
      promptTextEn: byLang.en,
      matchStrategy: "direct_index",
    });
    variantIdx += 1;
  });

  const photos = media.filter((m) => m.mediaType === "photo");
  if (variants.length === 0 || photos.length === 0) return [];

  const baseCard = {
    datasetSlug,
    channelTitle,
    sourceMessageId,
    sourceMessageIds,
    sourcePublishedAt: dateAttr,
    rawTextHtml,
    rawTextPlain,
    titleRaw,
    titleNormalized,
    cardSlug: null as string | null,
    // Parsing strategy: ignore Telegram hashtags completely.
    hashtags: [],
    parserVersion: PARSER_VERSION,
  };

  // Default behavior for trivial cases: keep a single card.
  if (variants.length <= 1 || photos.length <= 1) {
    const mapped = mapVariantsToMedia(variants, photos);
    const finalWarnings = [...warnings];
    if (mapped.warning) finalWarnings.push(mapped.warning);
    if (variants.some((v) => !v.promptTextRu.trim())) {
      finalWarnings.push("missing_ru_prompt_text");
    }
    for (const v of variants) v.matchStrategy = mapped.strategy;
    return [
      {
        ...baseCard,
        parseStatus: finalWarnings.length ? "parsed_with_warnings" : "parsed",
        parseWarnings: dedupeWarnings(finalWarnings),
        cardSplitIndex: 0,
        cardSplitTotal: 1,
        cardSplitStrategy: "single_card",
        photoCount: photos.length,
        promptCount: variants.length,
        media,
        variants,
        variantMediaLinks: mapped.links,
      },
    ];
  }

  // Multi-prompt + multi-photo groups are split into sub-cards.
  const splitWarnings = [...warnings];
  const hasExplicitMarkers = hasExplicitIndexedLabels(variants) || hasIndexedFrameHints(rawTextPlain, variants.length);
  if (!hasExplicitMarkers) {
    // Multi-photo posts without explicit frame numbering are ambiguous by design.
    splitWarnings.push("ambiguous_prompt_photo_mapping");
    splitWarnings.push("split_mapping_no_explicit_markers");
  }
  if (photos.length % variants.length !== 0) {
    splitWarnings.push("split_mapping_remainder_distribution");
  }
  if (photos.length < variants.length) {
    splitWarnings.push("split_mapping_photo_reuse");
  }
  const splitStrategy: CardSplitStrategy =
    photos.length === variants.length
      ? "split_one_to_one"
      : photos.length % variants.length === 0
        ? "split_even_chunks"
        : "split_distribute_remainder";

  const photoChunks = splitItemsByPromptCount(photos, variants.length);
  const cards: ParsedCard[] = [];

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const chunkPhotos = photoChunks[i] ?? [];
    if (chunkPhotos.length === 0) continue;
    const localMedia = reindexMedia(chunkPhotos);
    const localVariant: PromptVariant = { ...variant, variantIndex: 0, matchStrategy: "fallback_all" };
    const localWarnings = [...splitWarnings];
    if (!localVariant.promptTextRu.trim()) {
      localWarnings.push("missing_ru_prompt_text");
    }
    cards.push({
      ...baseCard,
      parseStatus: localWarnings.length ? "parsed_with_warnings" : "parsed",
      parseWarnings: dedupeWarnings(localWarnings),
      cardSplitIndex: i,
      cardSplitTotal: variants.length,
      cardSplitStrategy: splitStrategy,
      photoCount: localMedia.length,
      promptCount: 1,
      media: localMedia,
      variants: [localVariant],
      variantMediaLinks: localMedia.map((m) => ({ variantIndex: 0, mediaIndex: m.mediaIndex })),
    });
  }

  return cards;
}

export async function parseDataset(datasetSlug: string, root = path.resolve(process.cwd(), "docs", "export")): Promise<ParseDatasetResult> {
  const datasetDir = path.resolve(root, datasetSlug);
  const htmlFiles = await readHtmlParts(datasetDir);
  if (htmlFiles.length === 0) {
    throw new Error(`No messages*.html found in ${datasetDir}`);
  }

  const cards: ParsedCard[] = [];
  let skippedNoBlockquote = 0;
  let skippedNoPhoto = 0;
  let channelTitle = datasetSlug;

  for (const htmlPath of htmlFiles) {
    const html = await fs.readFile(htmlPath, "utf-8");
    const $ = cheerio.load(html);
    const fromHeader = $(".page_header .text.bold").first().text().trim();
    if (fromHeader) channelTitle = fromHeader;

    const nodes: MessageNode[] = $(".history > .message")
      .toArray()
      .map((el) => ({
        id: $(el).attr("id") ?? "",
        classes: ($(el).attr("class") ?? "").trim(),
        html: $.html(el),
      }));
    const groups = groupMessageNodes(nodes);

    for (const group of groups) {
      const groupHtml = group.map((g) => g.html).join("\n");
      const $g = cheerio.load(`<div>${groupHtml}</div>`);
      if ($g("blockquote").length === 0) {
        skippedNoBlockquote += 1;
        continue;
      }
      if ($g("a.photo_wrap").length === 0) {
        skippedNoPhoto += 1;
        continue;
      }
      const groupCards = parseGroupToCards(group, datasetSlug, channelTitle);
      cards.push(...groupCards);
    }
  }

  return {
    datasetSlug,
    cards,
    htmlFiles: htmlFiles.length,
    skippedNoBlockquote,
    skippedNoPhoto,
  };
}

