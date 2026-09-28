import { CARD_IMAGE_LISTING_NEXT_QUALITY } from "./card-image-presets";
import { NEXT_IMAGE_DEVICE_SIZES } from "./next-cache-memory";

export const GENERACIYA_SEO_VARIANTS = {
  w1080: { width: 1080, quality: 78 },
  w512: { width: 512, quality: 75 },
} as const;

export type GeneraciyaSeoVariant = keyof typeof GENERACIYA_SEO_VARIANTS;

const BUCKET_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function isGeneraciyaSeoVariant(value: string): value is GeneraciyaSeoVariant {
  return value === "w1080" || value === "w512";
}

function encodeObjectPath(objectPath: string): string | null {
  if (
    !objectPath ||
    objectPath.includes("\\") ||
    objectPath.includes("?") ||
    objectPath.includes("#")
  ) {
    return null;
  }
  const parts = objectPath.split("/").filter((part) => part.length > 0);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    return null;
  }
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

export function buildGeneraciyaSeoImagePath(
  variant: GeneraciyaSeoVariant,
  bucket: string,
  objectPath: string,
): string | null {
  if (!BUCKET_RE.test(bucket)) return null;
  const encoded = encodeObjectPath(objectPath);
  if (!encoded) return null;
  return `/img/seo/${variant}/${bucket}/${encoded}`;
}

/**
 * Path-only parse. Query width/quality is stripped and never applied.
 * `/img/seo/{variant}/{bucket}/{object path}`.
 */
export function parseGeneraciyaSeoImagePathname(pathname: string): {
  variant: GeneraciyaSeoVariant;
  bucket: string;
  objectPath: string;
  width: number;
  quality: number;
} | null {
  const pathOnly = pathname.split("?")[0]?.split("#")[0] ?? "";
  const parts = pathOnly.split("/").filter((part) => part.length > 0);
  if (parts.length < 5 || parts[0] !== "img" || parts[1] !== "seo") return null;
  // Next leaves %3A in pathname. Decode once, then the render URL encodes once.
  // A second encode turns ":" into %253A and storage answers 400.
  const decode = (part: string): string | null => {
    try {
      return decodeURIComponent(part);
    } catch {
      return null;
    }
  };
  const bucket = decode(parts[3] ?? "");
  if (bucket === null) return null;
  const objectParts: string[] = [];
  for (const part of parts.slice(4)) {
    const value = decode(part);
    if (value === null) return null;
    objectParts.push(value);
  }
  return parseGeneraciyaSeoImageRequest(parts[2] ?? "", bucket, objectParts);
}

/** Width and quality come from the variant, never from the request query. */
export function parseGeneraciyaSeoImageRequest(
  variant: string,
  bucket: string,
  pathSegments: readonly string[],
): {
  variant: GeneraciyaSeoVariant;
  bucket: string;
  objectPath: string;
  width: number;
  quality: number;
} | null {
  if (!isGeneraciyaSeoVariant(variant) || !BUCKET_RE.test(bucket)) return null;
  if (
    pathSegments.length === 0 ||
    pathSegments.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.includes("\\") ||
        part.includes("?") ||
        part.includes("#"),
    )
  ) {
    return null;
  }
  const spec = GENERACIYA_SEO_VARIANTS[variant];
  return {
    variant,
    bucket,
    objectPath: pathSegments.join("/"),
    width: spec.width,
    quality: spec.quality,
  };
}

export function buildGeneraciyaSeoRenderPath(
  bucket: string,
  objectPath: string,
  variant: GeneraciyaSeoVariant,
): string | null {
  if (!BUCKET_RE.test(bucket)) return null;
  const encoded = encodeObjectPath(objectPath);
  if (!encoded) return null;
  const spec = GENERACIYA_SEO_VARIANTS[variant];
  return `/storage/v1/render/image/public/${bucket}/${encoded}?width=${spec.width}&quality=${spec.quality}`;
}

export function buildNextImageSrcSet(
  remoteUrl: string,
  quality = CARD_IMAGE_LISTING_NEXT_QUALITY,
): string {
  return NEXT_IMAGE_DEVICE_SIZES.map(
    (width) =>
      `/_next/image?url=${encodeURIComponent(remoteUrl)}&w=${width}&q=${quality} ${width}w`,
  ).join(", ");
}

export type GeneraciyaSeoImgAttrs = {
  src: string;
  srcSet?: string;
  alt: string;
  decoding: "async";
};

export function buildGeneraciyaSeoImgAttrs(input: {
  mode: "src1080" | "single512" | "both";
  bucket: string;
  path: string;
  previewUrl: string;
  alt: string;
}): GeneraciyaSeoImgAttrs | null {
  if (input.mode === "src1080" || input.mode === "both") {
    const src = buildGeneraciyaSeoImagePath("w1080", input.bucket, input.path);
    if (!src) return null;
    if (input.mode === "both") {
      const light = buildGeneraciyaSeoImagePath("w512", input.bucket, input.path);
      if (!light) return null;
      return {
        src,
        srcSet: `${light} 512w`,
        alt: input.alt,
        decoding: "async",
      };
    }
    return {
      src,
      srcSet: buildNextImageSrcSet(input.previewUrl),
      alt: input.alt,
      decoding: "async",
    };
  }

  const src = buildGeneraciyaSeoImagePath("w512", input.bucket, input.path);
  if (!src) return null;
  return { src, alt: input.alt, decoding: "async" };
}

export function classifyGeneraciyaImageBot(
  userAgent: string | null,
): "googlebot" | "yandex" | null {
  const ua = userAgent ?? "";
  if (/googlebot/i.test(ua)) return "googlebot";
  if (/yandex/i.test(ua)) return "yandex";
  return null;
}

export function generaciyaSeoRefererPath(
  referer: string | null,
  isAllowed: (pathname: string) => boolean,
): string | null {
  if (!referer) return null;
  try {
    const path = new URL(referer).pathname;
    return isAllowed(path) ? path : null;
  } catch {
    return null;
  }
}

/** Log line for Loki. No storage path, cookie, or full referrer. */
export function generaciyaBotImageLog(input: {
  bot: "googlebot" | "yandex";
  outcome: "rewrite" | "reject";
  variant?: GeneraciyaSeoVariant;
  width?: number;
  quality?: number;
  refererPath: string | null;
}): {
  event: "generaciya_bot_image_fetch";
  bot: "googlebot" | "yandex";
  outcome: "rewrite" | "reject";
  variant?: GeneraciyaSeoVariant;
  width?: number;
  quality?: number;
  referer_path: string | null;
} {
  return {
    event: "generaciya_bot_image_fetch",
    bot: input.bot,
    outcome: input.outcome,
    ...(input.variant
      ? { variant: input.variant, width: input.width, quality: input.quality }
      : {}),
    referer_path: input.refererPath,
  };
}
