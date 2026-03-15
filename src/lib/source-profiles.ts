/**
 * Per-source parsing profiles.
 *
 * Each Telegram channel has its own posting style:
 * different prompt containers, min lengths, grouping patterns, etc.
 * Instead of one-size-fits-all heuristics, we define explicit profiles.
 *
 * When adding a new source:
 * 1. Drop the export into docs/export/<slug>/
 * 2. Inspect 5-10 posts manually
 * 3. Create a SourceProfile below
 * 4. Register it in SOURCE_PROFILES
 * 5. Run: npx tsx src/ingest-telegram-export-to-supabase.ts --dataset <slug> --dry-run
 */

export interface SourceProfile {
  /** Glob-like prefix to match dataset slugs (e.g. "ii_photolab" matches "ii_photolab_ChatExport_2026-03-13") */
  slugPrefix: string;
  /** Human-readable name for logs */
  displayName: string;
  /** CSS selector(s) for prompt containers inside .text */
  promptContainerSelector: string;
  /** Minimum character length for a text block to be considered a real prompt */
  minPromptLength: number;
  /**
   * Grouping strategy for joined messages:
   * - "self-contained-split": split when a joined msg has both photo+prompt (default for most channels)
   * - "look-back-split": also handle pattern where photo-only msgs precede a text-only prompt
   *   (e.g. ii_photolab early posts: photo, photo, photo, text-prompt)
   */
  groupingStrategy: "self-contained-split" | "look-back-split" | "reply-to-parent";
}

export const SOURCE_PROFILES: SourceProfile[] = [
  {
    slugPrefix: "ii_photolab",
    displayName: "Промты для ИИ фотосесии (ii_photolab)",
    promptContainerSelector: "blockquote",
    minPromptLength: 80,
    groupingStrategy: "look-back-split",
  },
  {
    slugPrefix: "NeiRoAIPhotoBot",
    displayName: "Промпты Промты 🍌 Nano Banana PRO",
    promptContainerSelector: "blockquote, pre",
    minPromptLength: 80,
    groupingStrategy: "self-contained-split",
  },
  {
    slugPrefix: "LEXYGPT",
    displayName: "Lexy | Промты • ИИ • Новости",
    promptContainerSelector: "blockquote",
    minPromptLength: 80,
    groupingStrategy: "self-contained-split",
  },
  {
    slugPrefix: "bananogenpromt",
    displayName: "БананоГен Промты / Новости",
    promptContainerSelector: "blockquote, pre",
    minPromptLength: 80,
    groupingStrategy: "self-contained-split",
  },
  {
    slugPrefix: "PixelNanoBot",
    displayName: "Nano Banana Prompts",
    promptContainerSelector: "blockquote, pre",
    minPromptLength: 30,
    groupingStrategy: "self-contained-split",
  },
  {
    slugPrefix: "GPTFluxBot",
    displayName: "Промпты Nano Banana",
    promptContainerSelector: "blockquote, pre",
    minPromptLength: 80,
    groupingStrategy: "self-contained-split",
  },
  {
    slugPrefix: "Hvhvgybot",
    displayName: "Промпты для души ✨❄️☃️",
    promptContainerSelector: "blockquote, pre",
    minPromptLength: 20,
    groupingStrategy: "self-contained-split",
  },
  {
    slugPrefix: "ChatBananahMama",
    displayName: "Промты для нейросетей 🫶🏻фото и видео Chat",
    promptContainerSelector: ".text",
    minPromptLength: 40,
    groupingStrategy: "reply-to-parent",
  },
];

/**
 * Find the matching profile for a dataset slug.
 * Returns null if no profile is registered — caller should abort with a warning.
 */
export function findSourceProfile(datasetSlug: string): SourceProfile | null {
  return SOURCE_PROFILES.find((p) => datasetSlug.startsWith(p.slugPrefix)) ?? null;
}

/** Default profile used as fallback when analyzing unknown sources */
export const DEFAULT_PROFILE: SourceProfile = {
  slugPrefix: "__default__",
  displayName: "Unknown source",
  promptContainerSelector: "blockquote, pre",
  minPromptLength: 80,
  groupingStrategy: "self-contained-split",
};
