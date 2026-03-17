import {
  type TagEntry,
  type Dimension,
  findTagByUrlPath,
  findTagByLastSegment,
  DIMENSION_PRIORITY,
} from "./tag-registry";

export type ResolvedRoute = {
  tags: TagEntry[];
  level: 1 | 2 | 3;
  rpcParams: {
    audience_tag: string | null;
    style_tag: string | null;
    occasion_tag: string | null;
    object_tag: string | null;
    doc_task_tag: string | null;
  };
  canonicalPath: string;
  parentPath: string | null;
  primaryTag: TagEntry;
};

function tagsToRpcParams(tags: TagEntry[]) {
  const params: ResolvedRoute["rpcParams"] = {
    audience_tag: null,
    style_tag: null,
    occasion_tag: null,
    object_tag: null,
    doc_task_tag: null,
  };
  for (const tag of tags) {
    params[tag.dimension] = tag.slug;
  }
  return params;
}

function buildCanonicalPath(tags: TagEntry[]): string {
  const sorted = [...tags].sort(
    (a, b) =>
      DIMENSION_PRIORITY.indexOf(a.dimension) -
      DIMENSION_PRIORITY.indexOf(b.dimension),
  );

  const primary = sorted[0];
  const rest = sorted.slice(1);

  let path = primary.urlPath;
  if (!path.endsWith("/")) path += "/";

  for (const tag of rest) {
    const lastSeg = tag.urlPath.split("/").filter(Boolean).pop()!;
    path += lastSeg + "/";
  }

  return path;
}

/**
 * Resolve URL slug segments into tag combination (L1/L2/L3).
 *
 * Handles multi-segment L1 paths like `/stil/cherno-beloe`
 * and combinations like `/promty-dlya-foto-devushki/cherno-beloe/`.
 */
export function resolveUrlToTags(slugSegments: string[]): ResolvedRoute | null {
  if (slugSegments.length === 0) return null;

  const fullPath = "/" + slugSegments.join("/");

  const directMatch = findTagByUrlPath(fullPath);
  if (directMatch) {
    return {
      tags: [directMatch],
      level: 1,
      rpcParams: tagsToRpcParams([directMatch]),
      canonicalPath: directMatch.urlPath.endsWith("/")
        ? directMatch.urlPath
        : directMatch.urlPath + "/",
      parentPath: null,
      primaryTag: directMatch,
    };
  }

  // Try splitting: first N segments = L1 tag, remaining = L2 (+ optional L3) slugs
  for (let splitAt = slugSegments.length - 1; splitAt >= 1; splitAt--) {
    const headPath = "/" + slugSegments.slice(0, splitAt).join("/");
    const tailSlugs = slugSegments.slice(splitAt);

    if (tailSlugs.length > 2) continue;

    const tag1 = findTagByUrlPath(headPath);
    if (!tag1) continue;

    const tag2 = findTagByLastSegment(tailSlugs[0], [tag1.dimension]);
    if (!tag2) continue;

    if (tailSlugs.length === 1) {
      const tags = [tag1, tag2];
      return {
        tags,
        level: 2,
        rpcParams: tagsToRpcParams(tags),
        canonicalPath: buildCanonicalPath(tags),
        parentPath: tag1.urlPath.endsWith("/")
          ? tag1.urlPath
          : tag1.urlPath + "/",
        primaryTag: tag1,
      };
    }

    if (tailSlugs.length === 2) {
      const tag3 = findTagByLastSegment(tailSlugs[1], [
        tag1.dimension,
        tag2.dimension,
      ]);
      if (!tag3) continue;

      const tags = [tag1, tag2, tag3];
      return {
        tags,
        level: 3,
        rpcParams: tagsToRpcParams(tags),
        canonicalPath: buildCanonicalPath(tags),
        parentPath: tag1.urlPath.endsWith("/")
          ? tag1.urlPath
          : tag1.urlPath + "/",
        primaryTag: tag1,
      };
    }
  }

  return null;
}

/** Min cards threshold for index/noindex */
export function getMinCardsForLevel(level: 1 | 2 | 3): number {
  return level === 1 ? 1 : 6;
}
